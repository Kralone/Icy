#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-config}"
if [[ "$mode" != "config" && "$mode" != "runtime" ]]; then
  echo "Usage: FRONTEND_IMAGE=<immutable-tag> $0 [config|runtime]" >&2
  exit 2
fi

iceforge_root="${ICEFORGE_ROOT:-/root/iceforge}"
rollout_dir="${FRONTEND_ROLLOUT_DIR:-${iceforge_root}/ops/frontend-rollout}"
frontend_image="${FRONTEND_IMAGE:?FRONTEND_IMAGE must be set}"
frontend_container="${FRONTEND_CONTAINER:-iceforge_frontend}"

required_files=(
  "${iceforge_root}/.env"
  "${iceforge_root}/.secrets/vault/compose.prod.env"
  "${iceforge_root}/docker-compose.yml"
  "${iceforge_root}/docker-compose.vault.yml"
  "${iceforge_root}/ops/network-hardening/docker-compose.network-hardening.yml"
  "${rollout_dir}/docker-compose.frontend-angular22.yml"
  "${rollout_dir}/nginx.prod.conf"
  "${rollout_dir}/default.prod.conf"
  "${rollout_dir}/verify-compose.py"
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
  -f "${rollout_dir}/docker-compose.frontend-angular22.yml"
)

docker image inspect "$frontend_image" >/dev/null
FRONTEND_IMAGE="$frontend_image" FRONTEND_ROLLOUT_DIR="$rollout_dir" \
  "${compose[@]}" config --quiet
FRONTEND_IMAGE="$frontend_image" FRONTEND_ROLLOUT_DIR="$rollout_dir" \
  "${compose[@]}" config --format json \
  | EXPECTED_FRONTEND_IMAGE="$frontend_image" python3 "${rollout_dir}/verify-compose.py"

if [[ "$mode" == "config" ]]; then
  exit 0
fi

running="$(docker inspect --format '{{.State.Running}}' "$frontend_container")"
health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$frontend_container")"
actual_image="$(docker inspect --format '{{.Config.Image}}' "$frontend_container")"
actual_id="$(docker inspect --format '{{.Image}}' "$frontend_container")"
expected_id="$(docker image inspect --format '{{.Id}}' "$frontend_image")"
read_only="$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$frontend_container")"
container_user="$(docker inspect --format '{{.Config.User}}' "$frontend_container")"
cap_add="$(docker inspect --format '{{json .HostConfig.CapAdd}}' "$frontend_container")"

[[ "$running" == "true" ]] || { echo "ERROR: frontend is not running" >&2; exit 1; }
[[ "$health" == "healthy" ]] || { echo "ERROR: frontend health is $health" >&2; exit 1; }
[[ "$actual_image" == "$frontend_image" ]] || { echo "ERROR: frontend tag differs from requested tag" >&2; exit 1; }
[[ "$actual_id" == "$expected_id" ]] || { echo "ERROR: frontend image ID differs from the loaded image" >&2; exit 1; }
[[ "$read_only" == "true" ]] || { echo "ERROR: frontend root filesystem is writable" >&2; exit 1; }
[[ "$container_user" == "0:0" || "$container_user" == "0" ]] || { echo "ERROR: nginx master user is not root" >&2; exit 1; }
for capability in CAP_CHOWN CAP_SETGID CAP_SETUID; do
  grep -Fq "\"${capability}\"" <<<"$cap_add" || { echo "ERROR: required nginx capability is missing: $capability" >&2; exit 1; }
done
[[ "$(grep -o 'CAP_' <<<"$cap_add" | wc -l)" -eq 3 ]] || { echo "ERROR: unexpected extra frontend capability" >&2; exit 1; }

networks="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "$frontend_container" \
  | python3 -c 'import json, sys; print("\\n".join(sorted(json.load(sys.stdin))))')"
[[ "$networks" == $'iceforge_external\niceforge_internal' ]] || { echo "ERROR: unexpected frontend networks" >&2; exit 1; }

ports="$(docker port "$frontend_container" | sort)"
grep -Eq '^8080/tcp -> (0\.0\.0\.0|\[::\]):80$' <<<"$ports" || { echo "ERROR: public HTTP mapping is missing" >&2; exit 1; }
grep -Eq '^8443/tcp -> (0\.0\.0\.0|\[::\]):443$' <<<"$ports" || { echo "ERROR: public HTTPS mapping is missing" >&2; exit 1; }

mounts="$(docker inspect --format '{{range .Mounts}}{{println .Destination .RW}}{{end}}' "$frontend_container")"
for destination in /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf /etc/letsencrypt /usr/share/nginx/html/images; do
  grep -Fxq "$destination false" <<<"$mounts" || { echo "ERROR: read-only mount missing: $destination" >&2; exit 1; }
done

docker exec "$frontend_container" nginx -t >/dev/null
docker exec "$frontend_container" nginx -T 2>&1 | grep -Fq 'user nginx;'
process_users="$(docker top "$frontend_container" -eo user,pid,comm)"
grep -Eq '^root[[:space:]]+[0-9]+[[:space:]]+nginx$' <<<"$process_users" || { echo "ERROR: nginx master is not running as root" >&2; exit 1; }
grep -Eq '^(nginx|101)[[:space:]]+[0-9]+[[:space:]]+nginx$' <<<"$process_users" || { echo "ERROR: nginx workers are not running as UID 101" >&2; exit 1; }
image_count="$(docker exec "$frontend_container" sh -c 'find /usr/share/nginx/html/images -type f | wc -l')"
[[ "$image_count" -gt 0 ]] || { echo "ERROR: the shared image volume is empty" >&2; exit 1; }

for path in / /recrutement /guides/minage-star-citizen /utilitaires /assets/version.json /api/front/members; do
  curl --fail --silent --show-error --output /dev/null "https://iceforge.fr${path}"
done

if docker logs --since 10m "$frontend_container" 2>&1 | grep -Eiq '\[(emerg|alert|crit)\]'; then
  echo "ERROR: critical nginx marker found in recent logs" >&2
  exit 1
fi

echo "Angular 22 production runtime: OK (${image_count} shared images)"
