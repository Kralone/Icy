#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: backup-all.sh --output-dir /sauvegardes --vault-token-file /run/token
                     [--age-recipient age1...] [--allow-plaintext]
                     [--offline-rabbitmq] [--images] [--bot-config]
                     [--config-root /racine --config-list /liste]
                     [--runtime-image-service service ...]
                     -- [options docker compose]

Par défaut, le script exige un destinataire age. --allow-plaintext est réservé aux
répétitions isolées: les dumps et snapshots sont des secrets à part entière.
EOF
}

OUTPUT_DIR=
TOKEN_FILE=
AGE_RECIPIENT=
ALLOW_PLAINTEXT=false
OFFLINE_RABBITMQ=false
BACKUP_IMAGES=false
BACKUP_BOT_CONFIG=false
CONFIG_ROOT=
CONFIG_LIST=
RUNTIME_IMAGE_SERVICES=()
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --vault-token-file) TOKEN_FILE=${2:?}; shift 2 ;;
    --age-recipient) AGE_RECIPIENT=${2:?}; shift 2 ;;
    --allow-plaintext) ALLOW_PLAINTEXT=true; shift ;;
    --offline-rabbitmq) OFFLINE_RABBITMQ=true; shift ;;
    --images) BACKUP_IMAGES=true; shift ;;
    --bot-config) BACKUP_BOT_CONFIG=true; shift ;;
    --config-root) CONFIG_ROOT=${2:?}; shift 2 ;;
    --config-list) CONFIG_LIST=${2:?}; shift 2 ;;
    --runtime-image-service) RUNTIME_IMAGE_SERVICES+=("${2:?}"); shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir est requis"
[[ -n "$TOKEN_FILE" ]] || die "--vault-token-file est requis"
[[ ( -n "$CONFIG_ROOT" && -n "$CONFIG_LIST" ) || ( -z "$CONFIG_ROOT" && -z "$CONFIG_LIST" ) ]] || die "--config-root et --config-list doivent être utilisés ensemble"
[[ -n "$AGE_RECIPIENT" || "$ALLOW_PLAINTEXT" == true ]] || die "--age-recipient est requis hors répétition isolée"
[[ -z "$AGE_RECIPIENT" || "$ALLOW_PLAINTEXT" == false ]] || die "ne pas combiner --age-recipient et --allow-plaintext"
COMPOSE_ARGS=("$@")

