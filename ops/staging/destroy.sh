#!/usr/bin/env bash
set -euo pipefail

PROJECT=iceforge_staging
ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
RELEASE_DIR=${1:-/opt/iceforge-staging/current}
[[ $EUID -eq 0 ]] || { echo "destroy.sh doit etre execute en root" >&2; exit 1; }
RELEASE_DIR=$(readlink -f "$RELEASE_DIR")
[[ $RELEASE_DIR == /opt/iceforge-staging/releases/* ]] || { echo "Release invalide" >&2; exit 1; }
docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$RELEASE_DIR/docker-compose.staging.yml" \
  --profile discord down --volumes --remove-orphans
echo "Pile et volumes iceforge_staging supprimes. Les releases et secrets sont conserves."
