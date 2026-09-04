#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ICEFORGE_ROOT:-/root/iceforge}
BACKUP_ARCHIVE=${1:-}
TARGET_VOLUME=iceforge_rabbitmq_data
IMAGE_42='rabbitmq:4.2.9-management@sha256:65df8b4486d38eab1dbbb0784790b235a2df2bf1db8b9b70c46cbcf669ecffa7'
IMAGE_43='rabbitmq:4.3.5-management@sha256:06fb591136a49e861e01aaaf9ce45085839ca23c35913d45a1e83519bb9778ca'
OVERLAY=$ROOT_DIR/ops/stateful/docker-compose.rabbitmq-stateful.yml

[[ $EUID -eq 0 ]] || { echo 'Exécution root requise.' >&2; exit 1; }
[[ $BACKUP_ARCHIVE == /var/backups/iceforge/iceforge-*.tar.gz.age ]] || { echo 'Usage: migrate-rabbitmq-4.sh /var/backups/iceforge/iceforge-*.tar.gz.age' >&2; exit 2; }
[[ -f $BACKUP_ARCHIVE && -f $BACKUP_ARCHIVE.sha256 && ! -L $BACKUP_ARCHIVE ]] || { echo 'Backup absent.' >&2; exit 1; }
(cd /var/backups/iceforge && sha256sum -c "$(basename -- "$BACKUP_ARCHIVE.sha256")")
for image in "$IMAGE_42" "$IMAGE_43"; do docker image inspect "$image" >/dev/null; done

old_image=$(docker inspect -f '{{.Config.Image}}' iceforge_rabbitmq)
old_hostname=$(docker inspect -f '{{.Config.Hostname}}' iceforge_rabbitmq)
old_volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/rabbitmq"}}{{.Name}}{{end}}{{end}}' iceforge_rabbitmq)
[[ -n $old_volume && -n $old_hostname ]] || { echo 'État RabbitMQ source introuvable.' >&2; exit 1; }
[[ $(docker exec iceforge_rabbitmq rabbitmqctl version) == 3.13.7 ]] || { echo 'Source RabbitMQ inattendue.' >&2; exit 1; }
disabled_supported=$(docker exec iceforge_rabbitmq rabbitmqctl list_feature_flags --no-table-headers name state stability \
  | awk '$2 == "disabled" && $3 != "experimental" {n++} END{print n+0}')
[[ $disabled_supported == 0 ]] || { echo "$disabled_supported feature flag(s) stable(s) désactivé(s) sur la source." >&2; exit 1; }
khepri_state=$(docker exec iceforge_rabbitmq rabbitmqctl list_feature_flags --no-table-headers name state \
  | awk '$1 == "khepri_db" {print $2}')
[[ $khepri_state == disabled ]] || { echo 'Migration refusée: Khepri 3.13 ne doit pas être activé.' >&2; exit 1; }
messages=$(docker exec iceforge_rabbitmq rabbitmqctl list_queues --no-table-headers messages \
  | awk '$1 ~ /^[0-9]+$/ {s+=$1} END{print s+0}')
[[ $messages == 0 ]] || { echo "Migration refusée: $messages message(s) en attente." >&2; exit 1; }
docker volume inspect "$TARGET_VOLUME" >/dev/null 2>&1 && { echo "Volume cible déjà présent: $TARGET_VOLUME" >&2; exit 1; }

BACKEND_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_backend)
BOT_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_bot)
FRONTEND_IMAGE=$(docker inspect -f '{{.Config.Image}}' iceforge_frontend)
export BACKEND_IMAGE BOT_IMAGE FRONTEND_IMAGE PROD_RABBITMQ_HOSTNAME=$old_hostname
compose=(docker compose --project-name iceforge --env-file "$ROOT_DIR/.env" --env-file "$ROOT_DIR/.secrets/vault/compose.prod.env"
  -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.vault.yml"
  -f "$ROOT_DIR/ops/network-hardening/docker-compose.network-hardening.yml"
  -f "$ROOT_DIR/ops/bot-rollout/docker-compose.bot-amqp-redaction.yml"
  -f "$ROOT_DIR/ops/backend-rollout/docker-compose.backend-java25.yml"
  -f "$ROOT_DIR/ops/frontend-rollout/docker-compose.frontend-angular22.yml" -f "$OVERLAY")

wait_for_rabbit_app() {
  for _ in $(seq 1 90); do
    docker exec iceforge_rabbitmq rabbitmq-diagnostics -q check_running >/dev/null 2>&1 && return 0
    sleep 2
  done
  docker exec iceforge_rabbitmq rabbitmq-diagnostics -q check_running >/dev/null
}

rollback() {
  status=$?
  trap - ERR
  echo 'Échec RabbitMQ 4; retour au volume et à l’image 3.13.' >&2
  export PROD_RABBITMQ_IMAGE=$old_image PROD_RABBITMQ_VOLUME=$old_volume
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait rabbitmq || true
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend bot || true
  exit "$status"
}
trap rollback ERR

docker stop -t 120 iceforge_backend iceforge_bot iceforge_rabbitmq >/dev/null
docker volume create "$TARGET_VOLUME" >/dev/null
docker run --rm --entrypoint sh -v "$old_volume:/source:ro" -v "$TARGET_VOLUME:/target" "$old_image" \
  -ceu 'cd /source; tar cf - . | tar xpf - -C /target'

export PROD_RABBITMQ_VOLUME=$TARGET_VOLUME PROD_RABBITMQ_IMAGE=$IMAGE_42
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait rabbitmq
wait_for_rabbit_app
[[ $(docker exec iceforge_rabbitmq rabbitmqctl version) == 4.2.9 ]] || false
docker exec iceforge_rabbitmq rabbitmqctl enable_feature_flag all >/dev/null
docker restart iceforge_rabbitmq >/dev/null
wait_for_rabbit_app

"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend bot
BACKEND_ROLLOUT_DIR=$ROOT_DIR/ops/backend-rollout "$ROOT_DIR/ops/backend-rollout/verify.sh" runtime
BOT_ROLLOUT_DIR=$ROOT_DIR/ops/bot-rollout "$ROOT_DIR/ops/bot-rollout/verify.sh" runtime

export PROD_RABBITMQ_IMAGE=$IMAGE_43
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait rabbitmq
wait_for_rabbit_app
[[ $(docker exec iceforge_rabbitmq rabbitmqctl version) == 4.3.5 ]] || false
docker exec iceforge_rabbitmq rabbitmqctl enable_feature_flag all >/dev/null
docker restart iceforge_rabbitmq >/dev/null
wait_for_rabbit_app
"${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait backend bot
BACKEND_ROLLOUT_DIR=$ROOT_DIR/ops/backend-rollout "$ROOT_DIR/ops/backend-rollout/verify.sh" runtime
BOT_ROLLOUT_DIR=$ROOT_DIR/ops/bot-rollout "$ROOT_DIR/ops/bot-rollout/verify.sh" runtime
disabled_supported=$(docker exec iceforge_rabbitmq rabbitmqctl list_feature_flags --no-table-headers name state stability \
  | awk '$2 == "disabled" && $3 != "experimental" {n++} END{print n+0}')
[[ $disabled_supported == 0 ]] || { echo "$disabled_supported feature flag(s) stable(s) désactivé(s)." >&2; exit 1; }

trap - ERR
printf 'RABBITMQ4_MIGRATION=OK source_volume=%s target_volume=%s hostname=%s\n' "$old_volume" "$TARGET_VOLUME" "$old_hostname"
