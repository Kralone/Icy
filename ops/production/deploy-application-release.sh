#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
REVISION=
AGE_RECIPIENT=
BACKUP_ARCHIVE=
PREFLIGHT_ONLY=0

usage() {
  echo "Usage: $0 --revision <git-sha> [--age-recipient 'age1...'|\"ssh-ed25519 AAAA...\"] [--verified-backup /var/backups/iceforge/iceforge-*.tar.gz.age] [--preflight]" >&2
}

while (($#)); do
  case "$1" in
    --revision) REVISION=${2:?}; shift 2 ;;
    --age-recipient) AGE_RECIPIENT=${2:?}; shift 2 ;;
    --verified-backup) BACKUP_ARCHIVE=${2:?}; shift 2 ;;
    --preflight) PREFLIGHT_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
[[ $REVISION =~ ^[0-9a-f]{40}$ ]] || { echo 'Révision Git invalide.' >&2; exit 1; }
if [[ -z $BACKUP_ARCHIVE ]]; then
  [[ $AGE_RECIPIENT == age1* || $AGE_RECIPIENT == 'ssh-ed25519 '* ]] || {
    echo 'Destinataire age invalide.' >&2
    exit 1
  }
else
  [[ $BACKUP_ARCHIVE == /var/backups/iceforge/iceforge-*.tar.gz.age ]] || {
    echo 'Archive de reprise hors du répertoire autorisé.' >&2
    exit 1
  }
  [[ -f $BACKUP_ARCHIVE && ! -L $BACKUP_ARCHIVE ]] || {
    echo 'Archive de reprise absente ou invalide.' >&2
    exit 1
  }
  [[ -f $BACKUP_ARCHIVE.sha256 && ! -L $BACKUP_ARCHIVE.sha256 ]] || {
    echo 'Checksum de reprise absent ou invalide.' >&2
    exit 1
  }
  archive_age=$(( $(date +%s) - $(stat -c %Y "$BACKUP_ARCHIVE") ))
  ((archive_age >= 0 && archive_age <= 7200)) || {
    echo "Archive de reprise trop ancienne: ${archive_age}s." >&2
    exit 1
  }
  (cd /var/backups/iceforge && sha256sum -c "$(basename -- "$BACKUP_ARCHIVE.sha256")")
fi

BACKEND_IMAGE="iceforge/backend:${REVISION}"
BOT_IMAGE="iceforge/bot:${REVISION}"
FRONTEND_IMAGE="iceforge/frontend:${REVISION}"
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE

NETWORK_DIR=$ROOT_DIR/ops/network-hardening
BACKEND_DIR=$ROOT_DIR/ops/backend-rollout
BOT_DIR=$ROOT_DIR/ops/bot-rollout
FRONTEND_DIR=$ROOT_DIR/ops/frontend-rollout

required_files=(
  "$ROOT_DIR/.env"
  "$ROOT_DIR/.secrets/vault/compose.prod.env"
  "$ROOT_DIR/docker-compose.yml"
  "$ROOT_DIR/docker-compose.vault.yml"
  "$NETWORK_DIR/docker-compose.network-hardening.yml"
  "$BACKEND_DIR/docker-compose.backend-java25.yml"
  "$BACKEND_DIR/verify-v29-admin-readiness.sql"
  "$BACKEND_DIR/verify-v30-readiness.sql"
  "$BACKEND_DIR/verify-flyway-v30.sql"
  "$BOT_DIR/docker-compose.bot-amqp-redaction.yml"
  "$FRONTEND_DIR/docker-compose.frontend-angular22.yml"
  "$ROOT_DIR/ops/production/backup-before-deploy.sh"
)
for file in "${required_files[@]}"; do
  [[ -f $file && ! -L $file ]] || { echo "Fichier requis absent ou invalide: $file" >&2; exit 1; }
done
for image in "$BACKEND_IMAGE" "$BOT_IMAGE" "$FRONTEND_IMAGE"; do
  docker image inspect "$image" >/dev/null || { echo "Image candidate absente: $image" >&2; exit 1; }
done

