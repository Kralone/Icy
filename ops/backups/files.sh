#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: files.sh --output-dir /chemin/absolu [--images] [--bot-config] -- [options docker compose]

Chaque option arrête brièvement le seul service susceptible d'écrire dans le volume,
puis redémarre exactement le même conteneur. Aucun secret ni log n'est inclus.
EOF
}

OUTPUT_DIR=
BACKUP_IMAGES=false
BACKUP_BOT_CONFIG=false
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --images) BACKUP_IMAGES=true; shift ;;
    --bot-config) BACKUP_BOT_CONFIG=true; shift ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) die "option inconnue: $1" ;;
  esac
done
[[ -n "$OUTPUT_DIR" ]] || die "--output-dir est requis"
[[ "$BACKUP_IMAGES" == true || "$BACKUP_BOT_CONFIG" == true ]] || die "sélectionner --images et/ou --bot-config"
COMPOSE_ARGS=("$@")

require_linux
require_command docker
require_command sha256sum
acquire_backup_lock
require_absolute_dir "$OUTPUT_DIR"
stop_timeout=$(configured_stop_timeout)
images_file="$OUTPUT_DIR/images.tar.gz"
bot_config_file="$OUTPUT_DIR/bot-config.tar.gz"
if [[ "$BACKUP_IMAGES" == true ]]; then
  require_new_artifact "$images_file"
fi
if [[ "$BACKUP_BOT_CONFIG" == true ]]; then
  require_new_artifact "$bot_config_file"
fi

STOPPED_CIDS=()
completed=false
cleanup_stopped_services() {
  local cid
  for cid in "${STOPPED_CIDS[@]}"; do
    [[ -n "$cid" ]] || continue
    if [[ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || true)" != "true" ]]; then
      log "redémarrage de sécurité du conteneur $cid"
      docker start "$cid" >/dev/null 2>&1 || true
    fi
    wait_for_container_ready "$cid" 60 2 || log "ERREUR: le conteneur $cid n'est pas redevenu sain"
  done
  if [[ "$completed" != true ]]; then
    remove_checksum_entries "$OUTPUT_DIR" "$images_file" "$bot_config_file"
    rm -f -- "$images_file" "$bot_config_file"
  fi
}
trap cleanup_stopped_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

backup_mount_with_pause() {
  local service=$1 destination=$2 output=$3 cid
  cid=$(service_container "$service")
  log "arrêt contrôlé de $service pour $destination"
  STOPPED_CIDS+=("$cid")
  docker stop --time "$stop_timeout" "$cid" >/dev/null
  [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == "false" ]] || die "$service ne s'est pas arrêté"
  archive_container_mount "$cid" "$destination" "$output"
  docker start "$cid" >/dev/null
  wait_for_container_ready "$cid" 60 2 || die "$service n'est pas redevenu sain"
  STOPPED_CIDS=()
  write_checksum "$output"
}

if [[ "$BACKUP_IMAGES" == true ]]; then
  backup_mount_with_pause backend /app/uploads/images "$images_file"
fi
if [[ "$BACKUP_BOT_CONFIG" == true ]]; then
  backup_mount_with_pause bot /app/config "$bot_config_file"
fi

completed=true
log "sauvegarde des fichiers persistants terminée"
