#!/usr/bin/env python3
"""Host-level monitoring independent of the application and Vault secrets.

Alerts go by mail (config.json) and/or to a Discord webhook (discord.json). The
webhook does not depend on the IceForge bot, so it still alerts if the bot is down.
"""
import argparse
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
import fcntl
import json
import os
import re
from pathlib import Path
import shutil
import smtplib
import socket
import ssl
import stat
import subprocess
import sys
import tempfile
import time
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


def probe(containers=None):
    """Mail diagnosis; with a container list, also the extended Discord checks."""
    data = inspect_services()
    vault = command(['docker', 'exec', 'iceforge_vault', 'wget', '-qO-', '-T', '5',
                     'http://127.0.0.1:8200/v1/sys/seal-status'])
    data['vault_sealed'] = vault.get('sealed') if isinstance(vault, dict) else None
    try:
        request = urllib.request.Request(URL, headers={'User-Agent': 'IceForge-Production-Monitor/1.0'})
        started = time.monotonic()
        with urllib.request.urlopen(request, timeout=8) as response:
            data['http'] = response.status
        data['latency_ms'] = int((time.monotonic() - started) * 1000)
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
    if containers is not None:
        data['containers'] = inspect_containers(containers)
        data['disk_percent'] = disk_percent()
        data['certificate_days'] = certificate_days()
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


# --- Discord and extended checks ---------------------------------------------

DISCORD_CONFIG = Path('/etc/iceforge-monitor/discord.json')
DISCORD_STATE = Path('/var/lib/iceforge-monitor/discord-state.json')
# Only Discord webhooks: the secret URL never leaves for an arbitrary host.
WEBHOOK = re.compile(r'https://(?:(?:canary|ptb)\.)?discord(?:app)?\.com/api/webhooks/\d{15,22}/[A-Za-z0-9_-]{20,120}')
MENTION = re.compile(r'here|everyone|none|\d{15,22}')
CONTAINER_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}')
USER_AGENT = 'DiscordBot (https://iceforge.fr, 2.0) IceForge-Production-Monitor'
DISK_THRESHOLD = 90
CERTIFICATE_THRESHOLD_DAYS = 14
GREEN, ORANGE, RED = 0x2ECC71, 0xE67E22, 0xE74C3C
UNSEAL_HINT = ('Déverrouiller depuis PowerShell, dans le dépôt IceForge :\n'
               '`powershell -NoProfile -ExecutionPolicy Bypass -File .\\ops\\production\\vault\\unseal-from-windows.ps1`')


