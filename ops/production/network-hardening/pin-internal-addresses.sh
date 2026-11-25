#!/usr/bin/env bash
# Recrée le réseau iceforge_internal avec un sous-réseau déclaré, pour que
# PostgreSQL garde l'adresse fixe 172.19.0.2 (cible du tunnel SSH
# d'administration iceforge-db-admin). Voir docs/PRODUCTION-NETWORK-HARDENING.md.
#
#   pin-internal-addresses.sh --check
#   pin-internal-addresses.sh --apply --verified-backup /var/backups/iceforge/iceforge-<date>.tar.gz.age
#   pin-internal-addresses.sh --finish
#
# --check ne modifie rien. --apply arrête toute la stack (coupure du site de
# quelques minutes), recrée le réseau et relance seulement vault, db, rabbitmq
# et libretranslate : le backend refuse de démarrer tant que Vault est scellé, et
# bot/frontend attendent le backend. Après l'unseal depuis Windows, --finish
# relance le reste de la stack.
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
NETWORK=iceforge_internal
SUBNET=172.19.0.0/16
IP_RANGE=172.19.128.0/17
DB_ADDRESS=172.19.0.2
MODE=
VERIFIED_BACKUP=
# Images applicatives en cours, gardées entre --apply et --finish (tmpfs root).
IMAGES_FILE=/run/iceforge-pin-internal-images.env
INFRA_SERVICES=(vault db rabbitmq libretranslate)

usage() {
  echo "Usage: $0 --check | --apply --verified-backup <archive.tar.gz.age> | --finish" >&2
}

while (($#)); do
  case "$1" in
    --check) MODE=check; shift ;;
    --apply) MODE=apply; shift ;;
    --finish) MODE=finish; shift ;;
    --verified-backup) VERIFIED_BACKUP=${2:?}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
[[ -n $MODE ]] || { usage; exit 2; }
[[ $EUID -eq 0 ]] || { echo 'Ce script doit être exécuté en root.' >&2; exit 1; }
for command in docker jq sha256sum; do
  command -v "$command" >/dev/null 2>&1 || { echo "commande requise absente: $command" >&2; exit 2; }
done

if [[ $MODE == finish ]]; then
  [[ -f $IMAGES_FILE && ! -L $IMAGES_FILE ]] || { echo "Images introuvables ($IMAGES_FILE) : --apply n'a pas tourné." >&2; exit 1; }
  BACKEND_IMAGE=$(sed -n 's/^BACKEND_IMAGE=//p' "$IMAGES_FILE")
  BOT_IMAGE=$(sed -n 's/^BOT_IMAGE=//p' "$IMAGES_FILE")
  FRONTEND_IMAGE=$(sed -n 's/^FRONTEND_IMAGE=//p' "$IMAGES_FILE")
else
  BACKEND_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_backend)
  BOT_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_bot)
  FRONTEND_IMAGE=$(docker inspect --format '{{.Config.Image}}' iceforge_frontend)
fi
[[ -n $BACKEND_IMAGE && -n $BOT_IMAGE && -n $FRONTEND_IMAGE ]] || { echo 'Images applicatives inconnues.' >&2; exit 1; }
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE
source "$ROOT_DIR/ops/stateful/load-runtime.sh"
load_stateful_runtime "$ROOT_DIR"
NETWORK_DIR=$ROOT_DIR/ops/network-hardening
compose_args=(--project-name iceforge --env-file "$ROOT_DIR/.env" --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$NETWORK_DIR/docker-compose.network-hardening.yml"
  -f "$ROOT_DIR/ops/bot-rollout/docker-compose.bot-amqp-redaction.yml"
  -f "$ROOT_DIR/ops/backend-rollout/docker-compose.backend-java25.yml"
  -f "$ROOT_DIR/ops/frontend-rollout/docker-compose.frontend-angular22.yml"
  "${STATEFUL_COMPOSE_ARGS[@]}")
compose=(docker compose "${compose_args[@]}")

# La surcharge copiée sur le serveur doit déjà contenir l'adresse fixe.
bash "$NETWORK_DIR/verify.sh" -- "${compose_args[@]}" | grep -Fx "DB_INTERNAL_ADDRESS=$DB_ADDRESS" >/dev/null || {
  echo 'La surcharge réseau du serveur ne fixe pas encore 172.19.0.2 : copier celle de main.' >&2
  exit 1
}

