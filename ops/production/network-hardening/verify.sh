#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: verify.sh -- [options docker compose, fichiers inclus]

Exemple :
  verify.sh -- \
    --project-name iceforge \
    --env-file /root/iceforge/.env \
    --env-file /root/iceforge/.secrets/vault/compose.prod.env \
    -f /root/iceforge/docker-compose.yml \
    -f /root/iceforge/docker-compose.vault.yml \
    -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml

Le JSON Compose résolu peut contenir des secrets. Il reste uniquement en mémoire
et n'est jamais écrit ni affiché.
EOF
}

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
  usage
  exit 0
fi
[[ ${1:-} == -- ]] || { usage; exit 2; }
shift
(($# > 0)) || { usage; exit 2; }

for command in docker jq sort; do
  command -v "$command" >/dev/null 2>&1 || { echo "commande requise absente: $command" >&2; exit 2; }
done

compose_version=$(docker compose version --short | sed 's/^v//; s/-.*//')
minimum_version=2.24.4
first_version=$(printf '%s\n%s\n' "$minimum_version" "$compose_version" | sort -V | head -n1)
[[ "$first_version" == "$minimum_version" ]] || {
  echo "Docker Compose $minimum_version ou supérieur est requis, version détectée: $compose_version" >&2
  exit 2
}

resolved=$(docker compose "$@" config --format json)
printf '%s' "$resolved" | jq -e '
  def network_names($service):
    (($service.networks // {}) | keys | sort);

  def ports($service):
    ($service.ports // []);

  def localhost_port($service; $published; $target):
    (ports($service) | length) == 1 and
    (ports($service)[0].host_ip == "127.0.0.1") and
    (ports($service)[0].published == ($published | tostring)) and
    (ports($service)[0].target == $target) and
    ((ports($service)[0].protocol // "tcp") == "tcp");

  .services as $services |
  (["backend", "bot", "db", "frontend", "icy-images", "rabbitmq", "vault"] - ($services | keys)) == [] and
  (.networks.internal.internal == true) and
  network_names($services.frontend) == ["external", "internal"] and
  network_names($services.backend) == ["external", "internal"] and
  network_names($services.bot) == ["external", "internal"] and
  network_names($services.db) == ["internal"] and
  network_names($services["icy-images"]) == ["internal"] and
  network_names($services.rabbitmq) == ["internal"] and
  network_names($services.vault) == ["internal"] and
  (ports($services.backend) | length) == 0 and
  (ports($services.bot) | length) == 0 and
  (ports($services.db) | length) == 0 and
  (ports($services["icy-images"]) | length) == 0 and
  localhost_port($services.rabbitmq; 15672; 15672) and
  localhost_port($services.vault; 8200; 8200) and
  ((ports($services.frontend) | map(.published) | sort) == ["443", "80"]) and
  ([ports($services.frontend)[] | (.host_ip // "0.0.0.0")] | all(. == "0.0.0.0" or . == "::")) and
  ($services.backend.environment.VAULT_ENABLED == "true") and
  ($services.backend.environment.VAULT_KV_PATH == "iceforge/prod/backend") and
  (($services.backend.environment.VAULT_ROLE_ID // "") | length) > 0 and
  (($services.backend.environment.VAULT_SECRET_ID // "") | length) > 0 and
  ($services.bot.environment.VAULT_ENABLED == "true") and
  ($services.bot.environment.VAULT_KV_PATH == "iceforge/prod/bot") and
  (($services.bot.environment.VAULT_ROLE_ID // "") | length) > 0 and
  (($services.bot.environment.VAULT_SECRET_ID // "") | length) > 0 and
  ([$services[] | select(.network_mode == "host")] | length) == 0
' >/dev/null
unset resolved

printf 'NETWORK_HARDENING_CONFIG_VALID=true\n'
printf 'COMPOSE_VERSION=%s\n' "$compose_version"
printf 'PUBLIC_PORTS=80,443\n'
printf 'LOCALHOST_ADMIN_PORTS=8200,15672\n'
printf 'VAULT_APPROLE_CONFIG_VALID=true\n'
