#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/lib.sh"

BACKUP_DIR=
while (($#)); do
  case "$1" in
    --backup-dir) BACKUP_DIR=${2:?}; shift 2 ;;
    --) shift; break ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]] || die "répertoire de sauvegarde invalide"
COMPOSE_ARGS=("$@")
require_linux
require_command docker
require_command mktemp
source_cid=$(service_container db)
source_image=$(docker inspect -f '{{.Image}}' "$source_cid")
[[ "$source_image" =~ ^sha256:[a-f0-9]{64}$ ]] || die "ID image PostgreSQL source invalide"

# Only this randomly named project and its explicitly named temporary volume
# may be removed. No production mounts, networks or Compose files are reused.
work=$(mktemp -d /run/iceforge-restore-verify.XXXXXXXXXX)
chmod 700 "$work"
suffix=${work##*.}
project="iceforge-backup-verify-${suffix,,}"
volume="$project-data"
[[ "$project" =~ ^iceforge-backup-verify-[a-z0-9]{10}$ ]] || die "nom de projet de vérification invalide"
[[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]] || die "projet de vérification déjà présent"
if docker volume inspect "$volume" >/dev/null 2>&1; then
  die "volume de vérification déjà présent"
fi
compose_file="$work/compose.yml"
created=false
cleanup() {
  local exit_status=$?
  if [[ "$created" == true ]]; then
    if ! docker compose --project-name "$project" -f "$compose_file" down --volumes --remove-orphans >/dev/null; then
      log "ERREUR: nettoyage isolé incomplet pour $project ; configuration protégée conservée dans $work"
      exit 1
    fi
  fi
  # Fixed mktemp prefix and no caller-supplied deletion path.
  if [[ "$work" == /run/iceforge-restore-verify.* && -d "$work" && ! -L "$work" ]]; then
    rm -rf -- "$work"
  fi
  exit "$exit_status"
}
trap cleanup EXIT
bootstrap_user="restore_${suffix,,}"
password=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
cat >"$compose_file" <<EOF
services:
  db:
    image: "$source_image"
    pull_policy: never
    network_mode: none
    restart: "no"
    mem_limit: 1g
    cpus: 1
    pids_limit: 256
    environment:
      POSTGRES_USER: "$bootstrap_user"
      POSTGRES_PASSWORD: "$password"
      POSTGRES_DB: postgres
    volumes:
      - restore-data:/var/lib/postgresql
volumes:
  restore-data:
    name: "$volume"
EOF
chmod 600 "$compose_file"
unset password
created=true
docker compose --project-name "$project" -f "$compose_file" up -d --no-build >/dev/null
verify_cid=$(docker compose --project-name "$project" -f "$compose_file" ps -q db)
[[ -n "$verify_cid" && "$verify_cid" != "$source_cid" ]] || die "conteneur de vérification invalide"
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$verify_cid" pg_isready --username="$bootstrap_user" --dbname=postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || die "PostgreSQL isolé indisponible après 60 secondes"
# The complete dump and inventory come from the same exported source snapshot.
# INCOMPLETE belongs to backup-all, so verify a private directory of verified copies
# to the exact PostgreSQL artifacts without accepting incomplete full bundles.
verify_dir="$work/artifacts"
mkdir -m 700 "$verify_dir"
for artifact in postgresql.dump postgresql-globals.sql postgresql-inventory.txt; do
  [[ -f "$BACKUP_DIR/$artifact" && ! -L "$BACKUP_DIR/$artifact" ]] || die "artefact PostgreSQL absent"
  cp --reflink=auto -- "$BACKUP_DIR/$artifact" "$verify_dir/$artifact"
done
awk '$2 == "postgresql.dump" || $2 == "postgresql-globals.sql" || $2 == "postgresql-inventory.txt"' \
  "$BACKUP_DIR/SHA256SUMS" >"$verify_dir/SHA256SUMS"
[[ $(wc -l <"$verify_dir/SHA256SUMS") -eq 3 ]] || die "checksums PostgreSQL incomplets"
bash "$SCRIPT_DIR/verify-all.sh" --backup-dir "$verify_dir" -- --project-name "$project" -f "$compose_file"
proof="$BACKUP_DIR/postgresql-restore-verification.txt"
require_new_artifact "$proof"
{
  printf 'result=RESTORE_VERIFIED\nsource_image=%s\n' "$source_image"
  printf 'verified_utc=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  (cd "$BACKUP_DIR" && sha256sum postgresql.dump)
} >"$proof"
chmod 600 "$proof"
write_checksum "$proof"
log "restauration PostgreSQL isolée vérifiée avant chiffrement"
