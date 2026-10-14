#!/usr/bin/env bash
# Met le staging en veille une fois la production livrée et stable : il ne consomme plus de ressources.
#
# Seul « docker compose stop » est utilisé : conteneurs, volumes, réseaux, images, configuration et sauvegardes restent en place.
# Rien ne se fait si la production n'est pas saine. Redémarrage : ops/staging/resume.sh.
set -euo pipefail

PROJECT=${ICEFORGE_STAGING_PROJECT:-iceforge_staging}
PRODUCTION_PROJECT=iceforge
ENV_FILE=${ICEFORGE_STAGING_ENV_FILE:-/etc/iceforge-staging/staging.env}
COMPOSE_FILE=${ICEFORGE_STAGING_COMPOSE_FILE:-/opt/iceforge-staging/current/docker-compose.staging.yml}
MIN_UPTIME_MINUTES=10
SKIP_PRODUCTION_GATE=0

usage() { echo "Usage: suspend.sh [--min-uptime-minutes N]" >&2; }
while (($#)); do
  case "$1" in
    --min-uptime-minutes) MIN_UPTIME_MINUTES=${2:?}; shift 2 ;;
    # Essais isolés uniquement : le projet doit alors être un projet de test.
    --skip-production-gate) SKIP_PRODUCTION_GATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo 'suspend.sh doit être exécuté en root.' >&2; exit 1; }
# Jamais le projet de production : seul le staging, ou un projet de test explicitement nommé.
[[ $PROJECT =~ ^iceforge_staging(_test[a-z0-9]+)?$ ]] || { echo "Projet refusé : $PROJECT" >&2; exit 1; }
[[ $PROJECT != "$PRODUCTION_PROJECT" ]] || exit 1
if ((SKIP_PRODUCTION_GATE)) && [[ $PROJECT == iceforge_staging ]]; then
  echo 'Le contrôle de la production ne peut être ignoré que pour un projet de test.' >&2
  exit 1
fi
[[ $MIN_UPTIME_MINUTES =~ ^[0-9]+$ ]] || { usage; exit 2; }
[[ -f $ENV_FILE && ! -L $ENV_FILE && -f $COMPOSE_FILE ]] || { echo 'Configuration du staging introuvable.' >&2; exit 1; }
command -v jq >/dev/null || { echo 'jq est requis.' >&2; exit 1; }

production_state() {
  # Lu en JSON avec jq : les gabarits de docker inspect échouent ici sur un conteneur sans contrôle de santé.
  local id
  for id in $(docker ps -a --filter "label=com.docker.compose.project=$PRODUCTION_PROJECT" -q </dev/null); do
    docker inspect "$id" </dev/null | jq -r '.[0] | "\(.Name) \(.Id) \(.State.StartedAt) \(.State.Status) \(.State.Health.Status // "none") \(.RestartCount) \(.HostConfig.RestartPolicy.Name) \(.State.ExitCode)"'
  done | sort
}

# --- La production doit être livrée et stable : sinon le staging reste disponible pour un retour arrière ou une analyse.
before=$(production_state)
if ((!SKIP_PRODUCTION_GATE)); then
  [[ -n $before ]] || { echo 'REFUS : aucun conteneur de production trouvé.' >&2; exit 1; }
  for service in db rabbitmq vault backend bot frontend; do
    grep -q "^/${PRODUCTION_PROJECT}_${service} " <<<"$before" || { echo "REFUS : service de production absent : $service" >&2; exit 1; }
  done
  while read -r name _ started status health _ policy code; do
    # Un conteneur d'initialisation (restart « no ») terminé normalement n'est pas une panne.
    [[ $policy == no && $status == exited && $code == 0 ]] && continue
    [[ $status == running ]] || { echo "REFUS : $name n'est pas en marche ($status)." >&2; exit 1; }
    [[ $health == healthy || $health == none ]] || { echo "REFUS : $name n'est pas sain ($health)." >&2; exit 1; }
  done <<<"$before"
  started=$(docker inspect -f '{{.State.StartedAt}}' "${PRODUCTION_PROJECT}_backend" </dev/null)
  uptime=$(( $(date -u +%s) - $(date -u -d "$started" +%s) ))
  ((uptime >= MIN_UPTIME_MINUTES * 60)) || { echo "REFUS : backend de production démarré depuis ${uptime}s, moins de ${MIN_UPTIME_MINUTES} min." >&2; exit 1; }
  errors=$(docker logs --since "${MIN_UPTIME_MINUTES}m" "${PRODUCTION_PROJECT}_backend" 2>&1 </dev/null | grep -c ' ERROR ' || true)
  ((errors == 0)) || { echo "REFUS : $errors erreur(s) dans les journaux du backend de production sur ${MIN_UPTIME_MINUTES} min." >&2; exit 1; }
  echo "production saine : $(grep -c ' running ' <<<"$before") conteneurs en marche, backend stable depuis $((uptime / 60)) min, aucune erreur récente"
fi

# --- Mise en veille du staging, bot compris (profil discord). Aucun conteneur ni volume n'est supprimé.
compose=(docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile discord)
"${compose[@]}" config --quiet
"${compose[@]}" stop

running=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" -q </dev/null | wc -l)
((running == 0)) || { echo "ÉCHEC : $running conteneur(s) du staging encore en marche." >&2; exit 1; }
kept=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" -q </dev/null | wc -l)
volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" </dev/null | wc -l)

# La production n'a pas bougé : mêmes conteneurs, même démarrage, même état.
after=$(production_state)
[[ $after == "$before" ]] || { echo 'ALERTE : l’état de la production a changé pendant la mise en veille.' >&2; diff <(echo "$before") <(echo "$after") >&2 || true; exit 1; }

echo "STAGING-SUSPENDED=OK project=$PROJECT conteneurs_conservés=$kept volumes_conservés=$volumes production_inchangée=oui"
