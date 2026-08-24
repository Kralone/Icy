#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: verify-all.sh --backup-dir /chemin/absolu -- [options docker compose de la cible]

Vérifie les checksums, le catalogue PostgreSQL et restaure le dump dans une base
Compose vierge de la version PostgreSQL source exacte. Cette preuve couvre le
rollback et la reprise après sinistre, pas une migration PostgreSQL majeure.
La restauration Vault et RabbitMQ physique reste une répétition opérationnelle
guidée, car elle exige clés d'unseal, hostname et version source.
EOF
}

BACKUP_DIR=
while (($#)); do
  case "$1" in
    --backup-dir) BACKUP_DIR=${2:?}; shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$BACKUP_DIR" ]] || die "--backup-dir est requis"
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command sha256sum
require_command diff
require_command mktemp
require_command awk
[[ -d "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]] || die "bundle introuvable: $BACKUP_DIR"
[[ ! -e "$BACKUP_DIR/INCOMPLETE" ]] || die "bundle marqué incomplet"
(cd "$BACKUP_DIR" && sha256sum --check SHA256SUMS)

cid=$(service_container db)
source_version=$(awk -F'|' '$1 == "server_version_num" { print $2; exit }' \
  "$BACKUP_DIR/postgresql-inventory.txt")
[[ "$source_version" =~ ^[0-9]+$ ]] || die "version PostgreSQL source absente de l'inventaire"
target_version=$(docker exec "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec psql --quiet --tuples-only --no-align \
    --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
    --command="SHOW server_version_num"
')
[[ "$target_version" =~ ^[0-9]+$ ]] || die "version PostgreSQL cible illisible"
[[ "$target_version" == "$source_version" ]] || die \
  "version PostgreSQL cible $target_version différente de la source $source_version ; verify-all exige la version exacte, utiliser le runbook de migration majeure"

restore_inventory=$(mktemp)
cleanup() {
  rm -f -- "$restore_inventory"
}
trap cleanup EXIT
docker exec -i "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  pg_restore --list >/dev/null
' <"$BACKUP_DIR/postgresql.dump"

docker exec "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  if pg_dump --username="$POSTGRES_USER" --dbname=iceforge_restore_verify \
      --schema-only --file=/dev/null >/dev/null 2>&1; then
    echo "la base iceforge_restore_verify existe déjà" >&2
    exit 1
  fi
'
docker exec -i "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec psql --username="$POSTGRES_USER" --dbname=postgres --set=ON_ERROR_STOP=1 --file=-
' <"$BACKUP_DIR/postgresql-globals.sql"

docker exec "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  createdb --username="$POSTGRES_USER" iceforge_restore_verify
'
docker exec -i "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" \
    --dbname=iceforge_restore_verify
' <"$BACKUP_DIR/postgresql.dump"

docker exec -i "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec psql --quiet --username="$POSTGRES_USER" --dbname=iceforge_restore_verify --file=-
' <"$SCRIPT_DIR/postgres-inventory.sql" >"$restore_inventory"

diff -u "$BACKUP_DIR/postgresql-inventory.txt" "$restore_inventory"

log "checksums, globaux et inventaire exact de la restauration PostgreSQL validés"