if [[ "$ALLOW_PLAINTEXT" == true ]]; then
  [[ "${ICEFORGE_BACKUP_ALLOW_PLAINTEXT_TEST:-}" == "1" ]] || die "--allow-plaintext exige ICEFORGE_BACKUP_ALLOW_PLAINTEXT_TEST=1"
  test_project=
  for ((i = 0; i < ${#COMPOSE_ARGS[@]}; i++)); do
    if [[ "${COMPOSE_ARGS[i]}" == "--project-name" || "${COMPOSE_ARGS[i]}" == "-p" ]]; then
      test_project=${COMPOSE_ARGS[i + 1]:-}
      break
    fi
  done
  [[ "$test_project" =~ ^iceforge-backup-[a-zA-Z0-9_.-]+$ ]] || die "le mode clair exige un projet Compose iceforge-backup-* explicite"
  [[ -z "$CONFIG_ROOT" && ${#RUNTIME_IMAGE_SERVICES[@]} -eq 0 ]] || die "configuration hôte et images runtime sont interdites dans un bundle clair"
fi

require_linux
require_command docker
require_command sha256sum
acquire_backup_lock
require_absolute_dir "$OUTPUT_DIR"
require_regular_file_0600 "$TOKEN_FILE"
if [[ -n "$AGE_RECIPIENT" ]]; then
  require_command age
  printf '' | age -r "$AGE_RECIPIENT" >/dev/null
fi

timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
staging_parent=${ICEFORGE_BACKUP_STAGING:-/run/iceforge-backup}
require_absolute_dir "$staging_parent"
staging="$staging_parent/$timestamp-$$"
mkdir -m 700 -- "$staging"
incomplete="$staging/INCOMPLETE"
touch "$incomplete"

cleanup() {
  if [[ "${archive_complete:-true}" != true && -n "${archive:-}" && "$archive" == "$OUTPUT_DIR/"* ]]; then
    rm -f -- "$archive" "$archive.sha256"
  fi
  if [[ -n "${partial_archive:-}" && "$partial_archive" == "$OUTPUT_DIR/"* ]]; then
    rm -f -- "$partial_archive"
  fi
  if [[ -n "${partial_checksum:-}" && "$partial_checksum" == "$OUTPUT_DIR/"* ]]; then
    rm -f -- "$partial_checksum"
  fi
  if [[ "$staging" == "$staging_parent/"* && -d "$staging" ]]; then
    rm -rf -- "$staging"
  fi
}
trap cleanup EXIT

compose_passthrough=(-- "${COMPOSE_ARGS[@]}")
"$SCRIPT_DIR/postgres.sh" --output-dir "$staging" "${compose_passthrough[@]}"

rabbit_args=(--output-dir "$staging")
[[ "$OFFLINE_RABBITMQ" == true ]] && rabbit_args+=(--offline-volume)
"$SCRIPT_DIR/rabbitmq.sh" "${rabbit_args[@]}" "${compose_passthrough[@]}"

"$SCRIPT_DIR/vault.sh" --output-dir "$staging" --vault-token-file "$TOKEN_FILE" "${compose_passthrough[@]}"

if [[ "$BACKUP_IMAGES" == true || "$BACKUP_BOT_CONFIG" == true ]]; then
  file_args=(--output-dir "$staging")
  [[ "$BACKUP_IMAGES" == true ]] && file_args+=(--images)
  [[ "$BACKUP_BOT_CONFIG" == true ]] && file_args+=(--bot-config)
  "$SCRIPT_DIR/files.sh" "${file_args[@]}" "${compose_passthrough[@]}"
fi

if [[ -n "$CONFIG_ROOT" || ${#RUNTIME_IMAGE_SERVICES[@]} -gt 0 ]]; then
  recovery_args=(--output-dir "$staging")
  if [[ -n "$CONFIG_ROOT" ]]; then
    recovery_args+=(--config-root "$CONFIG_ROOT" --config-list "$CONFIG_LIST")
  fi
  for service in "${RUNTIME_IMAGE_SERVICES[@]}"; do
    recovery_args+=(--image-service "$service")
  done
  "$SCRIPT_DIR/recovery-assets.sh" "${recovery_args[@]}" "${compose_passthrough[@]}"
fi

{
  printf 'created_utc=%s\n' "$timestamp"
  printf 'git_commit=%s\n' "$(git -C "$SCRIPT_DIR/../.." rev-parse HEAD 2>/dev/null || printf unknown)"
  printf 'docker_server=%s\n' "$(docker version --format '{{.Server.Version}}')"
  printf 'compose_version=%s\n' "$(docker compose version --short)"
  printf 'offline_rabbitmq=%s\n' "$OFFLINE_RABBITMQ"
  printf 'images=%s\n' "$BACKUP_IMAGES"
  printf 'bot_config=%s\n' "$BACKUP_BOT_CONFIG"
  printf 'recovery_config=%s\n' "$([[ -n "$CONFIG_ROOT" ]] && printf true || printf false)"
  printf 'runtime_image_services=%s\n' "${RUNTIME_IMAGE_SERVICES[*]:-none}"
} >"$staging/MANIFEST.txt"
chmod 600 -- "$staging/MANIFEST.txt"
write_checksum "$staging/MANIFEST.txt"
rm -- "$incomplete"

if [[ -n "$AGE_RECIPIENT" ]]; then
  archive="$OUTPUT_DIR/iceforge-$timestamp.tar.gz.age"
  archive_complete=false
  partial_archive="$archive.partial.$$"
  [[ ! -e "$archive" ]] || die "refus d'écraser $archive"
  [[ ! -e "$archive.sha256" ]] || die "refus d'écraser $archive.sha256"
  [[ ! -e "$partial_archive" ]] || die "refus d'écraser $partial_archive"
  tar --numeric-owner -C "$staging_parent" -czf - "$(basename -- "$staging")" | age -r "$AGE_RECIPIENT" -o "$partial_archive"
  mv -- "$partial_archive" "$archive"
  chmod 600 -- "$archive"
  partial_checksum="$archive.sha256.partial.$$"
  (cd "$OUTPUT_DIR" && sha256sum "$(basename -- "$archive")") >"$partial_checksum"
  mv -- "$partial_checksum" "$archive.sha256"
  chmod 600 -- "$archive.sha256"
  archive_complete=true
  log "bundle chiffré créé: $archive"
else
  destination="$OUTPUT_DIR/iceforge-$timestamp"
  [[ ! -e "$destination" ]] || die "refus d'écraser $destination"
  mv -- "$staging" "$destination"
  staging="$staging_parent/.already-moved-$$"
  log "bundle en clair créé pour répétition isolée: $destination"
fi
