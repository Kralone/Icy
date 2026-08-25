#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-config}"
if [[ "$mode" != "config" && "$mode" != "runtime" ]]; then
  echo "Usage: BACKEND_IMAGE=<immutable-tag> $0 [config|runtime]" >&2
  exit 2
fi

iceforge_root="${ICEFORGE_ROOT:-/root/iceforge}"
rollout_dir="${BACKEND_ROLLOUT_DIR:-${iceforge_root}/ops/backend-rollout}"
backend_image="${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
backend_container="${BACKEND_CONTAINER:-iceforge_backend}"

required_files=(
  "${iceforge_root}/.env"
  "${iceforge_root}/.secrets/vault/compose.prod.env"
  "${iceforge_root}/docker-compose.yml"
  "${iceforge_root}/docker-compose.vault.yml"
  "${iceforge_root}/ops/network-hardening/docker-compose.network-hardening.yml"
  "${rollout_dir}/docker-compose.backend-java25.yml"
  "${rollout_dir}/verify-compose.py"
  "${rollout_dir}/verify-flyway-v28.sql"
)
for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || { echo "ERROR: required file is missing: $file" >&2; exit 1; }
done

compose=(
  docker compose
  --project-directory "$iceforge_root"
  --env-file "${iceforge_root}/.env"
  --env-file "${iceforge_root}/.secrets/vault/compose.prod.env"
  -f "${iceforge_root}/docker-compose.yml"
  -f "${iceforge_root}/docker-compose.vault.yml"
  -f "${iceforge_root}/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "${rollout_dir}/docker-compose.backend-java25.yml"
)

docker image inspect "$backend_image" >/dev/null
BACKEND_IMAGE="$backend_image" BACKEND_ROLLOUT_DIR="$rollout_dir" \
  "${compose[@]}" config --quiet
BACKEND_IMAGE="$backend_image" BACKEND_ROLLOUT_DIR="$rollout_dir" \
  "${compose[@]}" config --format json \
  | EXPECTED_BACKEND_IMAGE="$backend_image" python3 "${rollout_dir}/verify-compose.py"

if [[ "$mode" == "config" ]]; then
  exit 0
fi

running="$(docker inspect --format '{{.State.Running}}' "$backend_container")"
health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$backend_container")"
restarts="$(docker inspect --format '{{.RestartCount}}' "$backend_container")"
actual_image="$(docker inspect --format '{{.Config.Image}}' "$backend_container")"
actual_id="$(docker inspect --format '{{.Image}}' "$backend_container")"
expected_id="$(docker image inspect --format '{{.Id}}' "$backend_image")"
read_only="$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$backend_container")"
container_user="$(docker inspect --format '{{.Config.User}}' "$backend_container")"

[[ "$running" == "true" ]] || { echo "ERROR: backend is not running" >&2; exit 1; }
[[ "$health" == "healthy" ]] || { echo "ERROR: backend health is $health" >&2; exit 1; }
[[ "$restarts" == "0" ]] || { echo "ERROR: backend restarted $restarts time(s)" >&2; exit 1; }
[[ "$actual_image" == "$backend_image" ]] || { echo "ERROR: backend tag differs from requested tag" >&2; exit 1; }
[[ "$actual_id" == "$expected_id" ]] || { echo "ERROR: backend image ID differs from the loaded image" >&2; exit 1; }
[[ "$read_only" == "true" ]] || { echo "ERROR: backend root filesystem is writable" >&2; exit 1; }
[[ "$container_user" == "10001:101" ]] || { echo "ERROR: backend container user is $container_user" >&2; exit 1; }

networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "$backend_container" \
  | python3 -c 'import json, sys; print("\n".join(sorted(json.load(sys.stdin))))')"
[[ "$networks" == $'iceforge_external\niceforge_internal' ]] || { echo "ERROR: unexpected backend networks" >&2; exit 1; }
[[ -z "$(docker port "$backend_container")" ]] || { echo "ERROR: backend publishes a host port" >&2; exit 1; }

mounts="$(docker inspect --format '{{range .Mounts}}{{println .Destination .RW}}{{end}}' "$backend_container")"
for destination in /app/logs /app/uploads/images; do
  grep -Fxq "$destination true" <<<"$mounts" || { echo "ERROR: writable mount missing: $destination" >&2; exit 1; }
done

runtime_uid="$(docker exec "$backend_container" id -u)"
runtime_gid="$(docker exec "$backend_container" id -g)"
[[ "$runtime_uid" == "10001" ]] || { echo "ERROR: backend runtime UID is $runtime_uid" >&2; exit 1; }
[[ "$runtime_gid" == "101" ]] || { echo "ERROR: backend runtime GID is $runtime_gid" >&2; exit 1; }
java_version="$(docker exec "$backend_container" java -version 2>&1)"
grep -Fq '25.0.4' <<<"$java_version" || { echo "ERROR: backend is not running Java 25.0.4" >&2; exit 1; }
docker exec "$backend_container" wget -q --spider http://127.0.0.1:8080/api/front/members \
  || { echo "ERROR: local backend API probe failed" >&2; exit 1; }
if docker exec "$backend_container" touch /app/.root-filesystem-write-check >/dev/null 2>&1; then
  docker exec "$backend_container" rm -f /app/.root-filesystem-write-check
  echo "ERROR: backend root filesystem accepted a write" >&2
  exit 1
fi

docker exec -i iceforge_db psql -U iceforge -d iceforge_db \
  <"${rollout_dir}/verify-flyway-v28.sql" >/dev/null \
  || { echo "ERROR: Flyway V28 verification failed" >&2; exit 1; }
curl --fail --silent --show-error --output /dev/null https://iceforge.fr/api/front/members \
  || { echo "ERROR: public backend API probe failed" >&2; exit 1; }

recent_logs="$(docker logs --since 10m "$backend_container" 2>&1)"
if grep -Eiq '(^|[[:space:]])ERROR([[:space:]]|$)|Application run failed|Schema-validation|Validate failed' <<<"$recent_logs"; then
  echo "ERROR: backend error marker found in recent logs" >&2
  exit 1
fi

echo "Java 25 / Spring Boot 4.1 production runtime: OK"
