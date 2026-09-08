#!/usr/bin/env bash
set -euo pipefail

source_project=${ICEFORGE_SOURCE_PROJECT:-iceforge}
target_project=${ICEFORGE_TARGET_PROJECT:-iceforge_staging}
backup_dir=${ICEFORGE_STAGING_CATALOG_BACKUP_DIR:-/var/backups/iceforge-staging/catalog}

[[ $source_project != "$target_project" ]] || { echo "Les projets source et cible doivent etre distincts" >&2; exit 1; }

find_db_container() {
  local project=$1
  local container
  container=$(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter 'label=com.docker.compose.service=db')
  [[ -n $container ]] || { echo "PostgreSQL introuvable pour le projet $project" >&2; exit 1; }
  [[ $(wc -w <<<"$container") -eq 1 ]] || { echo "Plusieurs PostgreSQL trouves pour $project" >&2; exit 1; }
  printf '%s' "$container"
}

db_query() {
  local container=$1
  local query=$2
  docker exec "$container" sh -ceu \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' \
    sh "$query"
}

catalog_counts() {
  local container=$1
  db_query "$container" "SELECT
      (SELECT COUNT(*) FROM catalog.sync_runs) || '|' ||
      (SELECT COUNT(*) FROM catalog.raw_records) || '|' ||
      (SELECT COUNT(*) FROM catalog.entries) || '|' ||
      (SELECT COUNT(*) FROM catalog.offers);"
}

source_db=$(find_db_container "$source_project")
target_db=$(find_db_container "$target_project")
[[ $source_db != "$target_db" ]] || { echo "La source et la cible designent le meme conteneur" >&2; exit 1; }

source_version=$(db_query "$source_db" "SELECT COALESCE(MAX(installed_rank), 0) FROM public.flyway_schema_history WHERE success;")
target_version=$(db_query "$target_db" "SELECT COALESCE(MAX(installed_rank), 0) FROM public.flyway_schema_history WHERE success;")
[[ $source_version == "$target_version" ]] || {
  echo "Versions Flyway incompatibles: production=$source_version staging=$target_version" >&2
  exit 1
}

source_counts=$(catalog_counts "$source_db")
[[ $source_counts != '0|0|0|0' ]] || { echo "Le catalogue de production est vide" >&2; exit 1; }

install -d -m 0700 "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/staging-catalog-before-$timestamp.sql.gz"
work_dir=$(mktemp -d /run/iceforge-catalog-copy.XXXXXX)
trap 'rm -rf -- "$work_dir"' EXIT
production_dump="$work_dir/production-catalog.sql"

docker exec "$target_db" sh -ceu \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --schema=catalog --no-owner --no-privileges' \
  | gzip -9 >"$backup_file"
chmod 0600 "$backup_file"

docker exec "$source_db" sh -ceu \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --schema=catalog --no-owner --no-privileges' \
  >"$production_dump"

{
  printf '%s\n' '\set ON_ERROR_STOP on' 'BEGIN;'
  printf '%s\n' 'TRUNCATE TABLE catalog.offers, catalog.entries, catalog.raw_records, catalog.sync_runs RESTART IDENTITY CASCADE;'
  cat "$production_dump"
  printf '%s\n' 'COMMIT;'
} | docker exec -i "$target_db" sh -ceu \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

target_counts=$(catalog_counts "$target_db")
[[ $target_counts == "$source_counts" ]] || {
  echo "Volumes differents apres copie: production=$source_counts staging=$target_counts" >&2
  exit 1
}

active_vehicles=$(db_query "$target_db" "SELECT COUNT(*) FROM catalog.entries WHERE active AND family IN ('SHIP', 'GROUND_VEHICLE');")
[[ $active_vehicles -gt 0 ]] || { echo "Aucun vehicule actif apres copie" >&2; exit 1; }

echo "CATALOG-COPY=OK flyway=$source_version counts=$target_counts active_vehicles=$active_vehicles"
echo "BACKUP=$backup_file"
