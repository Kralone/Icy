#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Exécuter avec sudo.' >&2; exit 1; }
directory=$(cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null
command -v docker >/dev/null
install -d -o root -g root -m 0700 /etc/iceforge-monitor /var/lib/iceforge-monitor
install -o root -g root -m 0644 "$directory/iceforge-monitor.service" /etc/systemd/system/iceforge-monitor.service
install -o root -g root -m 0644 "$directory/iceforge-monitor.timer" /etc/systemd/system/iceforge-monitor.timer
systemd-analyze verify /etc/systemd/system/iceforge-monitor.service /etc/systemd/system/iceforge-monitor.timer
systemctl daemon-reload
systemctl enable --now iceforge-monitor.timer
if [[ -f /etc/iceforge-monitor/config.json ]]; then
  systemctl start iceforge-monitor.service
  echo 'ICEFORGE-MONITOR=INSTALLED configuration présente ; vérifier le mail de test et le timer.'
else
  echo 'ICEFORGE-MONITOR=WAITING_FOR_MAIL configuration requise ; aucun mail ne peut encore partir.'
fi
