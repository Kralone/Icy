#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Exécuter avec sudo.' >&2; exit 1; }
directory=$(cd -- "$(dirname -- "$0")" && pwd)
systemctl cat iceforge-monitor.service >/dev/null
marker=/etc/postfix/.iceforge-alerts-managed
for package in sendmail exim opensmtpd qmail; do
  if rpm -q "$package" >/dev/null 2>&1 || systemctl is-active --quiet "$package.service"; then
    echo "Serveur mail existant ($package) : installation interrompue avant modification." >&2
    exit 1
  fi
done
if [[ ! -f $marker ]] && { command -v sendmail >/dev/null || [[ -e /usr/sbin/sendmail ]] || [[ -n $(ss -H -ltn '( sport = :25 )') ]]; }; then
  echo 'Transport mail ou écoute SMTP existante : examiner la configuration avant installation.' >&2
  exit 1
fi
if command -v postconf >/dev/null && [[ ! -f $marker ]]; then
  echo 'Postfix existe déjà : examiner sa configuration avant toute modification.' >&2
  exit 1
fi
# Existing forward-confirmed PTR: no new public SMTP hostname or inbound port is needed.
[[ $(dig @1.1.1.1 +short A srv740400.hstgr.cloud) == 82.29.170.11 ]] || {
  echo 'Le nom public du VPS ne correspond plus à son IP ; vérifier le DNS.' >&2; exit 1;
}
dnf -y install postfix
backup=$(mktemp -d /var/backups/iceforge/postfix-alerts.XXXXXX)
chmod 0700 "$backup"
cp -p /etc/postfix/main.cf "$backup/main.cf"
postconf -e 'myhostname = srv740400.hstgr.cloud'
postconf -e 'mydomain = iceforge.fr'
postconf -e 'myorigin = iceforge.fr'
postconf -e 'inet_interfaces = loopback-only'
postconf -e 'inet_protocols = ipv4'
postconf -e 'mynetworks = 127.0.0.0/8'
postconf -e 'mydestination = localhost'
postconf -e 'relayhost ='
postconf -e 'smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination'
postconf -e 'smtp_tls_security_level = encrypt'
postconf -e 'smtp_tls_CAfile = /etc/pki/tls/certs/ca-bundle.crt'
postconf -e 'smtp_tls_loglevel = 1'
postconf -e 'smtp_sasl_auth_enable = no'
postconf -e 'disable_vrfy_command = yes'
postfix check
touch "$marker"
chmod 0600 "$marker"
systemctl enable --now postfix
systemctl restart postfix
systemctl is-active postfix
if ! ss -H -ltn '( sport = :25 )' | awk '{print $4}' | grep -Fxq '127.0.0.1:25'; then
  echo 'SMTP local absent.' >&2; exit 1
fi
if ss -H -ltn '( sport = :25 )' | awk '{print $4}' | grep -Evq '^127\.0\.0\.1:25$'; then
  echo 'Écoute SMTP inattendue : arrêt pour éviter une exposition publique.' >&2
  systemctl stop postfix
  exit 1
fi
echo "LOCAL-SMTP=OK écoute 127.0.0.1:25, TLS sortant requis, sauvegarde=$backup"
python3 "$directory/production-monitor.py" configure-local
if [[ -f /etc/iceforge-monitor/config.json ]]; then
  systemctl start iceforge-monitor.service
fi
