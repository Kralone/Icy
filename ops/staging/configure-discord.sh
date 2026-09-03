#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
[[ $EUID -eq 0 ]] || { echo "configure-discord.sh doit etre execute en root" >&2; exit 1; }
[[ -f $ENV_FILE && ! -L $ENV_FILE ]] || { echo "Fichier env absent ou invalide" >&2; exit 1; }
[[ $(stat -c %a "$ENV_FILE") == 600 ]] || { echo "Le fichier env doit etre en mode 0600" >&2; exit 1; }

read -r -s -p 'Token du bot Discord temporaire: ' discord_token
echo
read -r -p 'ID du serveur Discord temporaire: ' guild_id
read -r -p 'ID salon events (optionnel): ' events_id
read -r -p 'ID salon news (optionnel): ' news_id
read -r -p 'ID salon notifications (optionnel): ' notifications_id
read -r -p 'ID salon discussion (optionnel): ' discussion_id

[[ -n $discord_token ]] || { echo "Token vide refuse" >&2; exit 1; }
[[ $guild_id =~ ^[0-9]{15,22}$ ]] || { echo "ID serveur invalide" >&2; exit 1; }
for value in "$events_id" "$news_id" "$notifications_id" "$discussion_id"; do
  [[ -z $value || $value =~ ^[0-9]{15,22}$ ]] || { echo "ID salon invalide" >&2; exit 1; }
done

tmp_env=$(mktemp "$(dirname -- "$ENV_FILE")/.staging.env.XXXXXX")
cleanup() {
  unset discord_token guild_id events_id news_id notifications_id discussion_id
  rm -f -- "$tmp_env"
}
trap cleanup EXIT
grep -Ev '^STAGING_(DISCORD_TOKEN|GUILD_ID|DISCORD_EVENTS_CHANNEL_ID|DISCORD_NEWS_CHANNEL_ID|DISCORD_NOTIFICATIONS_CHANNEL_ID|DISCORD_DISCUSSION_CHANNEL_ID)=' "$ENV_FILE" >"$tmp_env" || true
{
  printf 'STAGING_DISCORD_TOKEN=%s\n' "$discord_token"
  printf 'STAGING_GUILD_ID=%s\n' "$guild_id"
  printf 'STAGING_DISCORD_EVENTS_CHANNEL_ID=%s\n' "$events_id"
  printf 'STAGING_DISCORD_NEWS_CHANNEL_ID=%s\n' "$news_id"
  printf 'STAGING_DISCORD_NOTIFICATIONS_CHANNEL_ID=%s\n' "$notifications_id"
  printf 'STAGING_DISCORD_DISCUSSION_CHANNEL_ID=%s\n' "$discussion_id"
} >>"$tmp_env"
chown root:root "$tmp_env"
chmod 0600 "$tmp_env"
mv -fT "$tmp_env" "$ENV_FILE"
trap - EXIT
unset discord_token guild_id events_id news_id notifications_id discussion_id
echo "Identite Discord temporaire configuree sans afficher le token."
