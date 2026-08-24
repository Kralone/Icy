#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: vault.sh --output-dir /chemin/absolu --vault-token-file /run/token -- [options docker compose]

Le token doit être un token court dédié au snapshot et stocké dans un fichier 0600.
Il n'est écrit ni dans le bundle, ni dans la ligne de commande Docker, ni dans stdout.
EOF
}

OUTPUT_DIR=
TOKEN_FILE=
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --vault-token-file) TOKEN_FILE=${2:?}; shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir est requis"
[[ -n "$TOKEN_FILE" ]] || die "--vault-token-file est requis"
# La variable est lue par compose() depuis lib.sh.
# shellcheck disable=SC2034
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command sha256sum
require_command awk
acquire_backup_lock
require_absolute_dir "$OUTPUT_DIR"
require_regular_file_0600 "$TOKEN_FILE"
[[ "$(awk 'END { print NR }' "$TOKEN_FILE")" == "1" ]] || die "le fichier token Vault doit contenir exactement une ligne"

cid=$(service_container vault)
snapshot_file="$OUTPUT_DIR/vault-raft.snap"
inventory_file="$OUTPUT_DIR/vault-inventory.txt"
require_new_artifact "$snapshot_file"
require_new_artifact "$inventory_file"

completed=false
cleanup() {
  if [[ "$completed" != true ]]; then
    remove_checksum_entries "$OUTPUT_DIR" "$snapshot_file" "$inventory_file"
    rm -f -- "$snapshot_file" "$inventory_file"
  fi
}
trap cleanup EXIT

log "création du snapshot Raft Vault"
docker exec -i "$cid" sh -ceu '
  IFS= read -r VAULT_TOKEN || test -n "$VAULT_TOKEN"
  VAULT_TOKEN=$(printf %s "$VAULT_TOKEN" | tr -d "\r")
  case "$VAULT_TOKEN" in
    ""|*[![:graph:]]*) echo "token Vault vide ou contenant un caractère de contrôle" >&2; exit 2 ;;
  esac
  export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
  vault operator raft snapshot save /dev/stdout
' <"$TOKEN_FILE" >"$snapshot_file"
chmod 600 -- "$snapshot_file"

vault_image_id=$(docker inspect -f '{{.Image}}' "$cid")
if [[ -n "${ICEFORGE_BACKUP_DOCKER_OUTPUT_VOLUME:-}" ]]; then
  volume=$ICEFORGE_BACKUP_DOCKER_OUTPUT_VOLUME
  mount_root=${ICEFORGE_BACKUP_DOCKER_OUTPUT_ROOT:-/backup}
  [[ "$volume" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die "nom de volume de répétition invalide"
  [[ "$OUTPUT_DIR" == "$mount_root" || "$OUTPUT_DIR" == "$mount_root/"* ]] || die "la sortie doit rester sous $mount_root"
  relative_dir=${OUTPUT_DIR#"$mount_root"}
  docker run --rm --network none --read-only \
    --mount "type=volume,source=$volume,target=/backup,readonly" \
    --entrypoint vault "$vault_image_id" \
    operator raft snapshot inspect "/backup$relative_dir/$(basename -- "$snapshot_file")" >"$inventory_file"
else
  docker run --rm --network none --read-only \
    --mount "type=bind,source=$OUTPUT_DIR,target=/backup,readonly" \
    --entrypoint vault "$vault_image_id" \
    operator raft snapshot inspect "/backup/$(basename -- "$snapshot_file")" >"$inventory_file"
fi
chmod 600 -- "$inventory_file"
write_checksum "$snapshot_file"
write_checksum "$inventory_file"

completed=true
log "snapshot Vault terminé"
