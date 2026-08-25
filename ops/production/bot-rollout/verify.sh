#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-config}"
if [[ "$mode" != "config" && "$mode" != "runtime" ]]; then
  echo "Usage: BOT_IMAGE=<immutable-tag> $0 [config|runtime]" >&2
  exit 2
fi

iceforge_root="${ICEFORGE_ROOT:-/root/iceforge}"
rollout_dir="${BOT_ROLLOUT_DIR:-${iceforge_root}/ops/bot-rollout}"
bot_image="${BOT_IMAGE:?BOT_IMAGE must be set}"
bot_container="${BOT_CONTAINER:-iceforge_bot}"

compose=(
  docker compose
  --project-directory "$iceforge_root"
  --env-file "${iceforge_root}/.env"
  --env-file "${iceforge_root}/.secrets/vault/compose.prod.env"
  -f "${iceforge_root}/docker-compose.yml"
  -f "${iceforge_root}/docker-compose.vault.yml"
  -f "${iceforge_root}/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "${rollout_dir}/docker-compose.bot-amqp-redaction.yml"
)

docker image inspect "$bot_image" >/dev/null
BOT_IMAGE="$bot_image" BOT_ROLLOUT_DIR="$rollout_dir" "${compose[@]}" config --quiet
BOT_IMAGE="$bot_image" BOT_ROLLOUT_DIR="$rollout_dir" "${compose[@]}" config --format json \
  | EXPECTED_BOT_IMAGE="$bot_image" python3 "${rollout_dir}/verify-compose.py"

if [[ "$mode" == "config" ]]; then
  exit 0
fi

running="$(docker inspect --format '{{.State.Running}}' "$bot_container")"
health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$bot_container")"
restarts="$(docker inspect --format '{{.RestartCount}}' "$bot_container")"
actual_image="$(docker inspect --format '{{.Config.Image}}' "$bot_container")"
actual_id="$(docker inspect --format '{{.Image}}' "$bot_container")"
expected_id="$(docker image inspect --format '{{.Id}}' "$bot_image")"

[[ "$running" == "true" ]] || { echo "ERROR: bot is not running" >&2; exit 1; }
[[ "$health" == "healthy" ]] || { echo "ERROR: bot health is $health" >&2; exit 1; }
[[ "$restarts" == "0" ]] || { echo "ERROR: bot restarted $restarts time(s)" >&2; exit 1; }
[[ "$actual_image" == "$bot_image" ]] || { echo "ERROR: bot tag differs from requested tag" >&2; exit 1; }
[[ "$actual_id" == "$expected_id" ]] || { echo "ERROR: bot image ID differs from the loaded image" >&2; exit 1; }
[[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$bot_container")" == "true" ]]
[[ "$(docker inspect --format '{{.Config.User}}' "$bot_container")" == "10001:10001" ]]
[[ "$(docker exec "$bot_container" id -u)" == "10001" ]]
[[ "$(docker exec "$bot_container" id -g)" == "10001" ]]

python_version="$(docker exec "$bot_container" python --version 2>&1)"
grep -Fq 'Python 3.14.7' <<<"$python_version" || { echo "ERROR: unexpected Python runtime" >&2; exit 1; }
if docker exec "$bot_container" touch /app/.root-filesystem-write-check >/dev/null 2>&1; then
  docker exec "$bot_container" rm -f /app/.root-filesystem-write-check
  echo "ERROR: bot root filesystem accepted a write" >&2
  exit 1
fi

recent_logs="$(docker logs --since 10m "$bot_container" 2>&1)"
grep -Fq 'Connecté en tant que' <<<"$recent_logs" || { echo "ERROR: Discord connection marker is missing" >&2; exit 1; }
grep -Fq 'RabbitMQ connecté et en écoute' <<<"$recent_logs" || { echo "ERROR: RabbitMQ connection marker is missing" >&2; exit 1; }
if grep -Eq 'amqps?://[^/@:]+:[^/@]+@' <<<"$recent_logs"; then
  echo "ERROR: AMQP credentials found in bot logs" >&2
  exit 1
fi
if grep -Eiq 'traceback|uncaught|unhandled|connection rabbitmq impossible' <<<"$recent_logs"; then
  echo "ERROR: bot error marker found in recent logs" >&2
  exit 1
fi

queues="$(docker exec iceforge_rabbitmq rabbitmqctl list_queues name consumers messages)"
for queue in news.queue events.queue users.queue scwe.queue; do
  grep -Eq "^${queue}[[:space:]]+1[[:space:]]+0$" <<<"$queues" \
    || { echo "ERROR: bot queue is not healthy: $queue" >&2; exit 1; }
done

echo "Bot AMQP credential redaction runtime: OK"
