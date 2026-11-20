#!/usr/bin/env bash
# Mises à jour de sécurité automatiques, sans Docker et sans redémarrage.
#
# Docker est exclu : sa mise à jour redémarre les conteneurs et rescelle Vault,
# ce qui couperait le backend et le bot jusqu'au déverrouillage manuel.
# Les noyaux sont installés mais jamais chargés automatiquement : le
# redémarrage reste une maintenance planifiée (update-almalinux9.sh).
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  configure-dnf-automatic.sh --check    affiche la configuration qui serait écrite
  configure-dnf-automatic.sh --apply    installe dnf-automatic et active le timer quotidien
  configure-dnf-automatic.sh --remove   désactive le timer (le paquet reste installé)
USAGE
}

[[ $# -eq 1 ]] || { usage; exit 2; }
[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }

config=/etc/dnf/automatic.conf
excluded='docker-ce docker-ce-cli docker-ce-rootless-extras containerd.io docker-compose-plugin docker-buildx-plugin'

render() {
  cat <<CONF
# Géré par ops/production/system/configure-dnf-automatic.sh
[commands]
upgrade_type = security
random_sleep = 1800
network_online_timeout = 60
download_updates = yes
apply_updates = yes
reboot = never

[emitters]
emit_via = stdio

[base]
debuglevel = 1
exclude = $excluded
CONF
}

case "$1" in
  --check)
    render
    ;;
  --apply)
    dnf -y install dnf-automatic
    if [[ -f $config && ! -f $config.iceforge-orig ]]; then
      cp -p "$config" "$config.iceforge-orig"
    fi
    render >"$config.tmp"
    chmod 0644 "$config.tmp"
    mv "$config.tmp" "$config"
    systemctl enable --now dnf-automatic.timer
    systemctl list-timers dnf-automatic.timer --no-pager
    printf 'DNF-AUTOMATIC=ACTIF type=security exclusions="%s"\n' "$excluded"
    ;;
  --remove)
    systemctl disable --now dnf-automatic.timer || true
    if [[ -f $config.iceforge-orig ]]; then
      cp -p "$config.iceforge-orig" "$config"
    fi
    printf 'DNF-AUTOMATIC=INACTIF\n'
    ;;
  *)
    usage; exit 2 ;;
esac
