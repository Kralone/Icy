#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
trap 'log "ERREUR interne ligne $LINENO"' ERR

usage() {
  cat >&2 <<'EOF'
Usage: provision-vault-snapshot-token.sh --output-file /run/token -- [options docker compose]

Lit un token Vault administrateur sur stdin, crée ou remplace uniquement la
politique iceforge-backup-snapshot, puis écrit un token orphelin valable 30
minutes dans un fichier 0600. Le token administrateur n'est jamais affiché ni
écrit sur le disque.

Exemple de saisie interactive :
  read -rsp 'Token Vault admin: ' ADMIN_TOKEN; printf '\n'
  printf '%s\n' "$ADMIN_TOKEN" | provision-vault-snapshot-token.sh ...
  unset ADMIN_TOKEN
EOF
}

OUTPUT_FILE=
while (($#)); do
  case "$1" in
    --output-file) OUTPUT_FILE=${2:?}; shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_FILE" ]] || die "--output-file est requis"
# La variable est lue par compose() depuis lib.sh.
# shellcheck disable=SC2034
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command awk
require_command tr
acquire_backup_lock
[[ "$OUTPUT_FILE" = /* && "$OUTPUT_FILE" != "/" && ! -L "$OUTPUT_FILE" ]] || die "fichier de sortie invalide"
output_dir=$(dirname -- "$OUTPUT_FILE")
require_absolute_dir "$output_dir"
require_new_artifact "$OUTPUT_FILE"

admin_token=$(awk 'NR == 1 { print } NR > 1 { extra=1 } END { if (extra) exit 2 }') ||
  die "le token administrateur doit contenir exactement une ligne"
admin_token=${admin_token%$'\r'}
[[ "$admin_token" =~ ^[^[:space:][:cntrl:]]+$ ]] || die "token administrateur vide ou invalide"

cid=$(service_container vault)
partial="$OUTPUT_FILE.partial.$$"
completed=false
cleanup() {
  if [[ "$completed" != true && -s "$partial" ]]; then
    docker exec -i "$cid" sh -ceu '
      IFS= read -r VAULT_TOKEN
      export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
      vault token revoke -self >/dev/null 2>&1 || true
    ' <"$partial" >/dev/null 2>&1 || true
  fi
  rm -f -- "$partial"
}
trap cleanup EXIT

printf '%s\n' "$admin_token" | docker exec -i "$cid" sh -ceu '
  IFS= read -r VAULT_TOKEN
  VAULT_TOKEN=$(printf %s "$VAULT_TOKEN" | tr -d "\r")
  export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
  vault policy write iceforge-backup-snapshot - >/dev/null <<"HCL"
path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
HCL
  vault token create \
    -orphan \
    -policy=iceforge-backup-snapshot \
    -ttl=30m \
    -explicit-max-ttl=30m \
    -display-name=iceforge-backup-snapshot-once \
    -field=token
' >"$partial"
unset admin_token

snapshot_token=$(tr -d '\r' <"$partial")
[[ "$snapshot_token" =~ ^[^[:space:][:cntrl:]]+$ ]] || die "token de snapshot invalide"
printf '%s\n' "$snapshot_token" >"$partial"
unset snapshot_token
chmod 600 -- "$partial"
[[ "$(awk 'END { print NR }' "$partial")" == "1" ]] || die "token de snapshot inattendu"
snapshot_caps=$(docker exec -i "$cid" sh -ceu '
  IFS= read -r VAULT_TOKEN
  export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
  vault token capabilities sys/storage/raft/snapshot
' <"$partial")
[[ "$snapshot_caps" == "read" ]] || die "le token créé n'a pas uniquement la capacité read attendue"

mv -- "$partial" "$OUTPUT_FILE"
completed=true
log "token Vault de snapshot créé pour 30 minutes"
