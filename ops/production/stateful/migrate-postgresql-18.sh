#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
BACKUP_ARCHIVE=${1:-}
TARGET_VOLUME=iceforge_postgres18_data
TARGET_IMAGE='postgres:18.6-bookworm@sha256:7d2695c3aa88e792e8b3b233e7e4adb296a20412c6c0ca361e3edaaacfada108'
PG_OVERLAY=$ROOT_DIR/ops/stateful/docker-compose.postgres-stateful.yml
RABBIT_OVERLAY=$ROOT_DIR/ops/stateful/docker-compose.rabbitmq-stateful.yml
INVENTORY_SQL=$ROOT_DIR/ops/backups/postgres-inventory.sql

[[ $EUID -eq 0 ]] || { echo 'Exécution root requise.' >&2; exit 1; }
[[ $BACKUP_ARCHIVE == /var/backups/iceforge/iceforge-*.tar.gz.age ]] || { echo 'Usage: migrate-postgresql-18.sh /var/backups/iceforge/iceforge-*.tar.gz.age' >&2; exit 2; }
[[ -f $BACKUP_ARCHIVE && ! -L $BACKUP_ARCHIVE && -f $BACKUP_ARCHIVE.sha256 && ! -L $BACKUP_ARCHIVE.sha256 ]] || { echo 'Backup absent.' >&2; exit 1; }
(cd /var/backups/iceforge && sha256sum -c "$(basename -- "$BACKUP_ARCHIVE.sha256")")
archive_age=$(( $(date +%s) - $(stat -c %Y "$BACKUP_ARCHIVE") ))
((archive_age >= 0 && archive_age <= 7200)) || { echo "Backup trop ancien: ${archive_age}s." >&2; exit 1; }
for file in "$PG_OVERLAY" "$RABBIT_OVERLAY" "$INVENTORY_SQL"; do
  [[ -f $file && ! -L $file ]] || { echo "Fichier requis absent: $file" >&2; exit 1; }
done
docker image inspect "$TARGET_IMAGE" >/dev/null

old_image=$(docker inspect -f '{{.Config.Image}}' iceforge_db)
old_volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' iceforge_db)
old_mount=/var/lib/postgresql/data
[[ -n $old_volume ]] || { echo 'Volume PostgreSQL 15 source introuvable.' >&2; exit 1; }

