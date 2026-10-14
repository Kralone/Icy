#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
REVISION=
AGE_RECIPIENT=
PREFLIGHT_ONLY=0
FRESH_BACKUP=0
# Une archive complète de moins de 7 jours est réutilisée : voir select-predeploy-backup.sh.
MAX_BACKUP_AGE_DAYS=7
# Flyway version this release must reach. V39 to V43 are applied by the backend at startup.
TARGET_FLYWAY_VERSION=43

usage() {
  echo "Usage: $0 --revision <git-sha> --age-recipient 'age1...'|\"ssh-ed25519 AAAA...\" [--fresh-backup] [--preflight]" >&2
}

while (($#)); do
  case "$1" in
    --revision) REVISION=${2:?}; shift 2 ;;
    --age-recipient) AGE_RECIPIENT=${2:?}; shift 2 ;;
    --fresh-backup) FRESH_BACKUP=1; shift ;;
    --preflight) PREFLIGHT_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
[[ $REVISION =~ ^[0-9a-f]{40}$ ]] || { echo 'Révision Git invalide.' >&2; exit 1; }
# Le destinataire vérifie qu'une archive réutilisée lui est bien chiffrée, et chiffre une nouvelle sauvegarde.
[[ $AGE_RECIPIENT == age1* || $AGE_RECIPIENT == 'ssh-ed25519 '* ]] || {
  echo 'Destinataire age invalide.' >&2
  exit 1
}

BACKEND_IMAGE="iceforge/backend:${REVISION}"
BOT_IMAGE="iceforge/bot:${REVISION}"
FRONTEND_IMAGE="iceforge/frontend:${REVISION}"
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE

NETWORK_DIR=$ROOT_DIR/ops/network-hardening
BACKEND_DIR=$ROOT_DIR/ops/backend-rollout
BOT_DIR=$ROOT_DIR/ops/bot-rollout
FRONTEND_DIR=$ROOT_DIR/ops/frontend-rollout
source "$ROOT_DIR/ops/stateful/load-runtime.sh"
load_stateful_runtime "$ROOT_DIR"

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
  "$BACKEND_DIR/verify-flyway-v31.sql"
  "$BACKEND_DIR/verify-flyway-v32.sql"
  "$BACKEND_DIR/verify-flyway-v33.sql"
  "$BACKEND_DIR/verify-flyway-v38-checksums.sql"
  "$BACKEND_DIR/verify-flyway-v43.sql"
  "$BOT_DIR/docker-compose.bot-amqp-redaction.yml"
  "$FRONTEND_DIR/docker-compose.frontend-angular22.yml"
  "$ROOT_DIR/ops/production/backup-before-deploy.sh"
  "$ROOT_DIR/ops/production/select-predeploy-backup.sh"
)
for file in "${required_files[@]}"; do
  [[ -f $file && ! -L $file ]] || { echo "Fichier requis absent ou invalide: $file" >&2; exit 1; }
done
# An older copy of the checks must never stand in for the ones this release was tested with.
grep -Fq 'EXPECTED_FLYWAY_VERSION' "$BACKEND_DIR/verify.sh"   || { echo 'verify.sh du backend trop ancien pour cette release.' >&2; exit 1; }
grep -Fq 'generate_series(1, 38)' "$BACKEND_DIR/verify-flyway-v33.sql"   || { echo 'verify-flyway-v33.sql trop ancien: il doit controler V1-V38.' >&2; exit 1; }
grep -Fq 'FLYWAY_V43_PRODUCTION_OK' "$BACKEND_DIR/verify-flyway-v43.sql"   || { echo 'verify-flyway-v43.sql invalide.' >&2; exit 1; }
grep -Fq 'FLYWAY_V38_CHECKSUMS_OK' "$BACKEND_DIR/verify-flyway-v38-checksums.sql"   || { echo 'verify-flyway-v38-checksums.sql invalide.' >&2; exit 1; }
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
  "${STATEFUL_COMPOSE_ARGS[@]}"
)

db_psql() {
  docker exec -i iceforge_db sh -ceu \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' -- "$@"
}

"${compose[@]}" config --quiet
translation_image=$("${compose[@]}" config --format json | python3 -c \
  'import json,sys; print(json.load(sys.stdin)["services"]["libretranslate"]["image"])')
[[ $translation_image =~ @sha256:[0-9a-f]{64}$ ]] || {
  echo 'L’image LibreTranslate doit être épinglée par digest.' >&2
  exit 1
}
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
  31)
    db_psql <"$BACKEND_DIR/verify-flyway-v31.sql" >/dev/null
    ;;
  32)
    db_psql <"$BACKEND_DIR/verify-flyway-v32.sql" >/dev/null
    ;;
  33|34|35|36|37|38)
    db_psql <"$BACKEND_DIR/verify-flyway-v33.sql" >/dev/null
    # Flyway would refuse to start on a different history: say so before the backup and the switch.
    db_psql <"$BACKEND_DIR/verify-flyway-v38-checksums.sql" >/dev/null
    ;;
  43)
    # Release already applied: the same command can be run again.
    db_psql <"$BACKEND_DIR/verify-flyway-v43.sql" >/dev/null
    ;;
  *) echo "Version Flyway de production refusée: $current_version" >&2; exit 1 ;;
