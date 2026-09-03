#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
BACKUP_ARCHIVE=

usage() {
  echo "Usage: $0 --verified-backup /var/backups/iceforge/iceforge-*.tar.gz.age" >&2
}
while (($#)); do
  case "$1" in
    --verified-backup) BACKUP_ARCHIVE=${2:?}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
[[ $BACKUP_ARCHIVE == /var/backups/iceforge/iceforge-*.tar.gz.age ]] || { echo 'Archive invalide.' >&2; exit 1; }
[[ -f $BACKUP_ARCHIVE && ! -L $BACKUP_ARCHIVE && -f $BACKUP_ARCHIVE.sha256 && ! -L $BACKUP_ARCHIVE.sha256 ]] || {
  echo 'Archive ou checksum absent.' >&2; exit 1;
}
archive_age=$(( $(date +%s) - $(stat -c %Y "$BACKUP_ARCHIVE") ))
((archive_age >= 0 && archive_age <= 7200)) || { echo 'La sauvegarde vérifiée a plus de deux heures.' >&2; exit 1; }
(cd /var/backups/iceforge && sha256sum -c "$(basename -- "$BACKUP_ARCHIVE.sha256")")

INIT_JSON=$ROOT_DIR/.secrets/vault/prod-init.json
[[ -f $INIT_JSON && ! -L $INIT_JSON && $(stat -c %a "$INIT_JSON") == 600 ]] || { echo 'Initialisation Vault invalide.' >&2; exit 1; }
for command in docker jq openssl; do command -v "$command" >/dev/null || { echo "Commande absente: $command" >&2; exit 1; }; done

vault_token=$(jq -er '.root_token | strings | select(length > 0)' "$INIT_JSON")
vault_json() {
  docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN="$vault_token" \
    iceforge_vault vault kv get -format=json "$1" | jq -ce '.data.data'
}
vault_put() {
  local path=$1 payload=$2
  printf '%s' "$payload" | docker exec -i \
    -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN="$vault_token" \
    iceforge_vault vault kv put "$path" - >/dev/null
}
change_rabbit_password() {
  printf '%s\n%s\n' "$1" "$2" | docker exec -i iceforge_rabbitmq sh -ceu '
    IFS= read -r username
    IFS= read -r password
    exec rabbitmqctl change_password "$username" "$password"
  ' >/dev/null
}

backend_original=$(vault_json secret/iceforge/prod/backend)
bot_original=$(vault_json secret/iceforge/prod/bot)
rabbit_user=$(jq -er '."spring.rabbitmq.username"' <<<"$backend_original")
bot_user=$(jq -er '.RABBITMQ_USER' <<<"$bot_original")
old_password=$(jq -er '."spring.rabbitmq.password"' <<<"$backend_original")
bot_old_password=$(jq -er '.RABBITMQ_PSWD' <<<"$bot_original")
[[ $rabbit_user == "$bot_user" && $old_password == "$bot_old_password" ]] || { echo 'Vault backend/bot incohérent.' >&2; exit 1; }

new_password=$(openssl rand -base64 48 | tr -d '\r\n' | tr '+/' '-_')
[[ ${#new_password} -ge 48 && $new_password != "$old_password" ]] || { echo 'Génération du secret refusée.' >&2; exit 1; }
backend_new=$({ printf '%s\n%s\n' "$backend_original" "$new_password"; } | jq -Rn '[inputs] as $v | ($v[0]|fromjson) + {("spring.rabbitmq.password"):$v[1]}')
bot_new=$({ printf '%s\n%s\n' "$bot_original" "$new_password"; } | jq -Rn '[inputs] as $v | ($v[0]|fromjson) + {RABBITMQ_PSWD:$v[1]}')

BACKEND_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_backend)
BOT_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_bot)
FRONTEND_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_frontend)
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE
compose=(docker compose --project-name iceforge --env-file "$ROOT_DIR/.env" --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$ROOT_DIR/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "$ROOT_DIR/ops/bot-rollout/docker-compose.bot-amqp-redaction.yml"
  -f "$ROOT_DIR/ops/backend-rollout/docker-compose.backend-java25.yml"
  -f "$ROOT_DIR/ops/frontend-rollout/docker-compose.frontend-angular22.yml")

changed=0
rollback() {
  status=$?
  trap - ERR
  if ((changed)); then
    change_rabbit_password "$rabbit_user" "$old_password" || true
    vault_put secret/iceforge/prod/backend "$backend_original" || true
    vault_put secret/iceforge/prod/bot "$bot_original" || true
    "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend bot || true
  fi
  echo 'Rotation RabbitMQ en échec; restauration de l’état précédent demandée.' >&2
  exit "$status"
}
cleanup() {
  unset vault_token old_password bot_old_password new_password backend_original bot_original backend_new bot_new
}
trap cleanup EXIT
trap rollback ERR

change_rabbit_password "$rabbit_user" "$new_password"
changed=1
vault_put secret/iceforge/prod/backend "$backend_new"
vault_put secret/iceforge/prod/bot "$bot_new"
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend
BACKEND_ROLLOUT_DIR=$ROOT_DIR/ops/backend-rollout "$ROOT_DIR/ops/backend-rollout/verify.sh" runtime
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait bot
BOT_ROLLOUT_DIR=$ROOT_DIR/ops/bot-rollout "$ROOT_DIR/ops/bot-rollout/verify.sh" runtime

trap - ERR
echo RABBITMQ_PASSWORD_ROTATION=OK
