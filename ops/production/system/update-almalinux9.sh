#!/usr/bin/env bash
set -euo pipefail

MODE=check
VERIFIED_BACKUP=
DISABLE_UNUSED_RPCBIND=false
REBOOT=false

usage() {
  cat >&2 <<'EOF'
Usage:
  update-almalinux9.sh --check
  update-almalinux9.sh --apply --verified-backup /var/backups/iceforge/iceforge-*.tar.gz.age \
    [--disable-unused-rpcbind] [--reboot]

Le mode --apply exige une sauvegarde chiffrée dont le fichier .sha256 est
présent et valide. Le script ne modifie ni Vault ni la configuration SSH.
EOF
}

while (($#)); do
  case "$1" in
    --check) MODE=check; shift ;;
    --apply) MODE=apply; shift ;;
    --verified-backup) VERIFIED_BACKUP=${2:?}; shift 2 ;;
    --disable-unused-rpcbind) DISABLE_UNUSED_RPCBIND=true; shift ;;
    --reboot) REBOOT=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
[[ -r /etc/os-release ]] || { echo '/etc/os-release est absent.' >&2; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ ${ID:-} == almalinux && ${VERSION_ID%%.*} == 9 ]] || {
  echo "AlmaLinux 9 requis, système détecté: ${PRETTY_NAME:-inconnu}" >&2
  exit 1
}
for command in dnf docker jq systemctl; do
  command -v "$command" >/dev/null 2>&1 || { echo "Commande absente: $command" >&2; exit 1; }
done

printf 'SYSTEM=%s\n' "$PRETTY_NAME"
printf 'KERNEL=%s\n' "$(uname -r)"
printf 'CONTAINERS_RUNNING=%s\n' "$(docker ps -q | wc -l)"
dnf -q check-update --security || status=$?
[[ ${status:-0} == 0 || ${status:-0} == 100 ]] || exit "${status}"

if [[ $MODE == check ]]; then
  printf 'UPDATE_MODE=CHECK_ONLY\n'
  exit 0
fi

[[ -n $VERIFIED_BACKUP && -f $VERIFIED_BACKUP && ! -L $VERIFIED_BACKUP ]] || {
  echo 'Une sauvegarde chiffrée existante est requise avec --verified-backup.' >&2
  exit 1
}
checksum=$VERIFIED_BACKUP.sha256
[[ -f $checksum && ! -L $checksum ]] || { echo "Checksum absent: $checksum" >&2; exit 1; }
(cd "$(dirname -- "$VERIFIED_BACKUP")" && sha256sum -c "$(basename -- "$checksum")")

if $DISABLE_UNUSED_RPCBIND; then
  if findmnt -rn -t nfs,nfs4 | grep -q . || systemctl is-active --quiet nfs-server; then
    echo 'rpcbind conservé : un montage ou serveur NFS est actif.' >&2
    exit 1
  fi
  systemctl disable --now rpcbind.socket rpcbind.service
  systemctl mask rpcbind.socket rpcbind.service
fi

dnf -y upgrade --refresh
systemctl reset-failed 'iceforge-predeploy-backup-*.service' || true

docker ps --format '{{.Names}} {{.Status}}'
if docker inspect iceforge_vault >/dev/null 2>&1; then
  vault_status=$(docker exec -e VAULT_ADDR=http://127.0.0.1:8200 \
    iceforge_vault vault status -format=json 2>/dev/null || true)
  if [[ $(jq -r '.sealed // true' <<<"$vault_status" 2>/dev/null || printf true) == true ]]; then
    cat >&2 <<'EOF'
Vault est scellé après le redémarrage de Docker. Déverrouillez-le avec la
procédure opérateur puis vérifiez le backend et le bot. Le script n'utilise
jamais automatiquement la clé de déverrouillage.
EOF
    exit 3
  fi
fi

for service in iceforge_backend iceforge_bot iceforge_frontend; do
  state=$(docker inspect -f \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$service" 2>/dev/null || true)
  [[ $state == healthy || $state == running ]] || {
    echo "Service de production non sain après maintenance: $service ($state)" >&2
    exit 4
  }
done

if command -v needs-restarting >/dev/null 2>&1; then
  needs-restarting -r || printf 'REBOOT_REQUIRED=true\n'
fi

if $REBOOT; then
  systemctl reboot
else
  printf 'REBOOT_REQUESTED=false\n'
fi
