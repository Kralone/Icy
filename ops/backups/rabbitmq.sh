#!/usr/bin/env bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() {
  cat >&2 <<'EOF'
Usage: rabbitmq.sh --output-dir /chemin/absolu [--offline-volume] -- [options docker compose]

Les définitions sont toujours exportées. --offline-volume arrête brièvement RabbitMQ
et archive aussi les messages persistants, le cookie et les métadonnées du nœud.
EOF
}

OUTPUT_DIR=
OFFLINE_VOLUME=false
while (($#)); do
  case "$1" in
    --output-dir) OUTPUT_DIR=${2:?}; shift 2 ;;
    --offline-volume) OFFLINE_VOLUME=true; shift ;;
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

cid=$(service_container rabbitmq)
stop_timeout=$(configured_stop_timeout)
tmp_definitions="/dev/shm/iceforge-backup-rabbitmq-$$.json"
definitions_file="$OUTPUT_DIR/rabbitmq-definitions.json"
inventory_file="$OUTPUT_DIR/rabbitmq-inventory.txt"
data_file="$OUTPUT_DIR/rabbitmq-data.tar.gz"
require_new_artifact "$definitions_file"
require_new_artifact "$inventory_file"
if [[ "$OFFLINE_VOLUME" == true ]]; then
  require_new_artifact "$data_file"
fi
restart_intent=false
completed=false

cleanup() {
  docker exec "$cid" rm -f -- "$tmp_definitions" >/dev/null 2>&1 || true
  if [[ "$restart_intent" == true ]]; then
    if [[ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || true)" != "true" ]]; then
      log "redémarrage de sécurité de RabbitMQ"
      docker start "$cid" >/dev/null 2>&1 || true
    fi
    if ! wait_for_exec "$cid" 30 2 rabbitmq-diagnostics -q ping; then
      log "ERREUR: RabbitMQ n'est pas redevenu sain; inspecter immédiatement $cid"
    fi
    docker exec "$cid" rm -f -- "$tmp_definitions" >/dev/null 2>&1 || true
  fi
  if [[ "$completed" != true ]]; then
    remove_checksum_entries "$OUTPUT_DIR" "$definitions_file" "$inventory_file" "$data_file"
    rm -f -- "$definitions_file" "$inventory_file" "$data_file"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log "export des définitions RabbitMQ"
docker exec "$cid" rabbitmqctl export_definitions "$tmp_definitions" >/dev/null
docker exec "$cid" cat "$tmp_definitions" >"$definitions_file"
chmod 600 -- "$definitions_file"
docker exec "$cid" sh -ceu '
  rabbitmqctl version
  rabbitmqctl status | sed -n "1,80p"
  rabbitmqctl list_queues --no-table-headers name durable type messages consumers
  rabbitmqctl list_exchanges --no-table-headers name type durable
  rabbitmqctl list_bindings --no-table-headers source_name destination_name destination_kind routing_key
' >"$inventory_file"
chmod 600 -- "$inventory_file"
write_checksum "$definitions_file"
write_checksum "$inventory_file"

if [[ "$OFFLINE_VOLUME" == true ]]; then
  log "arrêt contrôlé de RabbitMQ pour la copie physique"
  restart_intent=true
  docker stop --time "$stop_timeout" "$cid" >/dev/null
  [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == "false" ]] || die "RabbitMQ ne s'est pas arrêté"
  archive_container_mount "$cid" /var/lib/rabbitmq "$data_file"
  write_checksum "$data_file"
  log "redémarrage de RabbitMQ"
  docker start "$cid" >/dev/null
  wait_for_exec "$cid" 30 2 rabbitmq-diagnostics -q ping || die "RabbitMQ n'est pas redevenu sain"
  restart_intent=false
fi

completed=true
log "sauvegarde RabbitMQ terminée"
