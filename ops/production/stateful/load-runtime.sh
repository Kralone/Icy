#!/usr/bin/env bash

load_stateful_runtime() {
  local root_dir=${1:?root directory required}
  local state_file=$root_dir/.secrets/vault/stateful.prod.env
  local rabbit_overlay=$root_dir/ops/stateful/docker-compose.rabbitmq-stateful.yml
  local postgres_overlay=$root_dir/ops/stateful/docker-compose.postgres-stateful.yml
  STATEFUL_COMPOSE_ARGS=()

  [[ -e $state_file ]] || return 0
  [[ -f $state_file && ! -L $state_file ]] || { echo "État stateful invalide: $state_file" >&2; return 1; }
  [[ $(stat -c %u "$state_file") == 0 && $(stat -c %a "$state_file") == 600 ]] \
    || { echo 'stateful.prod.env doit appartenir à root en mode 0600.' >&2; return 1; }
  [[ -f $rabbit_overlay && ! -L $rabbit_overlay && -f $postgres_overlay && ! -L $postgres_overlay ]] \
    || { echo 'Overlays stateful manquants.' >&2; return 1; }

  set -a
  # Fichier root-only créé par la migration, sans valeur fournie par un utilisateur distant.
  source "$state_file"
  set +a
  [[ ${PROD_POSTGRES_IMAGE:-} =~ @sha256:[0-9a-f]{64}$ ]]
  [[ ${PROD_RABBITMQ_IMAGE:-} =~ @sha256:[0-9a-f]{64}$ ]]
  [[ ${PROD_POSTGRES_VOLUME:-} =~ ^[a-zA-Z0-9_.-]+$ ]]
  [[ ${PROD_RABBITMQ_VOLUME:-} =~ ^[a-zA-Z0-9_.-]+$ ]]
  [[ ${PROD_RABBITMQ_HOSTNAME:-} =~ ^[a-zA-Z0-9_.-]+$ ]]
  [[ ${PROD_POSTGRES_MOUNT:-} == /var/lib/postgresql ]]

  STATEFUL_COMPOSE_ARGS=(--env-file "$state_file" -f "$rabbit_overlay" -f "$postgres_overlay")
}