compose_env=$ROOT_DIR/.secrets/vault/compose.prod.env
compose_env_value() {
  local key=$1
  awk -v key="$key" 'index($0, key "=") == 1 { sub("^[^=]*=", ""); print; exit }' "$compose_env"
}
backend_role_id=$(compose_env_value BACKEND_VAULT_ROLE_ID)
backend_secret_id=$(compose_env_value BACKEND_VAULT_SECRET_ID)
vault_mount=$(compose_env_value VAULT_KV_MOUNT)
backend_path=$(compose_env_value BACKEND_VAULT_KV_PATH)
[[ -n $backend_role_id && -n $backend_secret_id && -n $vault_mount && -n $backend_path ]] || { echo 'AppRole backend incomplet.' >&2; exit 1; }
login_json=$({ printf '%s\n' "$backend_role_id" "$backend_secret_id"; } | docker exec -i \
  -e VAULT_ADDR=http://127.0.0.1:8200 iceforge_vault sh -ceu '
    IFS= read -r role_id
    IFS= read -r secret_id
    exec vault write -format=json auth/approle/login role_id="$role_id" secret_id="$secret_id"
  ')
vault_token=$(jq -er '.auth.client_token' <<<"$login_json")
backend_secret=$(printf '%s\n' "$vault_token" | docker exec -i \
  -e VAULT_ADDR=http://127.0.0.1:8200 iceforge_vault sh -ceu '
    IFS= read -r VAULT_TOKEN
    export VAULT_TOKEN
    exec vault kv get -format=json "$1"
  ' sh "$vault_mount/$backend_path")
printf '%s\n' "$vault_token" | docker exec -i -e VAULT_ADDR=http://127.0.0.1:8200 \
  iceforge_vault sh -ceu 'IFS= read -r VAULT_TOKEN; export VAULT_TOKEN; vault token revoke -self >/dev/null'
POSTGRES_USER=$(jq -er '.data.data["spring.datasource.username"]' <<<"$backend_secret")
POSTGRES_PASSWORD=$(jq -er '.data.data["spring.datasource.password"]' <<<"$backend_secret")
postgres_url=$(jq -er '.data.data["spring.datasource.url"]' <<<"$backend_secret")
POSTGRES_DB=${postgres_url##*/}
POSTGRES_DB=${POSTGRES_DB%%\?*}
unset backend_role_id backend_secret_id login_json vault_token backend_secret postgres_url
[[ -n $POSTGRES_USER && -n $POSTGRES_PASSWORD && -n $POSTGRES_DB ]] || { echo 'Identifiants PostgreSQL source incomplets.' >&2; exit 1; }
case $POSTGRES_DB in postgres|template0|template1) echo 'Nom de base applicative non pris en charge.' >&2; exit 1;; esac
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
PGPASSWORD=$POSTGRES_PASSWORD
export PGPASSWORD

source_version=$(docker exec iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  psql -XAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW server_version_num"
')
[[ $source_version == 15* ]] || { echo "Version source inattendue: $source_version" >&2; exit 1; }
docker volume inspect "$TARGET_VOLUME" >/dev/null 2>&1 && { echo "Volume cible déjà présent: $TARGET_VOLUME" >&2; exit 1; }

BACKEND_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_backend)
BOT_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_bot)
FRONTEND_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_frontend)
PROD_RABBITMQ_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_rabbitmq)
PROD_RABBITMQ_HOSTNAME=$(docker inspect -f '{{.Config.Hostname}}' iceforge_rabbitmq)
PROD_RABBITMQ_VOLUME=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/rabbitmq"}}{{.Name}}{{end}}{{end}}' iceforge_rabbitmq)
[[ -n $PROD_RABBITMQ_VOLUME ]] || { echo 'Volume RabbitMQ courant introuvable.' >&2; exit 1; }
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE
export PROD_RABBITMQ_IMAGE PROD_RABBITMQ_HOSTNAME PROD_RABBITMQ_VOLUME

compose=(docker compose --project-name iceforge --env-file "$ROOT_DIR/.env" --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$ROOT_DIR/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "$ROOT_DIR/ops/bot-rollout/docker-compose.bot-amqp-redaction.yml"
  -f "$ROOT_DIR/ops/backend-rollout/docker-compose.backend-java25.yml"
  -f "$ROOT_DIR/ops/frontend-rollout/docker-compose.frontend-angular22.yml"
  -f "$RABBIT_OVERLAY" -f "$PG_OVERLAY")
export PROD_POSTGRES_IMAGE=$TARGET_IMAGE PROD_POSTGRES_VOLUME=$TARGET_VOLUME PROD_POSTGRES_MOUNT=/var/lib/postgresql
"${compose[@]}" config --quiet

wait_for_postgres() {
  for _ in $(seq 1 90); do
    if docker exec iceforge_db pg_isready -q --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
      && docker exec iceforge_db sh -ceu '
        export PGPASSWORD="$POSTGRES_PASSWORD"
        psql -XAt --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command="SELECT 1"
      ' | grep -qx 1; then
      return 0
    fi
    sleep 2
  done
  echo 'PostgreSQL ne répond pas à une vraie requête SQL.' >&2
  return 1
}

migration_dir=/var/backups/iceforge/postgresql-15-to-18-$(date -u +%Y%m%dT%H%M%SZ)
install -d -o root -g root -m 0700 "$migration_dir"
dump_file=$migration_dir/postgresql-15-final.dump
source_inventory=$migration_dir/postgresql-15-inventory.txt
target_inventory=$migration_dir/postgresql-18-inventory.txt
source_normalized=$migration_dir/postgresql-15-inventory.normalized.txt
target_normalized=$migration_dir/postgresql-18-inventory.normalized.txt
umask 077

rollback() {
  status=$?
  trap - ERR
  echo 'Échec PostgreSQL 18; retour à PostgreSQL 15 et à son volume intact.' >&2
  export PROD_POSTGRES_IMAGE=$old_image PROD_POSTGRES_VOLUME=$old_volume PROD_POSTGRES_MOUNT=$old_mount
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait db || true
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend bot frontend || true
  exit "$status"
}
trap rollback ERR