def inspect_containers(names):
    """State of each watched container; never reads its environment."""
    template = ('{{.Name}}\t{{.State.Status}}\t'
                '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}\t{{.RestartCount}}')
    try:
        # Exit code is non-zero when one container is missing: the others are still printed.
        result = subprocess.run(['docker', 'inspect', '--type', 'container', '--format', template, *names],
                                capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode and not result.stdout.strip() and 'No such' not in result.stderr:
        return None
    found = {}
    for line in result.stdout.splitlines():
        parts = line.split('\t')
        if len(parts) == 4:
            found[parts[0].lstrip('/')] = {'status': parts[1], 'health': parts[2],
                                           'restarts': int(parts[3]) if parts[3].isdigit() else 0}
    return {name: found.get(name, {'status': 'missing', 'health': 'unknown', 'restarts': 0}) for name in names}


def running_containers(exclude):
    """Containers to watch: those running now, minus the ones matching `exclude` (staging)."""
    result = subprocess.run(['docker', 'ps', '--format', '{{.Names}}\t{{.Label "com.docker.compose.project"}}'],
                            capture_output=True, text=True, timeout=10, check=True)
    pattern = re.compile(exclude, re.IGNORECASE) if exclude else None
    names = []
    for line in result.stdout.splitlines():
        name, _, project = line.partition('\t')
        if CONTAINER_NAME.fullmatch(name) and not (pattern and (pattern.search(name) or pattern.search(project))):
            names.append(name)
    return sorted(names)


def disk_percent(path='/'):
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return None
    return round(usage.used * 100 / usage.total)


def certificate_days(host='iceforge.fr'):
    try:
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        with socket.create_connection((host, 443), timeout=8) as raw:
            with context.wrap_socket(raw, server_hostname=host) as connection:
                not_after = connection.getpeercert()['notAfter']
        return int((ssl.cert_time_to_seconds(not_after) - time.time()) // 86400)
    except (OSError, ssl.SSLError, KeyError, ValueError):
        return None  # An invalid certificate already makes the public API check fail.


def container_ok(state):
    return state['status'] == 'running' and state['health'] in ('healthy', 'none')


def container_text(name, state):
    if state['status'] == 'missing':
        return f'{name} : conteneur introuvable'
    if state['status'] != 'running':
        detail = state['status'] + (f", {state['restarts']} redémarrages" if state['restarts'] else '')
        return f'{name} : {detail}'
    return f"{name} : {'démarrage en cours' if state['health'] == 'starting' else 'non sain'}"


def problems(observation):
    """Every failing component, keyed so that each one is alerted and recovered on its own."""
    found = {}
    if observation['http'] != 200:
        found['api'] = ('Site public injoignable' if observation['http'] == 0
                        else f"Site public : HTTP {observation['http']}")
    if observation['vault_sealed'] is True:
        found['vault'] = 'Vault scellé : le backend et le bot ne pourront pas redémarrer'
    elif observation['vault_sealed'] is not False:
        found['vault'] = 'Vault : état illisible'
    containers = observation.get('containers')
    if containers is None:
        found['docker'] = 'Docker ne répond pas'
    else:
        for name, state in containers.items():
            if not container_ok(state):
                found['container:' + name] = container_text(name, state)
    if observation.get('disk_percent') is not None and observation['disk_percent'] >= DISK_THRESHOLD:
        found['disk'] = f"Disque presque plein : {observation['disk_percent']} %"
    days = observation.get('certificate_days')
    if days is not None and days < CERTIFICATE_THRESHOLD_DAYS:
        found['certificate'] = f'Certificat HTTPS : expire dans {days} jours'
    return found


def discord_transition(state, found, now, threshold=2):
    """Returns (state, new alerts, recoveries). A problem is alerted after `threshold` failed checks."""
    previous = state.get('counts', {})
    counts = {key: previous.get(key, 0) + 1 for key in found}
    alerted = {key: dict(value) for key, value in state.get('alerted', {}).items()}
    recovered = {key: alerted.pop(key) for key in list(alerted) if key not in found}
    new = {}
    for key, text in found.items():
        if key in alerted:
            alerted[key]['text'] = text
        elif counts[key] >= threshold:
            new[key] = alerted[key] = {'text': text, 'since': now.isoformat()}
    updated = dict(state)
    updated.update(counts=counts, alerted=alerted)
    return updated, new, recovered


def duration(since, now):
    minutes = max(1, round((now - datetime.fromisoformat(since)).total_seconds() / 60))
    return f'{minutes} min' if minutes < 120 else f'{minutes // 60} h {minutes % 60:02d}'


def allowed_mentions(mention):
    if mention in ('here', 'everyone'):
        return '@' + mention, {'parse': ['everyone']}
    if mention and mention.isdigit():
        return f'<@&{mention}>', {'roles': [mention]}
    return '', {'parse': []}


def alert_payload(new, mention):
    prefix, allowed = allowed_mentions(mention)
    lines = [f"🔴 {value['text']}" for value in new.values()]
    if 'vault' in new:
        lines += ['', UNSEAL_HINT, 'Ne pas réinitialiser Vault.']
    return {'content': (prefix + ' ' if prefix else '') + '**Alerte IceForge**', 'allowed_mentions': allowed,
            'embeds': [{'title': 'Incident détecté', 'description': '\n'.join(lines), 'color': RED}]}


def recovery_payload(recovered, now):
    lines = [f"🟢 {value['text']} (durée : {duration(value['since'], now)})" for value in recovered.values()]
    return {'content': '**IceForge : rétabli**', 'allowed_mentions': {'parse': []},
            'embeds': [{'title': 'Service rétabli', 'description': '\n'.join(lines), 'color': GREEN}]}


def status_payload(observation, found, alerted, now):
    """The live message, edited after every check."""
    def mark(ok):
        return '🟢' if ok else '🔴'
    http = observation['http']
    latency = f", {observation['latency_ms']} ms" if http == 200 and 'latency_ms' in observation else ''
    sealed = observation['vault_sealed']
    lines = [f"{mark(http == 200)} **Site public** : {'HTTP ' + str(http) if http else 'injoignable'}{latency}",
             f"{mark(sealed is False)} **Vault** : "
             + {True: 'scellé', False: 'déverrouillé'}.get(sealed, 'état illisible')]
    containers = observation.get('containers')
    if containers is None:
        lines.append('🔴 **Conteneurs** : Docker ne répond pas')
    else:
        healthy = sum(container_ok(state) for state in containers.values())
        lines.append(f'{mark(healthy == len(containers))} **Conteneurs** : {healthy}/{len(containers)} sains')
        for name, state in containers.items():
            detail = state['health'] if state['health'] != 'none' else state['status']
            if not container_ok(state):
                detail = container_text(name, state).split(' : ', 1)[1]
            lines.append(f'{mark(container_ok(state))} `{name}` {detail}')
    disk = observation.get('disk_percent')
    if disk is not None:
        lines.append(f'{mark(disk < DISK_THRESHOLD)} **Disque** : {disk} % utilisé')
    days = observation.get('certificate_days')
    if days is not None:
        lines.append(f'{mark(days >= CERTIFICATE_THRESHOLD_DAYS)} **Certificat HTTPS** : expire dans {days} jours')
    lines += ['', f'Dernier contrôle : <t:{int(now.timestamp())}:R>']
    if alerted:
        colour, title = RED, f'IceForge : {len(alerted)} incident(s) en cours'
    elif found:
        colour, title = ORANGE, 'IceForge : anomalie en vérification'
    else:
        colour, title = GREEN, 'IceForge : tout fonctionne'
    return {'content': '', 'allowed_mentions': {'parse': []},
            'embeds': [{'title': title, 'description': '\n'.join(lines), 'color': colour,
                        'footer': {'text': 'Mis à jour chaque minute par la sonde du VPS'}}]}


def http_json(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method,
                                     headers={'Content-Type': 'application/json', 'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read()
    return json.loads(body) if body else {}


def update_status(config, state, payload):
    """Edit the live message; post a new one if it was deleted or never posted."""
    url = config.get('status_webhook_url') or config['webhook_url']
    message = state.get('status_message_id')
    if message and state.get('status_webhook') == webhook_id(url):
        try:
            http_json('PATCH', f'{url}/messages/{message}', payload)
            return
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
    posted = http_json('POST', url + '?wait=true', payload)
    state['status_message_id'] = str(posted['id'])
    state['status_webhook'] = webhook_id(url)


def webhook_id(url):
    return url.split('/api/webhooks/', 1)[1].split('/', 1)[0]


def discord_check(config, state, observation, now, send=http_json):
    """One check: alerts and recoveries first, then the live message. Returns the state to persist."""
    found = problems(observation)
    # Unknown is not recovered: an open incident stays open until a valid measure clears it.
    for key, value in state.get('alerted', {}).items():
        unknown = ((key.startswith('container:') and 'docker' in found)
                   or (key == 'certificate' and observation.get('certificate_days') is None)
                   or (key == 'disk' and observation.get('disk_percent') is None))
        if unknown:
            found.setdefault(key, value['text'])
    updated, new, recovered = discord_transition(state, found, now)
    if recovered:
        try:
            send('POST', config['webhook_url'], recovery_payload(recovered, now))
        except (OSError, ValueError):
            # Not delivered: these incidents stay open and the recovery is retried next minute.
            updated['alerted'].update(recovered)
            for key in new:
                del updated['alerted'][key]
            return updated, False
    if new:
        try:
            send('POST', config['webhook_url'], alert_payload(new, config.get('mention', 'here')))
        except (OSError, ValueError):
            # Only the failed alert is retried; a recovery already delivered is not sent again.
            for key in new:
                del updated['alerted'][key]
            return updated, False
    try:
        update_status(config, updated, status_payload(observation, found, updated['alerted'], now))
    except (OSError, ValueError, KeyError):
        return updated, False
    return updated, True


def validated_discord_config(raw):
    config = {'webhook_url': raw.get('webhook_url'), 'mention': raw.get('mention') or 'here'}
    if raw.get('status_webhook_url'):
        config['status_webhook_url'] = raw['status_webhook_url']
    if (not isinstance(config['webhook_url'], str) or not WEBHOOK.fullmatch(config['webhook_url'])
            or ('status_webhook_url' in config and not (isinstance(config['status_webhook_url'], str)
                                                         and WEBHOOK.fullmatch(config['status_webhook_url'])))
            or not isinstance(config['mention'], str) or not MENTION.fullmatch(config['mention'])):
        raise RuntimeError('Invalid Discord configuration')
    return config


def configure_discord(exclude):
    config = validated_discord_config(json.loads(sys.stdin.readline()))
    config['containers'] = running_containers(exclude)
    if not config['containers']:
        raise RuntimeError('No running container to watch')
    listing = '\n'.join(f'• `{name}`' for name in config['containers'])
    test = {'content': '**IceForge : alertes Discord activées**', 'allowed_mentions': {'parse': []},
            'embeds': [{'title': f"{len(config['containers'])} conteneurs surveillés", 'color': GREEN,
                        'description': listing + '\n\nUne alerte arrive ici quand un service tombe, '
                                                 'puis un message quand il est rétabli.'}]}
    http_json('POST', config['webhook_url'], test)
    write_protected(DISCORD_CONFIG, config)
    print('DISCORD-CONFIG=OK containers=' + ','.join(config['containers']))


def refresh_containers(exclude):
    config = read_protected(DISCORD_CONFIG)
    before = set(config.get('containers', []))
    config['containers'] = running_containers(exclude)
    if not config['containers']:
        raise RuntimeError('No running container to watch')
    write_protected(DISCORD_CONFIG, config)
    after = set(config['containers'])
    print('DISCORD-CONTAINERS=OK added=' + ','.join(sorted(after - before))
          + ' removed=' + ','.join(sorted(before - after)) + f' total={len(after)}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('configure', 'configure-local', 'check', 'test-email',
                                           'configure-discord', 'refresh-containers', 'test-discord'))
    # Adresse de réception : paramètre de déploiement, jamais écrite dans le dépôt.
    parser.add_argument('--recipient')
    # Conteneurs ignorés lors de l'inventaire : le staging est souvent volontairement en veille.
    parser.add_argument('--exclude', default='staging')
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
    if args.action == 'configure-discord':
        configure_discord(args.exclude)
        return
    if args.action == 'refresh-containers':
        refresh_containers(args.exclude)
        return
    if args.action == 'test-discord':
        config = read_protected(DISCORD_CONFIG)
        http_json('POST', config['webhook_url'], {'content': '**IceForge : test des alertes Discord**',
                                                  'allowed_mentions': {'parse': []}})
        print('DISCORD-TEST=OK')
        return
    if args.action == 'test-email':
        send_email(read_protected(CONFIG), '[IceForge] Test des alertes de production', 'Envoi des alertes opérationnel.')
        print('MONITOR-MAIL-TEST=OK')
        return
    mail = read_protected(CONFIG) if CONFIG.exists() else None
    discord = read_protected(DISCORD_CONFIG) if DISCORD_CONFIG.exists() else None
    if mail is None and discord is None:
        raise RuntimeError('No alert channel configured')
    STATE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open(STATE.parent / '.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        observation = probe(discord['containers'] if discord else None)
        failed = []
        if discord:
            state = read_protected(DISCORD_STATE) if DISCORD_STATE.exists() else {}
            updated, delivered = discord_check(discord, state, observation, datetime.now(timezone.utc))
            write_protected(DISCORD_STATE, updated)
            if not delivered:
                failed.append('discord')
        if mail:
            state = read_protected(STATE) if STATE.exists() else {'failures': 0}
            try:
                updated = transition(state, observation, lambda subject, body: send_email(mail, subject, body),
                                     heartbeat_days=mail.get('heartbeat_days', 0))
            except (OSError, smtplib.SMTPException):
                # Keep the prior notified state; failed alert/recovery mail will be retried next minute.
                updated = dict(state)
                if observation['cause'] != 'OK':
                    updated['failures'] = updated.get('failures', 0) + 1
                failed.append('mail')
            write_protected(STATE, updated)
        print('ICEFORGE-MONITOR cause=' + observation['cause'] + ' http=' + str(observation['http'])
              + (f' problems={len(problems(observation))}' if discord else ''))
        if failed:
            raise RuntimeError('Delivery failed: ' + ','.join(failed))

if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        # Only messages written by this script: they never contain a secret.
        print(f'ICEFORGE-MONITOR=ERROR {error} ; aucun secret affiché.', file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, smtplib.SMTPException, subprocess.TimeoutExpired):
        print('ICEFORGE-MONITOR=ERROR vérifier configuration mail/Discord, réseau et journal du service ; aucun secret affiché.', file=sys.stderr)
        sys.exit(1)