if [[ $MODE == finish ]]; then
  [[ $(docker inspect --format "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" iceforge_db) == "$DB_ADDRESS" ]] || {
    echo "PostgreSQL n'est pas en $DB_ADDRESS : relancer --check." >&2
    exit 1
  }
  vault_status=0
  docker exec -e VAULT_ADDR=http://127.0.0.1:8200 iceforge_vault vault status >/dev/null 2>&1 || vault_status=$?
  [[ $vault_status -eq 0 ]] || { echo 'Vault est encore scellé : lancer unseal-from-windows.ps1 puis relancer --finish.' >&2; exit 1; }
  "${compose[@]}" up -d --no-build --pull never
  rm -f -- "$IMAGES_FILE"
  echo 'PIN_STATUS=FINISHED'
  exit 0
fi

network_json=$(docker network inspect "$NETWORK")
current_subnet=$(jq -r '.[0].IPAM.Config[0].Subnet // ""' <<<"$network_json")
current_range=$(jq -r '.[0].IPAM.Config[0].IPRange // ""' <<<"$network_json")
db_address=$(docker inspect --format "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" iceforge_db)
# Conteneurs du réseau qui n'appartiennent pas au projet iceforge (supervision...).
mapfile -t foreign < <(
  for id in $(jq -r '.[0].Containers // {} | keys[]' <<<"$network_json"); do
    project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")
    [[ $project == iceforge ]] || docker inspect --format '{{.Name}}' "$id" | sed 's#^/##'
  done
)

printf 'NETWORK_SUBNET=%s\n' "${current_subnet:-?}"
printf 'NETWORK_IP_RANGE=%s\n' "${current_range:-aucune}"
printf 'DB_ADDRESS=%s\n' "$db_address"
printf 'FOREIGN_CONTAINERS=%s\n' "${foreign[*]:-aucun}"
printf 'COMPOSE_VERSION=%s\n' "$(docker compose version --short)"

if [[ $current_range == "$IP_RANGE" && $db_address == "$DB_ADDRESS" ]]; then
  echo 'PIN_STATUS=ALREADY_PINNED'
  exit 0
fi
[[ $current_subnet == "$SUBNET" ]] || {
  echo "Sous-réseau inattendu ($current_subnet au lieu de $SUBNET) : arrêt, la surcharge doit être revue." >&2
  exit 1
}
if [[ $MODE == check ]]; then
  echo 'PIN_STATUS=READY_TO_APPLY'
  exit 0
fi

[[ -n $VERIFIED_BACKUP && -f $VERIFIED_BACKUP && ! -L $VERIFIED_BACKUP ]] || {
  echo 'Une sauvegarde chiffrée existante est requise avec --verified-backup.' >&2
  exit 1
}
checksum=$VERIFIED_BACKUP.sha256
[[ -f $checksum && ! -L $checksum ]] || { echo "Checksum absent: $checksum" >&2; exit 1; }
(cd "$(dirname -- "$VERIFIED_BACKUP")" && sha256sum -c "$(basename -- "$checksum")")

"${compose[@]}" config --quiet

trap 'echo "Échec pendant la recréation du réseau : voir la section Retour arrière de docs/PRODUCTION-NETWORK-HARDENING.md." >&2' ERR

# Les conteneurs étrangers restent démarrés : ils perdent seulement le réseau
# interne le temps de la recréation, puis y sont reconnectés.
for name in "${foreign[@]}"; do
  docker network disconnect "$NETWORK" "$name"
done

# down sans -v : les volumes nommés (PostgreSQL, RabbitMQ, Vault...) sont conservés.
"${compose[@]}" down
if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network rm "$NETWORK"
fi

umask 077
printf 'BACKEND_IMAGE=%s\nBOT_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$BACKEND_IMAGE" "$BOT_IMAGE" "$FRONTEND_IMAGE" >"$IMAGES_FILE"

# Seulement l'infrastructure : le backend ne démarre pas tant que Vault est scellé.
"${compose[@]}" up -d --no-build --pull never "${INFRA_SERVICES[@]}"

for name in "${foreign[@]}"; do
  docker network connect "$NETWORK" "$name"
done

network_json=$(docker network inspect "$NETWORK")
[[ $(jq -r '.[0].IPAM.Config[0].IPRange // ""' <<<"$network_json") == "$IP_RANGE" ]] || {
  echo 'Le réseau recréé ne porte pas la plage dynamique attendue.' >&2
  exit 1
}
db_address=$(docker inspect --format "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" iceforge_db)
[[ $db_address == "$DB_ADDRESS" ]] || { echo "PostgreSQL a reçu $db_address au lieu de $DB_ADDRESS." >&2; exit 1; }

printf 'DB_ADDRESS=%s\n' "$db_address"
echo 'PIN_STATUS=INFRA_STARTED'
echo 'Vault est scellé : lancer unseal-from-windows.ps1, puis pin-internal-addresses.sh --finish.'
