#!/usr/bin/env python3
"""Host-level monitoring independent of the application and Vault secrets."""
import argparse
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
import fcntl
import json
import os
import re
from pathlib import Path
import smtplib
import ssl
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

EMAIL = re.compile(r'[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+')

CONFIG = Path('/etc/iceforge-monitor/config.json')
STATE = Path('/var/lib/iceforge-monitor/state.json')
URL = 'https://iceforge.fr/api/front/members'
SMTP_PROVIDERS = {'gmail': ('smtp.gmail.com', 587), 'brevo': ('smtp-relay.brevo.com', 587),
                  'local': ('127.0.0.1', 25)}
LABELS = {
    'VAULT_SEALED': 'Vault scellé : les applications ne peuvent pas charger leurs secrets',
    'VAULT_UNAVAILABLE': 'Vault indisponible ou son état ne peut pas être lu',
    'BACKEND_DOWN': 'Backend arrêté, en redémarrage ou non sain',
    'PUBLIC_API_DOWN': 'API publique indisponible alors que le backend est sain',
    'BOT_DOWN': 'Bot arrêté, en redémarrage ou non sain',
    'OK': 'API, backend, bot et Vault opérationnels',
}


def read_protected(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
            raise RuntimeError('Protected file required')
        return json.load(stream)


def write_protected(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.monitor-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command(arguments, payload=None):
    try:
        result = subprocess.run(arguments, input=payload, capture_output=True, text=True, timeout=8)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode:
        return None
    try:
        return json.loads(result.stdout)
    except ValueError:
        return None


def inspect_services():
    # Select only operational state; never deserialize container environment secrets.
    result = command(['docker', 'inspect', '--format', '{{json .State}}', 'iceforge_backend'])
    bot = command(['docker', 'inspect', '--format', '{{json .State}}', 'iceforge_bot'])
    def summarize(state):
        return {'status': state.get('Status', 'unknown'),
                'health': state.get('Health', {}).get('Status', 'unknown')} if state else {'status': 'missing', 'health': 'unknown'}
    return {'backend': summarize(result), 'bot': summarize(bot)}


def probe():
    data = inspect_services()
    vault = command(['docker', 'exec', 'iceforge_vault', 'wget', '-qO-', '-T', '5',
                     'http://127.0.0.1:8200/v1/sys/seal-status'])
    data['vault_sealed'] = vault.get('sealed') if isinstance(vault, dict) else None
    try:
        request = urllib.request.Request(URL, headers={'User-Agent': 'IceForge-Production-Monitor/1.0'})
        with urllib.request.urlopen(request, timeout=8) as response:
            data['http'] = response.status
    except urllib.error.HTTPError as error:
        data['http'] = error.code
    except (OSError, urllib.error.URLError):
        data['http'] = 0
    if data['vault_sealed'] is True:
        data['cause'] = 'VAULT_SEALED'
    elif data['vault_sealed'] is not False:
        data['cause'] = 'VAULT_UNAVAILABLE'
    elif data['backend'] != {'status': 'running', 'health': 'healthy'}:
        data['cause'] = 'BACKEND_DOWN'
    elif data['http'] != 200:
        data['cause'] = 'PUBLIC_API_DOWN'
    elif data['bot'] != {'status': 'running', 'health': 'healthy'}:
        data['cause'] = 'BOT_DOWN'
    else:
        data['cause'] = 'OK'
    return data


def email_body(observation, recovered=False):
    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    title = 'service rétabli' if recovered else ('contrôle périodique' if observation['cause'] == 'OK' else 'incident détecté')
    text = [f"IceForge : {title}", f'Date UTC : {now}',
            f"Cause détectée : {LABELS[observation['cause']]}", f"API publique : HTTP {observation['http']} (0 = connexion impossible)",
            f"Backend : {observation['backend']['status']} / {observation['backend']['health']}",
            f"Bot : {observation['bot']['status']} / {observation['bot']['health']}",
            f"Vault scellé : {observation['vault_sealed']}"]
    if observation['cause'] == 'VAULT_SEALED':
        text += ['', 'Vault reste scellé après son redémarrage jusqu’au déverrouillage opérateur.',
                 'Les applications déjà démarrées peuvent encore fonctionner, mais leur redémarrage est bloqué.',
                 'Dans PowerShell, depuis le dépôt IceForge :',
                 r'powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\production\vault\unseal-from-windows.ps1',
                 'Saisir la clé unseal dans l’invite masquée. Ne pas réinitialiser Vault.']
    return '\n'.join(text)


def send_email(config, subject, body):
    message = EmailMessage()
    message['From'] = config.get('sender', config['smtp_username'])
    message['To'] = config['recipient']
    message['Subject'] = subject
    message['Date'] = format_datetime(datetime.now(timezone.utc))
    message['Message-ID'] = make_msgid(domain='iceforge.fr')
    message.set_content(body)
    # Fixed provider endpoints: credentials never go to an arbitrary host from configuration input.
    host, port = SMTP_PROVIDERS[config.get('provider', 'gmail')]
    with smtplib.SMTP(host, port, timeout=10) as client:
        client.ehlo()
        if config.get('provider', 'gmail') != 'local':
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
            client.login(config['smtp_username'], config['smtp_password'])
        client.send_message(message)


def local_spf_ready():
    result = subprocess.run(['dig', '@1.1.1.1', '+short', '+time=3', '+tries=1', 'TXT', 'iceforge.fr'],
                            capture_output=True, text=True, timeout=8)
    records = [line.replace('"', '') for line in result.stdout.splitlines() if 'v=spf1' in line]
    # Deliberately accept only the simple policy we document, not a partial SPF evaluation.
    return (result.returncode == 0 and len(records) == 1
            and re.fullmatch(r'v=spf1\s+ip4:82\.29\.170\.11(?:/32)?\s+[~-]all', records[0].strip()) is not None)


def transition(state, observation, notify, threshold=2, heartbeat_days=0, now=None):
    state = dict(state)
    now = now or datetime.now(timezone.utc)
    last = datetime.fromisoformat(state['last_delivery_at']) if state.get('last_delivery_at') else None
    delivery_due = bool(heartbeat_days and last and (now - last).total_seconds() >= heartbeat_days * 86400)
    cause = observation['cause']
    if cause == 'OK':
        if state.get('notified_cause'):
            notify('[IceForge] Service rétabli', email_body(observation, recovered=True))
            state['last_delivery_at'] = now.isoformat()
        elif delivery_due:
            notify('[IceForge] Vérification mensuelle des alertes',
                   'Aucun incident détecté. Ce mail confirme que le canal des alertes fonctionne et maintient la clé SMTP active.\n'
                   + email_body(observation))
            state['last_delivery_at'] = now.isoformat()
        return {'failures': 0, 'last_delivery_at': state.get('last_delivery_at', now.isoformat())}
    state['failures'] = state.get('failures', 0) + 1
    if state['failures'] >= threshold and state.get('notified_cause') != cause:
        notify('[IceForge] Alerte : ' + LABELS[cause], email_body(observation))
        state['notified_cause'] = cause
        state['last_delivery_at'] = now.isoformat()
    elif delivery_due and state.get('notified_cause') == cause:
        notify('[IceForge] Rappel mensuel : incident toujours présent', email_body(observation))
        state['last_delivery_at'] = now.isoformat()
    return state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('configure', 'configure-local', 'check', 'test-email'))
    # Adresse de réception : paramètre de déploiement, jamais écrite dans le dépôt.
    parser.add_argument('--recipient')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    if args.action == 'configure-local':
        if not local_spf_ready():
            print('MONITOR-MAIL=WAITING_FOR_SPF ajouter TXT @ : v=spf1 ip4:82.29.170.11 ~all')
            return
        recipient = args.recipient
        if recipient is None and CONFIG.exists():
            recipient = read_protected(CONFIG).get('recipient')
        if not isinstance(recipient, str) or not EMAIL.fullmatch(recipient):
            print('MONITOR-MAIL=WAITING_FOR_RECIPIENT relancer avec --recipient <adresse de réception>')
            return
        config = {'provider': 'local', 'sender': 'alertes@iceforge.fr',
                  'smtp_username': 'alertes@iceforge.fr', 'recipient': recipient,
                  'heartbeat_days': 30}
        send_email(config, '[IceForge] Test des alertes via le SMTP du VPS',
                   'Ce message est envoyé par le Postfix local du VPS, sans compte Gmail ni Brevo.\n'
                   'Vérifier sa réception dans Gmail avant de considérer les alertes opérationnelles.')
        write_protected(CONFIG, config)
        print('MONITOR-MAIL-LOCAL=QUEUED vérifier la livraison Gmail dans les logs Postfix et la boîte de réception')
        return
    if args.action == 'configure':
        config = json.loads(sys.stdin.readline())
        provider = config.get('provider', 'gmail')
        sender = config.get('sender', config.get('smtp_username', ''))
        if (not isinstance(config.get('recipient'), str) or not EMAIL.fullmatch(config['recipient'])
                or not isinstance(provider, str) or provider not in ('gmail', 'brevo')
                or not isinstance(config.get('smtp_username'), str)
                or not EMAIL.fullmatch(config['smtp_username'])
                or not isinstance(sender, str)
                or not EMAIL.fullmatch(sender)
                or (provider == 'gmail' and (config['smtp_username'] != config['recipient'] or sender != config['recipient']))
                or not isinstance(config.get('smtp_password'), str)
                or not config['smtp_password'].strip()):
            raise RuntimeError('Invalid mail configuration')
        config['provider'] = provider
        config['sender'] = sender
        config['heartbeat_days'] = 30 if provider == 'brevo' else 0
        send_email(config, '[IceForge] Test des alertes de production',
                   'Envoi mail validé. La surveillance détecte les pannes du backend, du bot, de l’API et Vault scellé.\n'
                   'Ce mail de test ne remplace pas la vérification du timer de surveillance.')
        write_protected(CONFIG, config)
        print('MONITOR-MAIL-CONFIG=OK test envoyé')
        return
    config = read_protected(CONFIG)
    if args.action == 'test-email':
        send_email(config, '[IceForge] Test des alertes de production', 'Envoi des alertes opérationnel.')
        print('MONITOR-MAIL-TEST=OK')
        return
    STATE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open(STATE.parent / '.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = read_protected(STATE) if STATE.exists() else {'failures': 0}
        observation = probe()
        try:
            updated = transition(state, observation, lambda subject, body: send_email(config, subject, body),
                                 heartbeat_days=config.get('heartbeat_days', 0))
        except (OSError, smtplib.SMTPException):
            # Keep the prior notified state; failed alert/recovery mail will be retried next minute.
            updated = dict(state)
            if observation['cause'] != 'OK':
                updated['failures'] = updated.get('failures', 0) + 1
            write_protected(STATE, updated)
            raise RuntimeError('Mail delivery failed') from None
        write_protected(STATE, updated)
        print('ICEFORGE-MONITOR cause=' + observation['cause'] + ' http=' + str(observation['http']))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, smtplib.SMTPException, subprocess.TimeoutExpired):
        print('ICEFORGE-MONITOR=ERROR vérifier configuration mail, réseau et journal du service ; aucun secret affiché.', file=sys.stderr)
        sys.exit(1)