docker stop -t 120 iceforge_frontend iceforge_bot iceforge_backend >/dev/null
remaining_sessions=$(docker exec iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  psql -XAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()"
')
[[ $remaining_sessions == 0 ]] || { echo "$remaining_sessions session(s) PostgreSQL encore active(s)." >&2; exit 1; }

docker run --rm --network iceforge_internal --env PGPASSWORD "$TARGET_IMAGE" \
  pg_dump --host=db --format=custom --compress=9 --no-owner --no-acl \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" >"$dump_file"
docker run --rm -i "$TARGET_IMAGE" pg_restore --list <"$dump_file" >/dev/null
docker run --rm -i --network iceforge_internal --env PGPASSWORD "$TARGET_IMAGE" \
  psql --host=db --quiet --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --file=- \
  <"$INVENTORY_SQL" >"$source_inventory"
sha256sum "$dump_file" "$source_inventory" >"$migration_dir/SHA256SUMS"

docker stop -t 120 iceforge_db >/dev/null
docker volume create "$TARGET_VOLUME" >/dev/null
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait db
wait_for_postgres

if ! target_version=$(docker exec iceforge_db sh -ceu '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    psql -XAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW server_version_num"
  '); then
  echo 'Version PostgreSQL cible illisible.' >&2
  false
fi
[[ $target_version == 180006 ]] || { echo "Version cible inattendue: $target_version" >&2; exit 1; }
docker exec iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  dropdb --if-exists --force --username="$POSTGRES_USER" "$POSTGRES_DB"
  createdb --owner="$POSTGRES_USER" --username="$POSTGRES_USER" "$POSTGRES_DB"
'
docker exec -i iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' <"$dump_file"
docker exec -i iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  psql --quiet --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --file=-
' <"$INVENTORY_SQL" >"$target_inventory"
sed '/^server_version_num|/d' "$source_inventory" >"$source_normalized"
sed '/^server_version_num|/d' "$target_inventory" >"$target_normalized"
sed -E -i 's/^(extension\|[^|]+)\|.*/\1/' "$source_normalized" "$target_normalized"
diff -u "$source_normalized" "$target_normalized"
docker exec iceforge_db sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  vacuumdb --analyze-in-stages --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" >/dev/null
'

"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend
BACKEND_SKIP_PUBLIC_PROBE=true BACKEND_ROLLOUT_DIR=$ROOT_DIR/ops/backend-rollout \
  "$ROOT_DIR/ops/backend-rollout/verify.sh" runtime
trap - ERR

"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait bot frontend
BACKEND_ROLLOUT_DIR=$ROOT_DIR/ops/backend-rollout "$ROOT_DIR/ops/backend-rollout/verify.sh" runtime
BOT_ROLLOUT_DIR=$ROOT_DIR/ops/bot-rollout "$ROOT_DIR/ops/bot-rollout/verify.sh" runtime
FRONTEND_ROLLOUT_DIR=$ROOT_DIR/ops/frontend-rollout "$ROOT_DIR/ops/frontend-rollout/verify.sh" runtime
state_file=$ROOT_DIR/.secrets/vault/stateful.prod.env
state_tmp=$(mktemp "$ROOT_DIR/.secrets/vault/.stateful.prod.env.XXXXXX")
chmod 0600 "$state_tmp"
{
  printf 'PROD_POSTGRES_IMAGE=%s\n' "$TARGET_IMAGE"
  printf 'PROD_POSTGRES_VOLUME=%s\n' "$TARGET_VOLUME"
  printf 'PROD_POSTGRES_MOUNT=/var/lib/postgresql\n'
  printf 'PROD_RABBITMQ_IMAGE=%s\n' "$PROD_RABBITMQ_IMAGE"
  printf 'PROD_RABBITMQ_VOLUME=%s\n' "$PROD_RABBITMQ_VOLUME"
  printf 'PROD_RABBITMQ_HOSTNAME=%s\n' "$PROD_RABBITMQ_HOSTNAME"
} >"$state_tmp"
mv -f -- "$state_tmp" "$state_file"
printf 'POSTGRESQL18_MIGRATION=OK source_version=%s target_version=%s source_volume=%s target_volume=%s artifacts=%s\n' \
  "$source_version" "$target_version" "$old_volume" "$TARGET_VOLUME" "$migration_dir"
