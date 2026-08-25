#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-inspect}"
if [[ "$mode" != "inspect" && "$mode" != "apply" && "$mode" != "verify" ]]; then
  echo "Usage: BACKEND_IMAGE=<immutable-tag> $0 [inspect|apply|verify]" >&2
  exit 2
fi

backend_image="${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
backend_container="${BACKEND_CONTAINER:-iceforge_backend}"
logs_volume="${BACKEND_LOGS_VOLUME:-iceforge_backend_logs}"
images_volume="${BACKEND_IMAGES_VOLUME:-icy_images_data}"

docker image inspect "$backend_image" >/dev/null
docker volume inspect "$logs_volume" >/dev/null
docker volume inspect "$images_volume" >/dev/null

mounts=(
  --mount "type=volume,source=${logs_volume},target=/target/logs"
  --mount "type=volume,source=${images_volume},target=/target/images"
)

if [[ "$mode" == "inspect" ]]; then
  docker run --rm \
    --user 0:0 \
    --network none \
    --read-only \
    --cap-drop ALL \
    --entrypoint sh \
    "${mounts[@]}" \
    "$backend_image" \
    -c 'stat -c "%n uid=%u gid=%g mode=%a" /target/logs /target/images'
  exit 0
fi

if [[ "$mode" == "apply" ]]; then
  if docker inspect "$backend_container" >/dev/null 2>&1 &&
     [[ "$(docker inspect --format '{{.State.Running}}' "$backend_container")" == "true" ]]; then
    echo "ERROR: $backend_container must be stopped before changing volume ownership" >&2
    exit 1
  fi

  docker run --rm \
    --user 0:0 \
    --network none \
    --read-only \
    --cap-drop ALL \
    --cap-add CHOWN \
    --cap-add DAC_OVERRIDE \
    --cap-add FOWNER \
    --entrypoint sh \
    "${mounts[@]}" \
    "$backend_image" \
    -c 'chown -R 10001:101 /target/logs /target/images'
fi

docker run --rm \
  --user 10001:101 \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --entrypoint sh \
  "${mounts[@]}" \
  "$backend_image" \
  -c 'set -eu
      test -w /target/logs
      test -w /target/images
      touch /target/logs/.iceforge-permission-check
      touch /target/images/.iceforge-permission-check
      rm /target/logs/.iceforge-permission-check
      rm /target/images/.iceforge-permission-check
      stat -c "%n uid=%u gid=%g mode=%a" /target/logs /target/images'

echo "Backend volume permissions: OK"
