#!/usr/bin/env bash
set -euo pipefail

PROJECT=iceforge_staging
ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
RELEASE_DIR=
WITH_BOT=0
SEED=0

usage() {
  echo "Usage: deploy.sh --release-dir /opt/iceforge-staging/releases/SHA [--seed] [--with-bot]" >&2
}

while (($#)); do
  case "$1" in
    --release-dir) RELEASE_DIR=${2:?}; shift 2 ;;
    --seed) SEED=1; shift ;;
    --with-bot) WITH_BOT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "deploy.sh doit etre execute en root" >&2; exit 1; }
[[ $RELEASE_DIR == /opt/iceforge-staging/releases/* ]] || { echo "Release hors du repertoire autorise" >&2; exit 1; }
[[ -d $RELEASE_DIR && ! -L $RELEASE_DIR ]] || { echo "Release absente ou invalide" >&2; exit 1; }
[[ -f $ENV_FILE && ! -L $ENV_FILE ]] || { echo "Fichier env absent ou invalide" >&2; exit 1; }
[[ $(stat -c %a "$ENV_FILE") == 600 ]] || { echo "Le fichier env doit etre en mode 0600" >&2; exit 1; }

COMPOSE=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$RELEASE_DIR/docker-compose.staging.yml")
"${COMPOSE[@]}" config --quiet

for image_key in STAGING_BACKEND_IMAGE STAGING_BOT_IMAGE STAGING_FRONTEND_IMAGE; do
  image=$(sed -n "s/^${image_key}=//p" "$ENV_FILE" | tail -n 1)
  [[ -n $image ]] || { echo "$image_key absent" >&2; exit 1; }
  docker image inspect "$image" >/dev/null
done

if ((!WITH_BOT)); then
  # A bot enabled by an older release must never survive an ordinary web deploy.
  "${COMPOSE[@]}" --profile discord rm --stop --force bot >/dev/null 2>&1 || true
fi

"${COMPOSE[@]}" up -d --wait db rabbitmq backend frontend

if ((SEED)); then
  marker=$RELEASE_DIR/.seeded
  [[ ! -e $marker ]] || { echo "Fixtures deja injectees pour cette release" >&2; exit 1; }
  cid=$("${COMPOSE[@]}" ps -q db)
  docker exec -i "$cid" sh -ceu 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    <"$RELEASE_DIR/validation-fixtures.sql"
  install -m 0600 /dev/null "$marker"
fi

if ((WITH_BOT)); then
  for key in STAGING_DISCORD_TOKEN STAGING_GUILD_ID; do
    value=$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)
    [[ -n $value ]] || { echo "$key doit etre renseigne pour demarrer le bot" >&2; exit 1; }
  done
  "${COMPOSE[@]}" --profile discord up -d --wait bot
fi

install -d -m 0750 /opt/iceforge-staging
previous=
if [[ -L /opt/iceforge-staging/current ]]; then
  previous=$(readlink -f /opt/iceforge-staging/current || true)
fi
ln -sfn "$RELEASE_DIR" /opt/iceforge-staging/current.new
mv -Tf /opt/iceforge-staging/current.new /opt/iceforge-staging/current
if [[ -n $previous && $previous != "$RELEASE_DIR" ]]; then
  ln -sfn "$previous" /opt/iceforge-staging/previous
fi

verify_args=(--release-dir "$RELEASE_DIR")
((WITH_BOT)) && verify_args+=(--with-bot)
"$RELEASE_DIR/verify.sh" "${verify_args[@]}"
echo "Staging deploye depuis $RELEASE_DIR"
