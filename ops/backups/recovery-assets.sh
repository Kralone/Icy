#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: recovery-assets.sh --output-dir /chemin/absolu
       [--config-root /racine --config-list /liste]
       [--image-service backend ...] -- [options docker compose]

La liste contient des chemins relatifs explicites, un par ligne. Les lignes vides
et celles commençant par # sont ignorées. Les symlinks et sorties hors racine sont
refusés. Les images sont sauvegardées par ID réellement exécuté.
EOF
}

OUTPUT_DIR=
CONFIG_ROOT=
CONFIG_LIST=
IMAGE_SERVICES=()
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --config-root) CONFIG_ROOT=${2:?}; shift 2 ;;
    --config-list) CONFIG_LIST=${2:?}; shift 2 ;;
    --image-service) IMAGE_SERVICES+=("${2:?}"); shift 2 ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir est requis"
[[ ( -n "$CONFIG_ROOT" && -n "$CONFIG_LIST" ) || ( -z "$CONFIG_ROOT" && -z "$CONFIG_LIST" ) ]] || die "--config-root et --config-list doivent être utilisés ensemble"
[[ -n "$CONFIG_ROOT" || ${#IMAGE_SERVICES[@]} -gt 0 ]] || die "sélectionner une liste de configuration et/ou au moins une image de service"
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command sha256sum
require_command realpath
require_command tar
require_command gzip
acquire_backup_lock
require_absolute_dir "$OUTPUT_DIR"
config_archive="$OUTPUT_DIR/recovery-config.tar.gz"
config_paths_file="$OUTPUT_DIR/recovery-config-paths.txt"
images_archive="$OUTPUT_DIR/runtime-images.tar.gz"
images_inventory_file="$OUTPUT_DIR/runtime-images.txt"
cleanup_files=()
if [[ -n "$CONFIG_ROOT" ]]; then
  require_new_artifact "$config_archive"
  require_new_artifact "$config_paths_file"
  cleanup_files+=("$config_archive" "$config_paths_file")
fi
if ((${#IMAGE_SERVICES[@]} > 0)); then
  require_new_artifact "$images_archive"
  require_new_artifact "$images_inventory_file"
  cleanup_files+=("$images_archive" "$images_inventory_file")
fi
completed=false
cleanup() {
  if [[ "$completed" != true ]]; then
    remove_checksum_entries "$OUTPUT_DIR" "${cleanup_files[@]}"
    rm -f -- "${cleanup_files[@]}"
  fi
}
trap cleanup EXIT

if [[ -n "$CONFIG_ROOT" ]]; then
  [[ "$CONFIG_ROOT" = /* && "$CONFIG_ROOT" != "/" && -d "$CONFIG_ROOT" && ! -L "$CONFIG_ROOT" ]] || die "racine de configuration invalide"
  [[ -f "$CONFIG_LIST" && ! -L "$CONFIG_LIST" ]] || die "liste de configuration invalide"
  config_root=$(realpath -e -- "$CONFIG_ROOT")
  entries=()
  while IFS= read -r entry || [[ -n "$entry" ]]; do
    entry=${entry%$'\r'}
    [[ -z "$entry" || "$entry" == \#* ]] && continue
    [[ "$entry" != /* && "$entry" != ".." && "$entry" != ../* && "$entry" != */../* && "$entry" != */.. ]] || die "chemin de configuration interdit: $entry"
    resolved=$(realpath -e -- "$config_root/$entry") || die "chemin de configuration absent: $entry"
    [[ "$resolved" == "$config_root/$entry" ]] || die "symlink ou chemin non normalisé interdit: $entry"
    entries+=("$entry")
  done <"$CONFIG_LIST"
  [[ ${#entries[@]} -gt 0 ]] || die "la liste de configuration est vide"

  tar --numeric-owner --acls --xattrs --one-file-system \
    -C "$config_root" -czf "$config_archive" -- "${entries[@]}"
  chmod 600 -- "$config_archive"
  write_checksum "$config_archive"
  write_text_file "$config_paths_file" "${entries[@]}"
  write_checksum "$config_paths_file"
fi

if ((${#IMAGE_SERVICES[@]} > 0)); then
  image_ids=()
  inventory=()
  declare -A seen_image_ids=()
  for service in "${IMAGE_SERVICES[@]}"; do
    [[ "$service" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || die "nom de service invalide: $service"
    cid=$(service_container "$service")
    image_id=$(docker inspect -f '{{.Image}}' "$cid")
    image_ref=$(docker inspect -f '{{.Config.Image}}' "$cid")
    [[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || die "ID d'image inattendu pour $service"
    if [[ -z "${seen_image_ids[$image_id]:-}" ]]; then
      image_ids+=("$image_id")
      seen_image_ids[$image_id]=1
    fi
    inventory+=("$service $image_ref $image_id")
  done

  docker image save "${image_ids[@]}" | gzip -1 >"$images_archive"
  chmod 600 -- "$images_archive"
  write_checksum "$images_archive"
  write_text_file "$images_inventory_file" "${inventory[@]}"
  write_checksum "$images_inventory_file"
fi

completed=true
log "sauvegarde des actifs de reprise terminée"