esac

# Politique de sauvegarde, décidée avant toute action et affichée dès le précontrôle.
# Date de la dernière migration appliquée : une archive plus ancienne ne contient pas le schéma actuel.
last_migration_epoch=$(db_psql -Atc \
  "SELECT coalesce(extract(epoch FROM max(installed_on) AT TIME ZONE current_setting('TimeZone'))::bigint, 0) FROM public.flyway_schema_history WHERE success")
backup_args=(--age-recipient "$AGE_RECIPIENT" --max-age-days "$MAX_BACKUP_AGE_DAYS"
  --current-version "$current_version" --target-version "$TARGET_FLYWAY_VERSION" --last-migration-epoch "$last_migration_epoch")
if ((FRESH_BACKUP)); then backup_args+=(--force-fresh); fi
backup_plan=$("$ROOT_DIR/ops/production/select-predeploy-backup.sh" "${backup_args[@]}")
[[ $backup_plan == 'BACKUP-PLAN=REUSE '* || $backup_plan == 'BACKUP-PLAN=FRESH '* ]] || {
  echo "Décision de sauvegarde illisible : $backup_plan" >&2
  exit 1
}
echo "$backup_plan"

if ((PREFLIGHT_ONLY)); then
  printf 'PRODUCTION-APPLICATION-PREFLIGHT=OK revision=%s flyway=%s\n' "$REVISION" "$current_version"
  exit 0
fi

# Preload only the pinned dependency, before backup and application changes.
# Preflight remains read-only; application images must still be preloaded.
if ! docker image inspect "$translation_image" >/dev/null 2>&1; then
  "${compose[@]}" pull libretranslate
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
  # The previous backend cannot start on a migrated database: putting it back would turn a
  # partial failure into a full outage. Once Flyway has moved, the rollback is a restore.
  local reached_version
  reached_version=$(db_psql -Atc     'SELECT max(version::integer) FROM public.flyway_schema_history WHERE success' 2>/dev/null || echo inconnue)
  if [[ $reached_version != "$current_version" ]]; then
    echo "Déploiement en échec après migration (V${current_version} -> V${reached_version})." >&2
    echo "Aucun retour automatique: l'ancien backend ne démarre pas sur la base migrée." >&2
    echo "Restaurer la sauvegarde prise avant ce déploiement, puis remettre les images consignées dans $rollback_file." >&2
    exit "$status"
  fi
  echo "Déploiement en échec; restauration des trois images applicatives précédentes." >&2
  export BACKEND_IMAGE=${previous[backend]} BOT_IMAGE=${previous[bot]} FRONTEND_IMAGE=${previous[frontend]}
  "${compose[@]}" up -d --no-deps --no-build --pull never --wait backend bot frontend || true
  echo "Rollback applicatif demandé; vérifier immédiatement les services. État: $rollback_file" >&2
  exit "$status"
}

if [[ $backup_plan == 'BACKUP-PLAN=REUSE '* ]]; then
  # Archive récente, intègre, chiffrée pour le destinataire validé et postérieure à la dernière migration : pas de nouvelle archive.
  printf 'PREDEPLOY-BACKUP=REUSED %s\n' "${backup_plan#BACKUP-PLAN=REUSE }"
else
  # Sauvegarde complète habituelle ; un échec arrête le script avant toute modification des services.
  "$ROOT_DIR/ops/production/backup-before-deploy.sh" --age-recipient "$AGE_RECIPIENT"
fi
# Application rollouts with --no-deps do not start a newly added translator.
# A translation startup failure leaves all three application images untouched.
"${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 900 libretranslate
trap rollback ERR
"${compose[@]}" up -d --no-deps --no-build --pull never --wait backend
EXPECTED_FLYWAY_VERSION=$TARGET_FLYWAY_VERSION BACKEND_ROLLOUT_DIR=$BACKEND_DIR "$BACKEND_DIR/verify.sh" runtime
"${compose[@]}" up -d --no-deps --no-build --pull never --wait bot
BOT_ROLLOUT_DIR=$BOT_DIR "$BOT_DIR/verify.sh" runtime
"${compose[@]}" up -d --no-deps --no-build --pull never --wait frontend
FRONTEND_ROLLOUT_DIR=$FRONTEND_DIR "$FRONTEND_DIR/verify.sh" runtime

trap - ERR
printf 'PRODUCTION-APPLICATION-DEPLOY=OK revision=%s rollback=%s\n' "$REVISION" "$rollback_file"


