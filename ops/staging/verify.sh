#!/usr/bin/env bash
set -euo pipefail

PROJECT=iceforge_staging
ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
RELEASE_DIR=
WITH_BOT=0

while (($#)); do
  case "$1" in
    --release-dir) RELEASE_DIR=${2:?}; shift 2 ;;
    --with-bot) WITH_BOT=1; shift ;;
    *) echo "Option inconnue: $1" >&2; exit 2 ;;
  esac
done
[[ $RELEASE_DIR == /opt/iceforge-staging/releases/* && -d $RELEASE_DIR ]] || { echo "Release invalide" >&2; exit 1; }
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$RELEASE_DIR/docker-compose.staging.yml")

required=(db rabbitmq backend frontend)
((WITH_BOT)) && required+=(bot)
for service in "${required[@]}"; do
  cid=$("${COMPOSE[@]}" ps -q "$service")
  [[ -n $cid ]] || { echo "$service absent" >&2; exit 1; }
  state=$(docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}' "$cid")
  IFS='|' read -r status health restarts <<<"$state"
  [[ $status == running ]] || { echo "$service non demarre" >&2; exit 1; }
  [[ $health == healthy || $health == none ]] || { echo "$service non sain: $health" >&2; exit 1; }
  [[ $restarts == 0 ]] || { echo "$service a redemarre $restarts fois" >&2; exit 1; }
done

port=$(sed -n 's/^STAGING_HTTP_PORT=//p' "$ENV_FILE" | tail -n 1)
port=${port:-19088}
curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:${port}/" >/dev/null
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${port}/destination-staging-introuvable")
[[ $status == 404 ]] || { echo "La route inconnue renvoie $status au lieu de 404" >&2; exit 1; }
api_status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${port}/api/front/members")
[[ $api_status == 200 ]] || { echo "Le smoke API renvoie $api_status" >&2; exit 1; }
echo "STAGING-SMOKE=OK services=${required[*]} http=200 unknown=404 api=200"
