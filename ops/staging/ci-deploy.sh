#!/usr/bin/env bash
# Point d'entrée unique du déploiement de staging lancé par GitHub Actions.
#
# Installé par root, hors des releases : /usr/local/sbin/iceforge-staging-ci-deploy (0755, root).
# La clé SSH de la CI est forcée sur cette commande (voir ops/staging/CI-DEPLOY.md) :
#
#   ssh iceforge-ci@SERVEUR "auto|start <sha> <digest-backend> <digest-bot> <digest-frontend>" < release.tar
#
# - auto  : installe la release ; ne recrée les services que si le staging tourne déjà.
#           Un staging en veille (suspend.sh) reste en veille, release prête pour deploy.sh.
# - start : installe et déploie, même si le staging était en veille.
#
# Les images sont tirées du registre configuré par root (/etc/iceforge-staging/ci-deploy.conf),
# par digest uniquement, puis taguées iceforge/<composant>:<sha> comme une release manuelle.
# Ce script ne touche jamais au projet Compose de production « iceforge ».
set -Eeuo pipefail

CONF_FILE=/etc/iceforge-staging/ci-deploy.conf
RELEASES_DIR=/opt/iceforge-staging/releases
ENV_FILE=/etc/iceforge-staging/staging.env
PROJECT=iceforge_staging
MAX_BUNDLE_BYTES=$((20 * 1024 * 1024))
RELEASE_FILES=(
  docker-compose.staging.yml prepare-env.sh configure-discord.sh install-release.sh deploy.sh
  verify.sh verify-discord-e2e.sh destroy.sh suspend.sh resume.sh validation-fixtures.sql
  README.md release.json
)
EXECUTABLES=(
  prepare-env.sh configure-discord.sh install-release.sh deploy.sh verify.sh
  verify-discord-e2e.sh destroy.sh suspend.sh resume.sh
)

fail() { echo "CI-DEPLOY=REFUS $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail 'exécution en root requise (sudo).'
# Appel par la commande forcée : les arguments viennent de SSH_ORIGINAL_COMMAND, découpés par le shell.
(($# == 5)) || fail 'usage: auto|start <sha> <digest-backend> <digest-bot> <digest-frontend>'
MODE=$1 REVISION=$2
declare -A DIGESTS=([backend]=$3 [bot]=$4 [frontend]=$5)
[[ $MODE == auto || $MODE == start ]] || fail "mode inconnu: $MODE"
[[ $REVISION =~ ^[0-9a-f]{40}$ ]] || fail 'révision Git invalide.'
for component in backend bot frontend; do
  [[ ${DIGESTS[$component]} =~ ^sha256:[0-9a-f]{64}$ ]] || fail "digest $component invalide."
done

[[ -f $CONF_FILE && ! -L $CONF_FILE && $(stat -c '%U %a' "$CONF_FILE") == 'root 600' ]] \
  || fail "$CONF_FILE absent, ou pas en root 0600."
IMAGE_PREFIX=$(sed -n 's/^IMAGE_PREFIX=//p' "$CONF_FILE" | tail -n 1)
# Registre fixé côté serveur : la CI ne choisit ni l'hôte ni le dépôt des images.
[[ $IMAGE_PREFIX =~ ^ghcr\.io/[a-z0-9-]+/iceforge-$ ]] || fail 'IMAGE_PREFIX invalide dans la configuration.'
[[ -f $ENV_FILE ]] || fail "staging non initialisé ($ENV_FILE absent) : première installation à faire à la main."

exec 9>/run/lock/iceforge-staging-ci-deploy.lock
flock -n 9 || fail 'un autre déploiement de staging est en cours.'

# --- Fichiers de la release, reçus sur l'entrée standard (archive tar sans dossier).
RELEASE_DIR=$RELEASES_DIR/$REVISION
work=$(mktemp -d /tmp/iceforge-staging-ci.XXXXXX)
cleanup() { rm -rf -- "$work"; }
trap cleanup EXIT
head -c $((MAX_BUNDLE_BYTES + 1)) >"$work/release.tar"
size=$(stat -c %s "$work/release.tar")
((size <= MAX_BUNDLE_BYTES)) || fail 'archive de release trop grande.'

if [[ -d $RELEASE_DIR ]]; then
  # Relance d'une révision déjà installée : les fichiers en place font foi.
  [[ ! -L $RELEASE_DIR ]] || fail 'répertoire de release invalide.'
  echo "release déjà présente : $RELEASE_DIR"
else
  ((size > 0)) || fail 'archive de release vide.'
  # Uniquement des fichiers ordinaires attendus, à la racine de l'archive.
  mapfile -t listing < <(tar --list --verbose --file "$work/release.tar")
  mapfile -t names < <(tar --list --file "$work/release.tar")
  ((${#names[@]} == ${#RELEASE_FILES[@]})) || fail "archive : ${#names[@]} entrées pour ${#RELEASE_FILES[@]} attendues."
  for line in "${listing[@]}"; do
    [[ $line == -* ]] || fail "entrée non ordinaire dans l'archive : $line"
  done
  for name in "${names[@]}"; do
    found=0
    for expected in "${RELEASE_FILES[@]}"; do [[ $name == "$expected" ]] && found=1; done
    ((found)) || fail "fichier inattendu dans l'archive : $name"
  done
  install -d -m 0700 "$work/files"
  tar --extract --file "$work/release.tar" --directory "$work/files" --no-same-owner --no-same-permissions
  grep -Fq "\"revision\": \"$REVISION\"" "$work/files/release.json" || fail 'release.json ne porte pas cette révision.'

  install -d -m 0750 "$RELEASES_DIR"
  staging_dir=$(mktemp -d "$RELEASES_DIR/.incoming-$REVISION.XXXXXX")
  for file in "${RELEASE_FILES[@]}"; do
    mode=0640
    for exe in "${EXECUTABLES[@]}"; do [[ $file == "$exe" ]] && mode=0750; done
    install -o root -g root -m "$mode" "$work/files/$file" "$staging_dir/$file"
  done
  chmod 0750 "$staging_dir"
  mv -T "$staging_dir" "$RELEASE_DIR"
  echo "release installée : $RELEASE_DIR"
fi

# --- Images : tirées par digest, puis nommées comme une release manuelle.
for component in backend bot frontend; do
  ref="${IMAGE_PREFIX}${component}@${DIGESTS[$component]}"
  docker pull --quiet "$ref" >/dev/null
  docker tag "$ref" "iceforge/${component}:${REVISION}"
done
"$RELEASE_DIR/install-release.sh" --revision "$REVISION" --preloaded-images

# --- Démarrage : en mode auto, seulement si le staging tourne déjà.
running_backend=$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=backend" </dev/null)
running_bot=$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=bot" </dev/null)
if [[ $MODE == auto && -z $running_backend ]]; then
  echo "CI-DEPLOY=INSTALLED revision=$REVISION staging=en-veille (démarrage : deploy.sh --release-dir $RELEASE_DIR)"
  exit 0
fi

deploy_args=(--release-dir "$RELEASE_DIR")
# Un bot de staging déjà en marche est recréé avec la release ; sinon il reste arrêté.
[[ -n $running_bot ]] && deploy_args+=(--with-bot)
"$RELEASE_DIR/deploy.sh" "${deploy_args[@]}"
echo "CI-DEPLOY=DEPLOYED revision=$REVISION bot=$([[ -n $running_bot ]] && echo oui || echo non)"
