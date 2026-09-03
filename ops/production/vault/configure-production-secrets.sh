#!/usr/bin/env bash
set -euo pipefail

INIT_JSON=
usage() {
  echo "Usage: configure-production-secrets.sh [--init-json /chemin/prod-init.json]" >&2
}
while (($#)); do
  case "$1" in
    --init-json) INIT_JSON=${2:?chemin manquant}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

ICEFORGE_ROOT=${ICEFORGE_ROOT:-/root/iceforge}
VAULT_CONTAINER=${VAULT_CONTAINER:-iceforge_vault}
VAULT_ADDR_INTERNAL=${VAULT_ADDR_INTERNAL:-http://127.0.0.1:8200}
VAULT_MOUNT=${VAULT_MOUNT:-secret}
BACKEND_PATH=iceforge/prod/backend
BOT_PATH=iceforge/prod/bot
BACKEND_ROLE=iceforge-backend-prod
BOT_ROLE=iceforge-bot-prod
BACKEND_POLICY=iceforge-backend-prod-read
BOT_POLICY=iceforge-bot-prod-read
BASE_ENV=$ICEFORGE_ROOT/.env
SECRETS_DIR=$ICEFORGE_ROOT/.secrets/vault
COMPOSE_ENV=$SECRETS_DIR/compose.prod.env
ACCESSOR_STATE=$SECRETS_DIR/approle-accessors.prod.env

die() { printf 'ERREUR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "commande absente: $1"; }

[[ $EUID -eq 0 ]] || die 'ce script doit etre lance en root'
need docker
need jq
need awk
need mktemp
need stat
[[ -f $BASE_ENV && ! -L $BASE_ENV ]] || die "fichier absent ou invalide: $BASE_ENV"
docker inspect "$VAULT_CONTAINER" >/dev/null 2>&1 || die "conteneur Vault absent: $VAULT_CONTAINER"

admin_token=
backend_existing='{"data":{"data":{}}}'
bot_existing='{"data":{"data":{}}}'
tmp_compose=
tmp_accessors=

cleanup() {
  [[ -z ${tmp_compose:-} || ! -e $tmp_compose ]] || rm -f -- "$tmp_compose"
  [[ -z ${tmp_accessors:-} || ! -e $tmp_accessors ]] || rm -f -- "$tmp_accessors"
  unset admin_token backend_existing bot_existing jwt_secret bot_api_key \
    discord_token openai_api_key uex_api_key vapid_public vapid_private \
    postgres_password rabbit_password backend_secret_id bot_secret_id \
    backend_login bot_login backend_client_token bot_client_token
}
trap cleanup EXIT HUP INT TERM

vault_exec() {
  printf '%s\n' "$admin_token" | docker exec -i \
    -e "VAULT_ADDR=$VAULT_ADDR_INTERNAL" "$VAULT_CONTAINER" \
    sh -ceu 'IFS= read -r VAULT_TOKEN; export VAULT_TOKEN; exec vault "$@"' sh "$@"
}

vault_payload() {
  local payload=$1
  shift
  { printf '%s\n' "$admin_token"; printf '%s\n' "$payload"; } | docker exec -i \
    -e "VAULT_ADDR=$VAULT_ADDR_INTERNAL" "$VAULT_CONTAINER" \
    sh -ceu 'IFS= read -r VAULT_TOKEN; export VAULT_TOKEN; exec vault "$@"' sh "$@"
}

vault_unauthenticated_payload() {
  local payload=$1
  shift
  printf '%s\n' "$payload" | docker exec -i \
    -e "VAULT_ADDR=$VAULT_ADDR_INTERNAL" "$VAULT_CONTAINER" vault "$@"
}

vault_client_read() {
  local client_token=$1
  shift
  printf '%s\n' "$client_token" | docker exec -i \
    -e "VAULT_ADDR=$VAULT_ADDR_INTERNAL" "$VAULT_CONTAINER" \
    sh -ceu 'IFS= read -r VAULT_TOKEN; export VAULT_TOKEN; exec vault "$@"' sh "$@"
}

dotenv_value() {
  file_env_value "$BASE_ENV" "$1"
}

file_env_value() {
  local file=$1 key=$2 line value
  [[ -f $file && ! -L $file ]] || return 0
  line=$(awk -v key="$key" 'index($0, key "=") == 1 { print; exit }' "$file")
  value=${line#*=}
  if [[ $value == \"*\" && $value == *\" ]]; then value=${value:1:${#value}-2}; fi
  if [[ $value == \'*\' && $value == *\' ]]; then value=${value:1:${#value}-2}; fi
  printf '%s' "$value"
}

json_value() {
  local json=$1 key=$2
  jq -r --arg key "$key" '.data.data[$key] // empty' <<<"$json"
}

prompt_secret() {
  local variable=$1 label=$2 current=$3 required=$4 entered=
  if [[ -n $current ]]; then
    printf '%s [Entree = conserver la valeur Vault actuelle] : ' "$label" >&2
  elif [[ $required == 1 ]]; then
    printf '%s [obligatoire] : ' "$label" >&2
  else
    printf '%s [optionnel, Entree = vide] : ' "$label" >&2
  fi
  IFS= read -r -s entered
  printf '\n' >&2
  if [[ -n $entered ]]; then
    printf -v "$variable" '%s' "$entered"
  else
    printf -v "$variable" '%s' "$current"
  fi
  if [[ $required == 1 && -z ${!variable} ]]; then die "$label est obligatoire"; fi
}

prompt_value() {
  local variable=$1 label=$2 current=$3 required=$4 entered=
  if [[ -n $current ]]; then
    printf '%s [%s] : ' "$label" "$current" >&2
  else
    printf '%s : ' "$label" >&2
  fi
  IFS= read -r entered
  printf -v "$variable" '%s' "${entered:-$current}"
  if [[ $required == 1 && -z ${!variable} ]]; then die "$label est obligatoire"; fi
}

printf 'Ce programme ne redemarre aucun service et n affiche aucune valeur secrete.\n' >&2
if [[ -n $INIT_JSON ]]; then
  [[ -f $INIT_JSON && ! -L $INIT_JSON ]] || die "fichier init Vault absent ou invalide: $INIT_JSON"
  [[ $(stat -c %u "$INIT_JSON") == 0 ]] || die 'le fichier init Vault doit appartenir a root'
  init_mode=$(stat -c %a "$INIT_JSON")
  (( (8#$init_mode & 077) == 0 )) || die 'le fichier init Vault ne doit etre lisible que par root'
  admin_token=$(jq -er '.root_token' "$INIT_JSON") || die 'root_token absent du fichier init Vault'
  unset init_mode
else
  printf 'Token Vault administrateur (saisie masquee) : ' >&2
  IFS= read -r -s admin_token
  printf '\n' >&2
fi
[[ -n $admin_token ]] || die 'token Vault vide'
vault_exec token lookup -format=json >/dev/null || die 'token Vault refuse'

status_json=$(vault_exec status -format=json)
jq -e '.initialized == true and .sealed == false' <<<"$status_json" >/dev/null \
  || die 'Vault doit etre initialise et descelle avant la configuration'
unset status_json

mounts_json=$(vault_exec secrets list -format=json)
if ! jq -e --arg mount "$VAULT_MOUNT/" 'has($mount)' <<<"$mounts_json" >/dev/null; then
  vault_exec secrets enable -path="$VAULT_MOUNT" kv-v2 >/dev/null
elif ! jq -e --arg mount "$VAULT_MOUNT/" \
  '.[$mount].type == "kv" and .[$mount].options.version == "2"' \
  <<<"$mounts_json" >/dev/null; then
  die "le mount $VAULT_MOUNT existe mais ne correspond pas a KV v2"
fi
unset mounts_json

auth_json=$(vault_exec auth list -format=json)
if ! jq -e 'has("approle/")' <<<"$auth_json" >/dev/null; then
  vault_exec auth enable approle >/dev/null
elif ! jq -e '."approle/".type == "approle"' <<<"$auth_json" >/dev/null; then
  die 'le mount auth approle/ existe avec un type inattendu'
fi
unset auth_json

if backend_existing_read=$(vault_exec kv get -format=json "$VAULT_MOUNT/$BACKEND_PATH" 2>/dev/null); then
  backend_existing=$backend_existing_read
fi
if bot_existing_read=$(vault_exec kv get -format=json "$VAULT_MOUNT/$BOT_PATH" 2>/dev/null); then
  bot_existing=$bot_existing_read
fi
unset backend_existing_read bot_existing_read

postgres_user=$(dotenv_value SPRING_DATASOURCE_USERNAME)
[[ -n $postgres_user ]] || postgres_user=$(dotenv_value POSTGRES_USER)
postgres_db=$(dotenv_value POSTGRES_DB)
postgres_password=$(dotenv_value SPRING_DATASOURCE_PASSWORD)
[[ -n $postgres_password ]] || postgres_password=$(dotenv_value POSTGRES_PASSWORD)
[[ -n $postgres_user && -n $postgres_db && -n $postgres_password ]] \
  || die 'identifiants PostgreSQL incomplets dans .env'
[[ $postgres_password != change_me_local_only ]] || die 'mot de passe PostgreSQL de demonstration refuse'

rabbit_user=$(dotenv_value RABBITMQ_USER)
[[ -n $rabbit_user ]] || rabbit_user=$(dotenv_value RABBITMQ_DEFAULT_USER)
rabbit_password=$(dotenv_value RABBITMQ_PSWD)
[[ -n $rabbit_password ]] || rabbit_password=$(dotenv_value RABBITMQ_DEFAULT_PASS)
rabbit_vhost=$(dotenv_value RABBITMQ_VHOST)
[[ -n $rabbit_vhost ]] || rabbit_vhost=/
[[ -n $rabbit_user && -n $rabbit_password ]] || die 'identifiants RabbitMQ incomplets dans .env'
[[ $rabbit_password != change_me_local_only ]] || die 'mot de passe RabbitMQ de demonstration refuse'

jwt_secret=$(json_value "$backend_existing" jwt.secret)
backend_bot_key=$(json_value "$backend_existing" bot.api-key)
bot_bot_key=$(json_value "$bot_existing" BOT_API_KEY)
if [[ -n $backend_bot_key && -n $bot_bot_key && $backend_bot_key != "$bot_bot_key" ]]; then
  die 'BOT_API_KEY differe deja entre les deux chemins Vault'
fi
bot_api_key=${backend_bot_key:-$bot_bot_key}
discord_token=$(json_value "$bot_existing" DISCORD_TOKEN)
openai_api_key=$(json_value "$backend_existing" openai.api-key)
uex_api_key=$(json_value "$backend_existing" icy.uex.api-key)
vapid_public=$(json_value "$backend_existing" push.vapid.public-key)
vapid_private=$(json_value "$backend_existing" push.vapid.private-key)
vapid_subject=$(json_value "$backend_existing" push.vapid.subject)
[[ -n $vapid_subject ]] || vapid_subject=mailto:admin@iceforge.fr

guild_id=$(json_value "$bot_existing" GUILD_ID)
events_channel=$(json_value "$bot_existing" DISCORD_EVENTS_CHANNEL_ID)
news_channel=$(json_value "$bot_existing" DISCORD_NEWS_CHANNEL_ID)
notifications_channel=$(json_value "$bot_existing" DISCORD_NOTIFICATIONS_CHANNEL_ID)
discussion_channel=$(json_value "$bot_existing" DISCORD_DISCUSSION_CHANNEL_ID)

prompt_secret jwt_secret 'Secret de signature JWT (32 caracteres minimum)' "$jwt_secret" 1
prompt_secret bot_api_key 'Cle partagee backend/bot (32 caracteres minimum)' "$bot_api_key" 1
prompt_secret discord_token 'Token du bot Discord de production' "$discord_token" 1
prompt_secret openai_api_key 'Cle API OpenAI' "$openai_api_key" 0
prompt_secret uex_api_key 'Cle API UEX' "$uex_api_key" 0
prompt_secret vapid_public 'Cle publique VAPID' "$vapid_public" 0
prompt_secret vapid_private 'Cle privee VAPID' "$vapid_private" 0
prompt_value vapid_subject 'Sujet VAPID' "$vapid_subject" 1
prompt_value guild_id 'ID du serveur Discord de production' "$guild_id" 1
prompt_value events_channel 'ID du salon events' "$events_channel" 1
prompt_value news_channel 'ID du salon news' "$news_channel" 1
prompt_value notifications_channel 'ID du salon notifications' "$notifications_channel" 1
prompt_value discussion_channel 'ID du salon discussion' "$discussion_channel" 1

(( ${#jwt_secret} >= 32 )) || die 'JWT secret trop court'
(( ${#bot_api_key} >= 32 )) || die 'BOT_API_KEY trop courte'
(( ${#discord_token} >= 30 )) || die 'token Discord trop court'
for id in "$guild_id" "$events_channel" "$news_channel" "$notifications_channel" "$discussion_channel"; do
  [[ $id =~ ^[0-9]{15,25}$ ]] || die "identifiant Discord invalide: $id"
done
if [[ -n $vapid_public || -n $vapid_private ]]; then
  [[ -n $vapid_public && -n $vapid_private ]] || die 'les deux cles VAPID doivent etre renseignees ensemble'
fi

for value in "$postgres_user" "$postgres_db" "$postgres_password" "$rabbit_user" \
  "$rabbit_password" "$rabbit_vhost" "$jwt_secret" "$bot_api_key" \
  "$discord_token" "$openai_api_key" "$uex_api_key" "$vapid_public" \
  "$vapid_private" "$vapid_subject" "$guild_id" "$events_channel" \
  "$news_channel" "$notifications_channel" "$discussion_channel"; do
  [[ $value != *$'\n'* && $value != *$'\r'* ]] || die 'les valeurs multilignes sont refusees'
done

backend_existing_data=$(jq -c '.data.data // {}' <<<"$backend_existing")
bot_existing_data=$(jq -c '.data.data // {}' <<<"$bot_existing")
backend_payload=$({
  printf '%s\n' "$backend_existing_data" "jdbc:postgresql://db:5432/$postgres_db" \
    "$postgres_user" "$postgres_password" "$rabbit_user" "$rabbit_password" \
    "$rabbit_vhost" "$jwt_secret" "$bot_api_key" "$openai_api_key" \
    "$uex_api_key" 'https://iceforge.fr/images/' "$vapid_public" \
    "$vapid_private" "$vapid_subject"
} | jq -Rn '[inputs] as $v | ($v[0] | fromjson) + {
  "spring.datasource.url":$v[1],
  "spring.datasource.username":$v[2],
  "spring.datasource.password":$v[3],
  "spring.rabbitmq.host":"rabbitmq",
  "spring.rabbitmq.port":"5672",
  "spring.rabbitmq.username":$v[4],
  "spring.rabbitmq.password":$v[5],
  "spring.rabbitmq.virtual-host":$v[6],
  "jwt.secret":$v[7],
  "bot.api-key":$v[8],
  "openai.api-key":$v[9],
  "icy.uex.api-key":$v[10],
  "icy.image.base-url":$v[11],
  "push.vapid.public-key":$v[12],
  "push.vapid.private-key":$v[13],
  "push.vapid.subject":$v[14]
}')

bot_payload=$({
  printf '%s\n' "$bot_existing_data" "$discord_token" "$guild_id" \
    "$events_channel" "$news_channel" "$notifications_channel" \
    "$discussion_channel" "$bot_api_key" "$rabbit_user" \
    "$rabbit_password" "$rabbit_vhost"
} | jq -Rn '[inputs] as $v | ($v[0] | fromjson) + {
  DISCORD_TOKEN:$v[1],
  GUILD_ID:$v[2],
  DISCORD_EVENTS_CHANNEL_ID:$v[3],
  DISCORD_NEWS_CHANNEL_ID:$v[4],
  DISCORD_NOTIFICATIONS_CHANNEL_ID:$v[5],
  DISCORD_DISCUSSION_CHANNEL_ID:$v[6],
  ENV_MODE:"production",
  BOT_API_KEY:$v[7],
  RABBITMQ_HOST:"rabbitmq",
  RABBITMQ_PORT:"5672",
  RABBITMQ_USER:$v[8],
  RABBITMQ_PSWD:$v[9],
  RABBITMQ_VHOST:$v[10]
}')
unset backend_existing_data bot_existing_data

backend_policy=$(printf 'path "%s/data/%s" {\n  capabilities = ["read"]\n}\n' "$VAULT_MOUNT" "$BACKEND_PATH")
bot_policy=$(printf 'path "%s/data/%s" {\n  capabilities = ["read"]\n}\n' "$VAULT_MOUNT" "$BOT_PATH")

vault_payload "$backend_payload" kv put "$VAULT_MOUNT/$BACKEND_PATH" - >/dev/null
vault_payload "$bot_payload" kv put "$VAULT_MOUNT/$BOT_PATH" - >/dev/null
vault_payload "$backend_policy" policy write "$BACKEND_POLICY" - >/dev/null
vault_payload "$bot_policy" policy write "$BOT_POLICY" - >/dev/null

for role_policy in "$BACKEND_ROLE:$BACKEND_POLICY" "$BOT_ROLE:$BOT_POLICY"; do
  role=${role_policy%%:*}
  policy=${role_policy#*:}
  vault_exec write "auth/approle/role/$role" \
    "token_policies=$policy" token_ttl=15m token_max_ttl=1h \
    secret_id_ttl=0 secret_id_num_uses=0 bind_secret_id=true >/dev/null
done

old_backend_accessor=
old_bot_accessor=
if [[ -f $ACCESSOR_STATE && ! -L $ACCESSOR_STATE ]]; then
  old_backend_accessor=$(file_env_value "$ACCESSOR_STATE" BACKEND_SECRET_ID_ACCESSOR)
  old_bot_accessor=$(file_env_value "$ACCESSOR_STATE" BOT_SECRET_ID_ACCESSOR)
fi
if [[ -z $old_backend_accessor ]]; then
  old_backend_secret_id=$(file_env_value "$COMPOSE_ENV" BACKEND_VAULT_SECRET_ID)
  if [[ -n $old_backend_secret_id ]]; then
    old_backend_lookup_payload=$(printf '%s\n' "$old_backend_secret_id" | \
      jq -Rn '[inputs] | {secret_id:.[0]}')
    if old_backend_lookup=$(vault_payload "$old_backend_lookup_payload" write -format=json \
      "auth/approle/role/$BACKEND_ROLE/secret-id/lookup" - 2>/dev/null); then
      old_backend_accessor=$(jq -r '.data.secret_id_accessor // empty' <<<"$old_backend_lookup")
    fi
    unset old_backend_secret_id old_backend_lookup_payload old_backend_lookup
  fi
fi
if [[ -z $old_bot_accessor ]]; then
  old_bot_secret_id=$(file_env_value "$COMPOSE_ENV" BOT_VAULT_SECRET_ID)
  if [[ -n $old_bot_secret_id ]]; then
    old_bot_lookup_payload=$(printf '%s\n' "$old_bot_secret_id" | \
      jq -Rn '[inputs] | {secret_id:.[0]}')
    if old_bot_lookup=$(vault_payload "$old_bot_lookup_payload" write -format=json \
      "auth/approle/role/$BOT_ROLE/secret-id/lookup" - 2>/dev/null); then
      old_bot_accessor=$(jq -r '.data.secret_id_accessor // empty' <<<"$old_bot_lookup")
    fi
    unset old_bot_secret_id old_bot_lookup_payload old_bot_lookup
  fi
fi

backend_role_id=$(vault_exec read -field=role_id "auth/approle/role/$BACKEND_ROLE/role-id")
bot_role_id=$(vault_exec read -field=role_id "auth/approle/role/$BOT_ROLE/role-id")
backend_secret_json=$(vault_exec write -format=json -f "auth/approle/role/$BACKEND_ROLE/secret-id")
bot_secret_json=$(vault_exec write -format=json -f "auth/approle/role/$BOT_ROLE/secret-id")
backend_secret_id=$(jq -er '.data.secret_id' <<<"$backend_secret_json")
bot_secret_id=$(jq -er '.data.secret_id' <<<"$bot_secret_json")
backend_accessor=$(jq -er '.data.secret_id_accessor' <<<"$backend_secret_json")
bot_accessor=$(jq -er '.data.secret_id_accessor' <<<"$bot_secret_json")
unset backend_secret_json bot_secret_json

backend_login_payload=$(printf '%s\n%s\n' "$backend_role_id" "$backend_secret_id" | \
  jq -Rn '[inputs] | {role_id:.[0],secret_id:.[1]}')
bot_login_payload=$(printf '%s\n%s\n' "$bot_role_id" "$bot_secret_id" | \
  jq -Rn '[inputs] | {role_id:.[0],secret_id:.[1]}')
backend_login=$(vault_unauthenticated_payload "$backend_login_payload" write -format=json auth/approle/login -)
bot_login=$(vault_unauthenticated_payload "$bot_login_payload" write -format=json auth/approle/login -)
backend_client_token=$(jq -er '.auth.client_token' <<<"$backend_login")
bot_client_token=$(jq -er '.auth.client_token' <<<"$bot_login")
unset backend_login bot_login backend_login_payload bot_login_payload

backend_verified=$(vault_client_read "$backend_client_token" kv get -format=json "$VAULT_MOUNT/$BACKEND_PATH")
bot_verified=$(vault_client_read "$bot_client_token" kv get -format=json "$VAULT_MOUNT/$BOT_PATH")
jq -e '.data.data | has("jwt.secret") and has("bot.api-key") and has("spring.datasource.password") and has("spring.rabbitmq.password")' \
  <<<"$backend_verified" >/dev/null || die 'lecture AppRole backend incomplete'
jq -e '.data.data | has("DISCORD_TOKEN") and has("BOT_API_KEY") and has("RABBITMQ_PSWD")' \
  <<<"$bot_verified" >/dev/null || die 'lecture AppRole bot incomplete'
unset backend_verified bot_verified backend_client_token bot_client_token

install -d -m 0700 "$SECRETS_DIR"
tmp_compose=$(mktemp "$SECRETS_DIR/.compose.prod.env.XXXXXX")
chmod 0600 "$tmp_compose"
{
  printf 'VAULT_ENABLED=true\n'
  printf 'VAULT_ADDR=http://vault:8200\n'
  printf 'VAULT_KV_MOUNT=%s\n' "$VAULT_MOUNT"
  printf 'VAULT_FAIL_FAST=true\n'
  printf 'BACKEND_VAULT_KV_PATH=%s\n' "$BACKEND_PATH"
  printf 'BACKEND_VAULT_ROLE_ID=%s\n' "$backend_role_id"
  printf 'BACKEND_VAULT_SECRET_ID=%s\n' "$backend_secret_id"
  printf 'BOT_VAULT_KV_PATH=%s\n' "$BOT_PATH"
  printf 'BOT_VAULT_ROLE_ID=%s\n' "$bot_role_id"
  printf 'BOT_VAULT_SECRET_ID=%s\n' "$bot_secret_id"
} >"$tmp_compose"

if [[ -f $COMPOSE_ENV && ! -L $COMPOSE_ENV ]]; then
  backup="$COMPOSE_ENV.before-$(date -u +%Y%m%dT%H%M%SZ)"
  install -m 0600 "$COMPOSE_ENV" "$backup"
  printf 'Ancien fichier AppRole sauvegarde: %s\n' "$backup"
fi
mv -f -- "$tmp_compose" "$COMPOSE_ENV"
tmp_compose=

tmp_accessors=$(mktemp "$SECRETS_DIR/.approle-accessors.prod.env.XXXXXX")
chmod 0600 "$tmp_accessors"
{
  printf 'BACKEND_SECRET_ID_ACCESSOR=%s\n' "$backend_accessor"
  printf 'BOT_SECRET_ID_ACCESSOR=%s\n' "$bot_accessor"
} >"$tmp_accessors"
mv -f -- "$tmp_accessors" "$ACCESSOR_STATE"
tmp_accessors=

if [[ -n $old_backend_accessor && $old_backend_accessor != "$backend_accessor" ]]; then
  vault_exec write "auth/approle/role/$BACKEND_ROLE/secret-id-accessor/destroy" \
    "secret_id_accessor=$old_backend_accessor" >/dev/null \
    || printf 'ATTENTION: ancien Secret ID backend non detruit\n' >&2
fi
if [[ -n $old_bot_accessor && $old_bot_accessor != "$bot_accessor" ]]; then
  vault_exec write "auth/approle/role/$BOT_ROLE/secret-id-accessor/destroy" \
    "secret_id_accessor=$old_bot_accessor" >/dev/null \
    || printf 'ATTENTION: ancien Secret ID bot non detruit\n' >&2
fi

unset admin_token backend_payload bot_payload jwt_secret bot_api_key discord_token \
  openai_api_key uex_api_key vapid_public vapid_private postgres_password \
  rabbit_password backend_secret_id bot_secret_id
printf 'VAULT_PRODUCTION_CONFIG=OK paths=2 approles=2 reads=2\n'
printf 'Aucun service redemarre. Le deploiement devra reutiliser %s.\n' "$COMPOSE_ENV"
