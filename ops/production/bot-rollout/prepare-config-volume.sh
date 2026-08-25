#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-inspect}"
if [[ "$mode" != "inspect" && "$mode" != "apply" && "$mode" != "verify" ]]; then
  echo "Usage: BOT_IMAGE=<immutable-tag> $0 [inspect|apply|verify]" >&2
  exit 2
fi

bot_image="${BOT_IMAGE:?BOT_IMAGE must be set}"
bot_container="${BOT_CONTAINER:-iceforge_bot}"
config_volume="${BOT_CONFIG_VOLUME:-iceforge_bot_config}"

docker image inspect "$bot_image" >/dev/null
docker volume inspect "$config_volume" >/dev/null

mount=(--mount "type=volume,source=${config_volume},target=/target/config")

if [[ "$mode" == "inspect" ]]; then
  docker run --rm --user 0:0 --network none --read-only --cap-drop ALL \
    --entrypoint sh "${mount[@]}" "$bot_image" \
    -c 'stat -c "%n uid=%u gid=%g mode=%a" /target/config'
  exit 0
fi

if [[ "$mode" == "apply" ]]; then
  if docker inspect "$bot_container" >/dev/null 2>&1 &&
     [[ "$(docker inspect --format '{{.State.Running}}' "$bot_container")" == "true" ]]; then
    echo "ERROR: $bot_container must be stopped before changing volume ownership" >&2
    exit 1
  fi

  docker run --rm --user 0:0 --network none --read-only --cap-drop ALL \
    --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
    --entrypoint sh "${mount[@]}" "$bot_image" \
    -c 'chown -R 10001:10001 /target/config'
fi

docker run --rm --user 10001:10001 --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --entrypoint sh \
  "${mount[@]}" "$bot_image" \
  -c 'set -eu
      test -w /target/config
      touch /target/config/.iceforge-permission-check
      rm /target/config/.iceforge-permission-check
      stat -c "%n uid=%u gid=%g mode=%a" /target/config'

echo "Bot config volume permissions: OK"
