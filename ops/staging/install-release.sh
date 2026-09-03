#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
REVISION=
IMAGE_ARCHIVE=
EXPECTED_SHA256=

usage() {
  echo "Usage: install-release.sh --revision SHA --image-archive /chemin/images.tar --sha256 HEX" >&2
}

while (($#)); do
  case "$1" in
    --revision) REVISION=${2:?}; shift 2 ;;
    --image-archive) IMAGE_ARCHIVE=${2:?}; shift 2 ;;
    --sha256) EXPECTED_SHA256=${2:?}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "install-release.sh doit etre execute en root" >&2; exit 1; }
[[ $REVISION =~ ^[0-9a-f]{7,40}$ ]] || { echo "Revision Git invalide" >&2; exit 1; }
[[ $IMAGE_ARCHIVE == /* && -f $IMAGE_ARCHIVE && ! -L $IMAGE_ARCHIVE ]] || { echo "Archive image invalide" >&2; exit 1; }
[[ $EXPECTED_SHA256 =~ ^[0-9a-fA-F]{64}$ ]] || { echo "SHA-256 invalide" >&2; exit 1; }
actual_sha256=$(sha256sum "$IMAGE_ARCHIVE" | awk '{print $1}')
[[ ${actual_sha256,,} == ${EXPECTED_SHA256,,} ]] || { echo "SHA-256 de l'archive image incorrect" >&2; exit 1; }

RELEASE_DIR=/opt/iceforge-staging/releases/$REVISION
[[ -d $RELEASE_DIR && ! -L $RELEASE_DIR ]] || { echo "Release absente: $RELEASE_DIR" >&2; exit 1; }
for file in docker-compose.staging.yml deploy.sh verify.sh verify-discord-e2e.sh destroy.sh prepare-env.sh configure-discord.sh validation-fixtures.sql; do
  [[ -f $RELEASE_DIR/$file && ! -L $RELEASE_DIR/$file ]] || { echo "Fichier de release absent: $file" >&2; exit 1; }
done

docker image load --input "$IMAGE_ARCHIVE" >/dev/null
for component in backend bot frontend; do
  docker image inspect "iceforge/${component}:${REVISION}" >/dev/null
done

"$RELEASE_DIR/prepare-env.sh" "$ENV_FILE"
tmp_env=$(mktemp "$(dirname -- "$ENV_FILE")/.staging.env.XXXXXX")
cleanup() { rm -f -- "$tmp_env"; }
trap cleanup EXIT
grep -Ev '^STAGING_(BACKEND|BOT|FRONTEND)_IMAGE=' "$ENV_FILE" >"$tmp_env" || true
cat >>"$tmp_env" <<EOF
STAGING_BACKEND_IMAGE=iceforge/backend:$REVISION
STAGING_BOT_IMAGE=iceforge/bot:$REVISION
STAGING_FRONTEND_IMAGE=iceforge/frontend:$REVISION
EOF
chown root:root "$tmp_env"
chmod 0600 "$tmp_env"
mv -fT "$tmp_env" "$ENV_FILE"
trap - EXIT
echo "Release $REVISION installee; aucun service n'a encore ete recree."
