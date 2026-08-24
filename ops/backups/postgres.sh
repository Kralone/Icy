#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: postgres.sh --output-dir /chemin/absolu -- [options docker compose]

Produit un dump PostgreSQL custom, les globaux sans mots de passe et un inventaire.
EOF
}

OUTPUT_DIR=
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir est requis"
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command sha256sum
acquire_backup_lock
require_absolute_dir "$OUTPUT_DIR"

cid=$(service_container db)
dump_file="$OUTPUT_DIR/postgresql.dump"
globals_file="$OUTPUT_DIR/postgresql-globals.sql"
inventory_file="$OUTPUT_DIR/postgresql-inventory.txt"
for file in "$dump_file" "$globals_file" "$inventory_file"; do
  require_new_artifact "$file"
done

completed=false
snapshot_holder_started=false
close_snapshot_holder() {
  local transaction_end=$1
  if [[ "$snapshot_holder_started" == true ]]; then
    printf '%s\n\\q\n' "$transaction_end" 1>&"$snapshot_holder_input" 2>/dev/null || true
    wait "$snapshot_holder_pid" >/dev/null 2>&1 || true
    snapshot_holder_started=false
  fi
}
cleanup() {
  close_snapshot_holder ROLLBACK
  if [[ "$completed" != true ]]; then
    remove_checksum_entries "$OUTPUT_DIR" "$dump_file" "$globals_file" "$inventory_file"
    rm -f -- "$dump_file" "$globals_file" "$inventory_file"
  fi
}
trap cleanup EXIT

log "création du dump logique PostgreSQL"
coproc PG_SNAPSHOT_HOLDER {
  docker exec -i "$cid" sh -ceu '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec psql --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1 \
      --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
  '
}
snapshot_holder_pid=$PG_SNAPSHOT_HOLDER_PID
snapshot_holder_output=${PG_SNAPSHOT_HOLDER[0]}
snapshot_holder_input=${PG_SNAPSHOT_HOLDER[1]}
snapshot_holder_started=true
printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' 'SELECT pg_export_snapshot();' 1>&"$snapshot_holder_input"
IFS= read -r snapshot <&"$snapshot_holder_output" || die "impossible d'exporter le snapshot PostgreSQL"
[[ "$snapshot" =~ ^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$ ]] || die "identifiant de snapshot PostgreSQL inattendu"

docker exec "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  pg_dump --format=custom --compress=9 \
    --snapshot="$1" --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' sh "$snapshot" >"$dump_file"

{
  printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'
  printf "SET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
  cat -- "$SCRIPT_DIR/postgres-inventory.sql"
  printf '%s\n' 'COMMIT;'
} | docker exec -i "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec psql --quiet --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --file=-
' >"$inventory_file"

close_snapshot_holder COMMIT
docker exec -i "$cid" pg_restore --list <"$dump_file" >/dev/null

docker exec "$cid" sh -ceu '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  pg_dumpall --globals-only --no-role-passwords \
    --username="$POSTGRES_USER"
' >"$globals_file"

for file in "$dump_file" "$globals_file" "$inventory_file"; do
  chmod 600 -- "$file"
  write_checksum "$file"
done
completed=true

log "sauvegarde PostgreSQL terminée"
