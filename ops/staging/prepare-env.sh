#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${1:-/etc/iceforge-staging/staging.env}
[[ $EUID -eq 0 ]] || { echo "prepare-env.sh doit etre execute en root" >&2; exit 1; }
[[ $ENV_FILE == /* ]] || { echo "Le chemin du fichier env doit etre absolu" >&2; exit 1; }
command -v openssl >/dev/null

install -d -m 0700 -o root -g root "$(dirname -- "$ENV_FILE")"
if [[ -e $ENV_FILE ]]; then
  [[ -f $ENV_FILE && ! -L $ENV_FILE ]] || { echo "Fichier env non regulier" >&2; exit 1; }
  chmod 0600 "$ENV_FILE"
  echo "Fichier existant conserve: $ENV_FILE"
  exit 0
fi

umask 077
postgres_password=$(openssl rand -hex 32)
rabbitmq_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 64)
bot_api_key=$(openssl rand -hex 32)

cat >"$ENV_FILE" <<EOF
STAGING_POSTGRES_USER=iceforge_staging
STAGING_POSTGRES_PASSWORD=$postgres_password
STAGING_POSTGRES_DB=iceforge_staging
STAGING_RABBITMQ_USER=iceforge_staging
STAGING_RABBITMQ_PASSWORD=$rabbitmq_password
STAGING_RABBITMQ_VHOST=/
STAGING_JWT_SECRET=$jwt_secret
STAGING_BOT_API_KEY=$bot_api_key
STAGING_HTTP_PORT=19088
STAGING_INTERNAL_SUBNET=10.254.40.0/24
STAGING_FRONTEND_IP=10.254.40.10

# Renseigner uniquement les identifiants du bot Discord temporaire de test.
STAGING_DISCORD_TOKEN=
STAGING_GUILD_ID=
STAGING_DISCORD_EVENTS_CHANNEL_ID=
STAGING_DISCORD_NEWS_CHANNEL_ID=
STAGING_DISCORD_NOTIFICATIONS_CHANNEL_ID=
STAGING_DISCORD_DISCUSSION_CHANNEL_ID=
EOF
chmod 0600 "$ENV_FILE"
unset postgres_password rabbitmq_password jwt_secret bot_api_key
echo "Secrets de staging crees dans $ENV_FILE (mode 0600)."
