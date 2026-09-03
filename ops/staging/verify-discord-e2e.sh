#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
PROJECT=iceforge_staging
RELEASE_DIR=${1:-/opt/iceforge-staging/current}
[[ $EUID -eq 0 ]] || { echo "verify-discord-e2e.sh doit etre execute en root" >&2; exit 1; }
RELEASE_DIR=$(readlink -f "$RELEASE_DIR")
[[ $RELEASE_DIR == /opt/iceforge-staging/releases/* ]] || { echo "Release invalide" >&2; exit 1; }
[[ -f $ENV_FILE && ! -L $ENV_FILE ]] || { echo "Fichier env invalide" >&2; exit 1; }
command -v curl >/dev/null
command -v jq >/dev/null

set -a
source "$ENV_FILE"
set +a
COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$RELEASE_DIR/docker-compose.staging.yml")
for service in db rabbitmq backend bot frontend; do
  [[ -n $("${COMPOSE[@]}" --profile discord ps -q "$service") ]] || { echo "$service absent" >&2; exit 1; }
done

base_uri=http://127.0.0.1:${STAGING_HTTP_PORT:-19088}
started_at=$(date --iso-8601=seconds)
title="ICEFORGE-STAGING-E2E-$(date +%s)-$RANDOM"
event_id=
access_token=

cleanup() {
  if [[ -n $event_id && -n $access_token ]]; then
    curl --silent --output /dev/null --request DELETE \
      --header "Authorization: Bearer $access_token" \
      "$base_uri/api/events?id=$event_id" || true
  fi
  unset access_token STAGING_DISCORD_TOKEN STAGING_POSTGRES_PASSWORD \
    STAGING_RABBITMQ_PASSWORD STAGING_JWT_SECRET STAGING_BOT_API_KEY
}
trap cleanup EXIT

login=$(curl --fail --silent --show-error \
  --header 'Content-Type: application/json' \
  --data '{"username":"validation_admin","password":"password"}' \
  "$base_uri/api/auth/login")
access_token=$(jq -er '.tokens.accessToken' <<<"$login")
unset login

start_time=$(date -u -d '+2 hours' '+%Y-%m-%dT%H:%M:%S')
end_time=$(date -u -d '+3 hours' '+%Y-%m-%dT%H:%M:%S')
create_payload=$(jq -cn \
  --arg type VALIDATION --arg title "$title" \
  --arg description 'Cycle Discord jetable' \
  --arg start "$start_time" --arg endAt "$end_time" \
  '{type:$type,title:$title,description:$description,startDateTime:$start,endDateTime:$endAt}')
created=$(curl --fail --silent --show-error \
  --header "Authorization: Bearer $access_token" \
  --header 'Content-Type: application/json' --data "$create_payload" \
  "$base_uri/api/events/create")
event_id=$(jq -er '.data.id' <<<"$created")
[[ $event_id =~ ^[0-9a-f-]{36}$ ]] || { echo "ID event invalide" >&2; exit 1; }
unset created create_payload

db_cid=$("${COMPOSE[@]}" ps -q db)
bot_cid=$("${COMPOSE[@]}" --profile discord ps -q bot)
rabbit_cid=$("${COMPOSE[@]}" ps -q rabbitmq)
link=
for _ in $(seq 1 30); do
  link=$(docker exec "$db_cid" psql -X -At -U "$STAGING_POSTGRES_USER" \
    -d "$STAGING_POSTGRES_DB" -c \
    "SELECT discord_channel_id || '|' || discord_message_id FROM events.events WHERE id='$event_id' AND discord_channel_id IS NOT NULL AND discord_message_id IS NOT NULL")
  [[ -n $link ]] && break
  sleep 1
done
[[ $link == "$STAGING_DISCORD_EVENTS_CHANNEL_ID|"* ]] || { echo "Liaison Discord absente ou mauvais salon" >&2; exit 1; }

duplicate_payload=$(jq -cn --arg id "$event_id" --arg title "$title" \
  --arg start "$start_time" \
  '{id:$id,title:$title,description:"Cycle Discord jetable",author:"validation_admin",date:$start,type:{name:"VALIDATION",color:"#123456",imageUrl:null},participants:[]}')
docker exec -e "ICEFORGE_E2E_PAYLOAD=$duplicate_payload" "$rabbit_cid" sh -ceu '
  rabbitmqadmin --username "$RABBITMQ_DEFAULT_USER" --password "$RABBITMQ_DEFAULT_PASS" \
    publish exchange=icy.exchange routing_key=events.created payload="$ICEFORGE_E2E_PAYLOAD" >/dev/null
'
for _ in $(seq 1 20); do
  logs=$(docker logs --since "$started_at" "$bot_cid" 2>&1)
  grep -Fq "Message Discord existant réutilisé pour eventId=$event_id" <<<"$logs" && break
  sleep 1
done
grep -Fq "Message Discord existant réutilisé pour eventId=$event_id" <<<"$logs" || { echo "Deduplication Discord non prouvee" >&2; exit 1; }

updated_title="$title-UPDATED"
update_payload=$(jq -cn --arg id "$event_id" --arg type VALIDATION \
  --arg title "$updated_title" --arg description 'Cycle Discord mis a jour' \
  --arg start "$start_time" --arg endAt "$end_time" \
  '{id:$id,type:$type,title:$title,description:$description,startDateTime:$start,endDateTime:$endAt,finished:false}')
curl --fail --silent --show-error --output /dev/null --request PUT \
  --header "Authorization: Bearer $access_token" \
  --header 'Content-Type: application/json' --data "$update_payload" \
  "$base_uri/api/events/update"
for _ in $(seq 1 20); do
  logs=$(docker logs --since "$started_at" "$bot_cid" 2>&1)
  grep -Fq "($updated_title)" <<<"$logs" && break
  sleep 1
done
grep -Fq "($updated_title)" <<<"$logs" || { echo "Mise a jour Discord non prouvee" >&2; exit 1; }

curl --fail --silent --show-error --output /dev/null --request DELETE \
  --header "Authorization: Bearer $access_token" \
  "$base_uri/api/events?id=$event_id"
for _ in $(seq 1 20); do
  logs=$(docker logs --since "$started_at" "$bot_cid" 2>&1)
  grep -Fq "Événement supprimé de Discord (eventId=$event_id)" <<<"$logs" && break
  sleep 1
done
grep -Fq "Événement supprimé de Discord (eventId=$event_id)" <<<"$logs" || { echo "Suppression Discord non prouvee" >&2; exit 1; }

remaining=$(docker exec "$db_cid" psql -X -At -U "$STAGING_POSTGRES_USER" \
  -d "$STAGING_POSTGRES_DB" -c "SELECT count(*) FROM events.events WHERE id='$event_id'")
[[ $remaining == 0 ]] || { echo "Event de test encore present" >&2; exit 1; }
ledger=$(docker exec -e "ICEFORGE_E2E_EVENT_ID=$event_id" "$bot_cid" python -c \
  'import os, sqlite3; c=sqlite3.connect("/app/config/discord-links.sqlite3"); print(c.execute("select count(*) from discord_links where resource_type=? and resource_id=?", ("event", os.environ["ICEFORGE_E2E_EVENT_ID"])).fetchone()[0])')
[[ $ledger == 0 ]] || { echo "Ledger Discord non nettoye" >&2; exit 1; }

errors=$(grep -Eci 'ERROR|Traceback|Exception' <<<"$logs" || true)
[[ $errors == 0 ]] || { echo "Erreurs detectees pendant le cycle Discord" >&2; exit 1; }
event_id=
echo "DISCORD-E2E=OK create=1 duplicate_reused=1 update=1 delete=1 db_cleanup=1 ledger_cleanup=1"
