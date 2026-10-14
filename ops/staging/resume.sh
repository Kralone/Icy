#!/usr/bin/env bash
# Sort le staging de veille : redémarre les conteneurs existants avec leurs volumes, sans rien recréer ni télécharger.
# Pour une nouvelle release, utiliser install-release.sh puis deploy.sh comme d'habitude.
set -euo pipefail

PROJECT=${ICEFORGE_STAGING_PROJECT:-iceforge_staging}
ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
COMPOSE_FILE=${ICEFORGE_STAGING_COMPOSE_FILE:-/opt/iceforge-staging/current/docker-compose.staging.yml}
TIMEOUT_SECONDS=900

[[ $EUID -eq 0 ]] || { echo 'resume.sh doit être exécuté en root.' >&2; exit 1; }
[[ $PROJECT =~ ^iceforge_staging(_test[a-z0-9]+)?$ ]] || { echo "Projet refusé : $PROJECT" >&2; exit 1; }
[[ -f $ENV_FILE && ! -L $ENV_FILE && -f $COMPOSE_FILE ]] || { echo 'Configuration du staging introuvable.' >&2; exit 1; }
command -v jq >/dev/null || { echo 'jq est requis.' >&2; exit 1; }

existing=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" -q </dev/null | wc -l)
((existing > 0)) || { echo "Aucun conteneur $PROJECT à redémarrer : déployer le staging avec deploy.sh." >&2; exit 1; }

compose=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile discord)
"${compose[@]}" config --quiet
"${compose[@]}" start

# Attente : chaque conteneur en marche, et sain quand il a un contrôle de santé (le service d'initialisation « no » se termine seul).
deadline=$(( $(date +%s) + TIMEOUT_SECONDS ))
while :; do
  pending=$(for id in $(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" -q </dev/null); do
      docker inspect "$id" </dev/null | jq -r '.[0] | "\(.Name) \(.HostConfig.RestartPolicy.Name) \(.State.Status) \(.State.Health.Status // "none")"'
    done | awk '$2 != "no" && ($3 != "running" || ($4 != "healthy" && $4 != "none")) { print $1 }')
  [[ -z $pending ]] && break
  (( $(date +%s) < deadline )) || { echo "ÉCHEC : services non prêts : $(echo $pending)" >&2; exit 1; }
  sleep 5
done
echo "STAGING-RESUMED=OK project=$PROJECT conteneurs=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" -q </dev/null | wc -l)"
