#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=/root/iceforge
BACKUP_DIR=/var/backups/iceforge
RUNTIME_DIR=/run/iceforge-backup
TOKEN_FILE=$RUNTIME_DIR/vault-snapshot.token
RECOVERY_LIST=${ICEFORGE_RECOVERY_LIST:-$ROOT_DIR/.secrets/vault/recovery-files}
INIT_JSON=$ROOT_DIR/.secrets/vault/prod-init.json
AGE_RECIPIENT=

usage() {
  echo "Usage: backup-before-deploy.sh --age-recipient 'age1...'|\"ssh-ed25519 AAAA...\"" >&2
}

while (($#)); do
  case "$1" in
    --age-recipient) AGE_RECIPIENT=${2:?}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
[[ $AGE_RECIPIENT == age1* || $AGE_RECIPIENT == 'ssh-ed25519 '* ]] || {
  echo 'Destinataire age invalide.' >&2
  exit 1
}
for command in docker jq age sha256sum mktemp; do
  command -v "$command" >/dev/null || { echo "Commande requise absente: $command" >&2; exit 1; }
done
for file in "$INIT_JSON" "$RECOVERY_LIST" "$ROOT_DIR/ops/backups/backup-all.sh" \
  "$ROOT_DIR/ops/backups/provision-vault-snapshot-token.sh"; do
  [[ -f $file && ! -L $file ]] || { echo "Fichier requis absent ou invalide: $file" >&2; exit 1; }
done
[[ $(stat -c %a "$INIT_JSON") == 600 ]] || { echo "$INIT_JSON doit être en mode 0600." >&2; exit 1; }
[[ ! -e $TOKEN_FILE ]] || { echo "Token temporaire déjà présent: $TOKEN_FILE" >&2; exit 1; }

running_image() {
  local service=$1
  local ids image
  mapfile -t ids < <(docker ps -q \
    --filter 'label=com.docker.compose.project=iceforge' \
    --filter "label=com.docker.compose.service=$service")
  [[ ${#ids[@]} -eq 1 ]] || {
    echo "Impossible d'identifier l'unique conteneur de production: $service" >&2
    exit 1
  }
  image=$(docker inspect -f '{{.Config.Image}}' "${ids[0]}")
  [[ -n $image ]] || { echo "Image active introuvable: $service" >&2; exit 1; }
  printf '%s' "$image"
}

# Les anciens rollouts exigeaient ces variables dans le shell appelant. Une
# sauvegarde autonome doit figer les images réellement exécutées sans dépendre
# de l'historique de la session administrateur.
export BACKEND_IMAGE=${BACKEND_IMAGE:-$(running_image backend)}
export BOT_IMAGE=${BOT_IMAGE:-$(running_image bot)}
export FRONTEND_IMAGE=${FRONTEND_IMAGE:-$(running_image frontend)}
source "$ROOT_DIR/ops/stateful/load-runtime.sh"
load_stateful_runtime "$ROOT_DIR"

compose=(
  docker compose
  --project-name iceforge
  --env-file "$ROOT_DIR/.env"
  --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml"
  -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$ROOT_DIR/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "$ROOT_DIR/ops/bot-rollout/docker-compose.bot-amqp-redaction.yml"
  -f "$ROOT_DIR/ops/backend-rollout/docker-compose.backend-java25.yml"
  -f "$ROOT_DIR/ops/frontend-rollout/docker-compose.frontend-angular22.yml"
  "${STATEFUL_COMPOSE_ARGS[@]}"
)

cleanup() {
  if [[ -f $TOKEN_FILE && ! -L $TOKEN_FILE ]]; then
    vault_cid=$("${compose[@]}" ps -q vault 2>/dev/null || true)
    if [[ -n $vault_cid ]]; then
      docker exec -i "$vault_cid" sh -ceu '
        IFS= read -r VAULT_TOKEN
        export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
        vault token revoke -self >/dev/null
      ' <"$TOKEN_FILE" >/dev/null 2>&1 || true
    fi
    rm -f -- "$TOKEN_FILE"
  fi
  [[ -z ${marker:-} || ! -f $marker ]] || rm -f -- "$marker"
}
trap cleanup EXIT

install -d -o root -g root -m 0700 "$RUNTIME_DIR" "$BACKUP_DIR"
"${compose[@]}" config --quiet

# Le token administrateur ne quitte jamais le pipe local et n'est jamais affiché.
jq -er '.root_token | strings | select(length > 0)' "$INIT_JSON" |
  "$ROOT_DIR/ops/backups/provision-vault-snapshot-token.sh" \
    --output-file "$TOKEN_FILE" -- "${compose[@]:2}"

marker=$(mktemp "$RUNTIME_DIR/pre-deploy.XXXXXX")
"$ROOT_DIR/ops/backups/backup-all.sh" \
  --output-dir "$BACKUP_DIR" \
  --vault-token-file "$TOKEN_FILE" \
  --age-recipient "$AGE_RECIPIENT" \
  --offline-rabbitmq \
  --images --bot-config \
  --config-root "$ROOT_DIR" \
  --config-list "$RECOVERY_LIST" \
  --runtime-image-service db \
  --runtime-image-service rabbitmq \
  --runtime-image-service vault \
  --runtime-image-service backend \
  --runtime-image-service bot \
  --runtime-image-service frontend \
  -- "${compose[@]:2}"

mapfile -t archives < <(find "$BACKUP_DIR" -maxdepth 1 -type f \
  -name 'iceforge-*.tar.gz.age' -newer "$marker" -print)
[[ ${#archives[@]} -eq 1 ]] || { echo 'Impossible d’identifier un unique bundle récent.' >&2; exit 1; }
archive=${archives[0]}
checksum=$archive.sha256
[[ -f $checksum && ! -L $checksum ]] || { echo 'Checksum du bundle absent.' >&2; exit 1; }
(cd "$BACKUP_DIR" && sha256sum -c "$(basename -- "$checksum")")

for service in db rabbitmq vault backend bot frontend; do
  cid=$("${compose[@]}" ps -q "$service")
  [[ -n $cid ]] || { echo "Service absent après sauvegarde: $service" >&2; exit 1; }
  state=$(docker inspect -f '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
  [[ $state == true\|none || $state == true\|healthy ]] || {
    echo "Service non sain après sauvegarde: $service ($state)" >&2
    exit 1
  }
done

cleanup
trap - EXIT
printf 'PREDEPLOY-BACKUP=OK archive=%s\n' "$archive"
