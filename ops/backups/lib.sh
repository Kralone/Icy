#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

readonly ARCHIVE_HELPER_IMAGE="postgres:18.6-bookworm@sha256:7d2695c3aa88e792e8b3b233e7e4adb296a20412c6c0ca361e3edaaacfada108"

log() {
  printf '[iceforge-backup] %s\n' "$*" >&2
}

die() {
  log "ERREUR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "commande requise absente: $1"
}

acquire_backup_lock() {
  [[ "${ICEFORGE_BACKUP_LOCK_HELD:-}" == "1" ]] && return 0
  require_command flock
  local lock_file=${ICEFORGE_BACKUP_LOCK_FILE:-/run/lock/iceforge-backup.lock}
  local lock_dir
  [[ "$lock_file" = /* && "$lock_file" != "/" && ! -L "$lock_file" ]] || die "fichier de verrou invalide: $lock_file"
  lock_dir=$(dirname -- "$lock_file")
  [[ -d "$lock_dir" && ! -L "$lock_dir" ]] || die "répertoire de verrou invalide: $lock_dir"
  exec {BACKUP_LOCK_FD}>"$lock_file"
  flock -n "$BACKUP_LOCK_FD" || die "une autre sauvegarde IceForge est déjà en cours"
  export ICEFORGE_BACKUP_LOCK_HELD=1
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || die "ces scripts de production doivent être exécutés sous Linux"
}

require_absolute_dir() {
  local directory=$1
  [[ "$directory" = /* ]] || die "le répertoire doit être absolu: $directory"
  [[ "$directory" != "/" && "$directory" != *','* ]] || die "répertoire de sortie trop large ou non pris en charge: $directory"
  [[ ! -L "$directory" ]] || die "les liens symboliques sont interdits pour la sortie: $directory"
  mkdir -p -- "$directory"
  [[ -d "$directory" && ! -L "$directory" ]] || die "répertoire invalide: $directory"
  chmod 700 -- "$directory"
}

require_regular_file_0600() {
  local file=$1 mode owner
  [[ -f "$file" && ! -L "$file" ]] || die "fichier secret absent ou invalide: $file"
  mode=$(stat -c '%a' -- "$file")
  owner=$(stat -c '%u' -- "$file")
  [[ "$mode" == "600" || "$mode" == "400" ]] || die "$file doit avoir le mode 0600 ou 0400 (actuel: $mode)"
  [[ "$owner" == "$(id -u)" ]] || die "$file doit appartenir à l'utilisateur qui lance la sauvegarde"
}

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

service_container() {
  local service=$1 cid
  cid=$(compose ps -q "$service")
  [[ -n "$cid" ]] || die "aucun conteneur Compose trouvé pour le service $service"
  [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == "true" ]] || die "le service $service n'est pas démarré"
  printf '%s\n' "$cid"
}

container_has_mount() {
  local cid=$1 destination=$2
  docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$cid" | grep -Fqx -- "$destination"
}

archive_container_mount() {
  local cid=$1 destination=$2 output=$3 output_dir output_name
  container_has_mount "$cid" "$destination" || die "$destination n'est pas monté dans le conteneur $cid"
  output_dir=$(dirname -- "$output")
  output_name=$(basename -- "$output")
  require_absolute_dir "$output_dir"
  [[ ! -e "$output" ]] || die "refus d'écraser $output"

  if [[ -n "${ICEFORGE_BACKUP_DOCKER_OUTPUT_VOLUME:-}" ]]; then
    local volume=$ICEFORGE_BACKUP_DOCKER_OUTPUT_VOLUME
    local mount_root=${ICEFORGE_BACKUP_DOCKER_OUTPUT_ROOT:-/backup}
    [[ "$volume" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die "nom de volume de répétition invalide"
    [[ "$output_dir" == "$mount_root" || "$output_dir" == "$mount_root/"* ]] || die "la sortie doit rester sous $mount_root"
    local relative_dir=${output_dir#"$mount_root"}
    docker run --rm \
      --network none \
      --read-only \
      --volumes-from "$cid:ro" \
      --mount "type=volume,source=$volume,target=/backup" \
      --entrypoint tar \
      "$ARCHIVE_HELPER_IMAGE" \
      --numeric-owner --acls --xattrs --one-file-system \
      -C "$destination" -czf "/backup$relative_dir/$output_name" .
  else
    docker run --rm \
      --network none \
      --read-only \
      --volumes-from "$cid:ro" \
      --mount "type=bind,source=$output_dir,target=/backup" \
      --entrypoint tar \
      "$ARCHIVE_HELPER_IMAGE" \
      --numeric-owner --acls --xattrs --one-file-system \
      -C "$destination" -czf "/backup/$output_name" .
  fi
  chmod 600 -- "$output"
}

wait_for_exec() {
  local cid=$1 attempts=$2 delay=$3
  shift 3
  local i
  for ((i = 1; i <= attempts; i++)); do
    if docker exec "$cid" "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

configured_stop_timeout() {
  local timeout=${ICEFORGE_BACKUP_STOP_TIMEOUT:-120}
  [[ "$timeout" =~ ^[0-9]+$ && "$timeout" -ge 1 && "$timeout" -le 600 ]] || die "ICEFORGE_BACKUP_STOP_TIMEOUT doit être compris entre 1 et 600 secondes"
  printf '%s\n' "$timeout"
}

wait_for_container_ready() {
  local cid=$1 attempts=${2:-60} delay=${3:-2} state health i
  for ((i = 1; i <= attempts; i++)); do
    state=$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || true)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)
    if [[ "$state" == "true" && ( "$health" == "none" || "$health" == "healthy" ) ]]; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

write_checksum() {
  local file=$1
  local sums name
  sums="$(dirname -- "$file")/SHA256SUMS"
  [[ -f "$file" && ! -L "$file" ]] || die "artefact absent ou invalide: $file"
  name=$(basename -- "$file")
  if [[ -f "$sums" ]] && grep -Fq -- "  $name" "$sums"; then
    die "checksum déjà présent pour $name"
  fi
  (cd "$(dirname -- "$file")" && sha256sum "$(basename -- "$file")") >>"$(dirname -- "$file")/SHA256SUMS"
}

require_new_artifact() {
  local file=$1 sums name
  [[ ! -e "$file" && ! -L "$file" ]] || die "refus d'écraser $file"
  sums="$(dirname -- "$file")/SHA256SUMS"
  name=$(basename -- "$file")
  if [[ -f "$sums" ]] && grep -Fq -- "  $name" "$sums"; then
    die "un checksum existe déjà pour $name"
  fi
}

remove_checksum_entries() {
  local directory=$1 sums tmp line file keep
  shift
  sums="$directory/SHA256SUMS"
  [[ -f "$sums" && ! -L "$sums" ]] || return 0
  tmp="$sums.cleanup.$$"
  : >"$tmp"
  while IFS= read -r line || [[ -n "$line" ]]; do
    keep=true
    for file in "$@"; do
      if [[ "$line" == *"  $(basename -- "$file")" ]]; then
        keep=false
        break
      fi
    done
    [[ "$keep" == true ]] && printf '%s\n' "$line" >>"$tmp"
  done <"$sums"
  if [[ -s "$tmp" ]]; then
    chmod 600 -- "$tmp"
    mv -- "$tmp" "$sums"
  else
    rm -f -- "$tmp" "$sums"
  fi
}

write_text_file() {
  local output=$1
  shift
  [[ ! -e "$output" ]] || die "refus d'écraser $output"
  printf '%s\n' "$@" >"$output"
  chmod 600 -- "$output"
}