compose=(
  docker compose --project-name iceforge
  --env-file "$ROOT_DIR/.env"
  --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml"
  -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$NETWORK_DIR/docker-compose.network-hardening.yml"
  -f "$BOT_DIR/docker-compose.bot-amqp-redaction.yml"
  -f "$BACKEND_DIR/docker-compose.backend-java25.yml"
  -f "$FRONTEND_DIR/docker-compose.frontend-angular22.yml"
)

db_psql() {
  docker exec -i iceforge_db sh -ceu \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' -- "$@"
}

"${compose[@]}" config --quiet
BACKEND_ROLLOUT_DIR=$BACKEND_DIR "$BACKEND_DIR/verify.sh" config
BOT_ROLLOUT_DIR=$BOT_DIR "$BOT_DIR/verify.sh" config
FRONTEND_ROLLOUT_DIR=$FRONTEND_DIR "$FRONTEND_DIR/verify.sh" config

current_version=$(db_psql -Atc \
  'SELECT max(version::integer) FROM public.flyway_schema_history WHERE success')
case "$current_version" in
  28)
    { echo 'BEGIN TRANSACTION READ ONLY;'; cat "$BACKEND_DIR/verify-v29-admin-readiness.sql"; echo 'ROLLBACK;'; } | db_psql >/dev/null
    db_psql <"$BACKEND_DIR/verify-v30-readiness.sql" >/dev/null
    ;;
  29)
    db_psql <"$BACKEND_DIR/verify-v30-readiness.sql" >/dev/null
    ;;
  30)
    db_psql <"$BACKEND_DIR/verify-flyway-v30.sql" >/dev/null
    ;;
  *) echo "Version Flyway de production refusée: $current_version" >&2; exit 1 ;;
esac

if ((PREFLIGHT_ONLY)); then
  printf 'PRODUCTION-APPLICATION-PREFLIGHT=OK revision=%s flyway=%s\n' "$REVISION" "$current_version"
  exit 0
fi

declare -A previous
for service in backend bot frontend; do
  previous[$service]=$(docker inspect --format '{{.Config.Image}}' "iceforge_${service}")
done

rollback_file=$(mktemp /var/backups/iceforge/application-rollback.XXXXXX)
chmod 0600 "$rollback_file"
printf 'BACKEND_IMAGE=%q\nBOT_IMAGE=%q\nFRONTEND_IMAGE=%q\n' \
  "${previous[backend]}" "${previous[bot]}" "${previous[frontend]}" >"$rollback_file"

rollback() {
  local status=$?
  trap - ERR
  echo "Déploiement en échec; restauration des trois images applicatives précédentes." >&2
  export BACKEND_IMAGE=${previous[backend]} BOT_IMAGE=${previous[bot]} FRONTEND_IMAGE=${previous[frontend]}
  "${compose[@]}" up -d --no-deps --no-build --pull never --wait backend bot frontend || true
  echo "Rollback applicatif demandé; vérifier immédiatement les services. État: $rollback_file" >&2
  exit "$status"
}

if [[ -n $BACKUP_ARCHIVE ]]; then
  printf 'PREDEPLOY-BACKUP=REUSED archive=%s age_seconds=%s\n' "$BACKUP_ARCHIVE" "$archive_age"
else
  "$ROOT_DIR/ops/production/backup-before-deploy.sh" --age-recipient "$AGE_RECIPIENT"
fi
trap rollback ERR

"${compose[@]}" up -d --no-deps --no-build --pull never --wait backend
BACKEND_ROLLOUT_DIR=$BACKEND_DIR "$BACKEND_DIR/verify.sh" runtime
"${compose[@]}" up -d --no-deps --no-build --pull never --wait bot
BOT_ROLLOUT_DIR=$BOT_DIR "$BOT_DIR/verify.sh" runtime
"${compose[@]}" up -d --no-deps --no-build --pull never --wait frontend
FRONTEND_ROLLOUT_DIR=$FRONTEND_DIR "$FRONTEND_DIR/verify.sh" runtime

trap - ERR
printf 'PRODUCTION-APPLICATION-DEPLOY=OK revision=%s rollback=%s\n' "$REVISION" "$rollback_file"
