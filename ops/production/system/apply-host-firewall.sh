#!/usr/bin/env bash
# Pare-feu d'entrée de l'hôte, appliqué avec retour arrière automatique.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  apply-host-firewall.sh --check     valide les règles sans rien charger
  apply-host-firewall.sh --apply     charge les règles pour 180 s ; sans --confirm, elles sont retirées
  apply-host-firewall.sh --confirm   rend les règles permanentes (service systemd au démarrage)
  apply-host-firewall.sh --remove    retire les règles et désactive le service

Après --apply, ouvrir une NOUVELLE connexion SSH avant de lancer --confirm.
USAGE
}

[[ $# -eq 1 ]] || { usage; exit 2; }
[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }

directory=$(cd -- "$(dirname -- "$0")" && pwd)
rules_source=$directory/host-firewall.nft
unit_source=$directory/iceforge-host-firewall.service
rules_target=/etc/iceforge/host-firewall.nft
unit_target=/etc/systemd/system/iceforge-host-firewall.service
rollback_unit=iceforge-host-firewall-rollback
rollback_delay=180

for command in nft systemctl systemd-run ss; do
  command -v "$command" >/dev/null 2>&1 || { echo "Commande absente: $command" >&2; exit 1; }
done
[[ -f $rules_source && -f $unit_source ]] || { echo 'Fichiers de règles absents.' >&2; exit 1; }

preflight() {
  nft -c -f "$rules_source"
  if systemctl is-active --quiet firewalld; then
    echo 'firewalld est actif : arrêt, les deux pare-feu ne doivent pas coexister.' >&2
    exit 1
  fi
  # Toute écoute publique hors 22/80/443 serait coupée : la signaler avant.
  local unexpected
  unexpected=$(ss -H -tuln | awk '{print $5}' |
    grep -Ev '^(127\.|\[::1\]|::1)' |
    grep -Ev '[:.](22|80|443)$' || true)
  if [[ -n $unexpected ]]; then
    printf 'ECOUTE-PUBLIQUE-HORS-REGLES=%s\n' "$(tr '\n' ' ' <<<"$unexpected")"
  fi
  printf 'NFT-CHECK=OK\n'
}

case "$1" in
  --check)
    preflight
    ;;
  --apply)
    preflight
    systemctl stop "$rollback_unit.timer" 2>/dev/null || true
    systemctl reset-failed "$rollback_unit.service" "$rollback_unit.timer" 2>/dev/null || true
    # Le retour arrière est programmé AVANT le chargement des règles.
    systemd-run --unit="$rollback_unit" --on-active="$rollback_delay" \
      /usr/sbin/nft delete table inet iceforge_host
    nft -f "$rules_source"
    printf 'HOST-FIREWALL=TEMPORAIRE retrait_auto_dans=%ss\n' "$rollback_delay"
    echo 'Ouvrir une nouvelle session SSH, vérifier le site, puis lancer --confirm.'
    ;;
  --confirm)
    nft list table inet iceforge_host >/dev/null 2>&1 || {
      echo 'Règles non chargées (délai dépassé ?) : relancer --apply.' >&2; exit 1;
    }
    install -d -m 0755 /etc/iceforge
    install -m 0644 "$rules_source" "$rules_target"
    install -m 0644 "$unit_source" "$unit_target"
    systemctl daemon-reload
    systemctl enable iceforge-host-firewall.service
    systemctl start iceforge-host-firewall.service
    systemctl stop "$rollback_unit.timer" 2>/dev/null || true
    nft list table inet iceforge_host >/dev/null
    printf 'HOST-FIREWALL=PERMANENT\n'
    ;;
  --remove)
    systemctl stop "$rollback_unit.timer" 2>/dev/null || true
    if [[ -f $unit_target ]]; then
      systemctl disable --now iceforge-host-firewall.service || true
    fi
    nft delete table inet iceforge_host 2>/dev/null || true
    printf 'HOST-FIREWALL=RETIRE\n'
    ;;
  *)
    usage; exit 2 ;;
esac
