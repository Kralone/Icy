#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Root required' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
image=iceforge/backend:resources-v33
env_file=/etc/iceforge-staging/staging.env
release_dir=$(readlink -f /opt/iceforge-staging/current)
[[ $release_dir == /opt/iceforge-staging/releases/* ]] || exit 1
[[ $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' iceforge_staging-backend-1) == iceforge_staging ]] || exit 1
docker image inspect "$image" >/dev/null
for file in reconcile-resources-v33.sql verify-flyway-v33.sql resources-schema-signature.sql; do
  [[ -f $script_dir/$file ]] || { echo "Missing $file" >&2; exit 1; }
done
psql_staging() { docker exec -i iceforge_staging-db-1 psql -X -v ON_ERROR_STOP=1 -U iceforge_staging -d iceforge_staging "$@"; }
signature=$(psql_staging -At <"$script_dir/resources-schema-signature.sql")
[[ $signature == baa805dbe15c44e38ac79658739a6460 ]] || { echo 'Schema differs from migrated development database' >&2; exit 1; }
backup_dir=/var/backups/iceforge-staging/resources-v33-$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 0700 "$backup_dir"
cp -p "$env_file" "$backup_dir/staging.env"
reconciled=0
rollback() {
  status=$?
  trap - ERR
  echo "Reconciliation failed; restoring staging history and application. Backup: $backup_dir" >&2
  docker stop iceforge_staging-backend-1 >/dev/null || true
  if ((reconciled)); then
    if ! { echo 'BEGIN; TRUNCATE TABLE public.flyway_schema_history;'; cat "$backup_dir/history.sql"; echo 'COMMIT;'; } | psql_staging >/dev/null; then
      echo 'HISTORY RESTORE FAILED: backend remains stopped; use the saved dump.' >&2
      exit "$status"
    fi
  fi
  cp -p "$backup_dir/staging.env" "$env_file"
  if ! "$release_dir/deploy.sh" --release-dir "$release_dir"; then
    echo 'STAGING ROLLBACK HEALTH CHECK FAILED' >&2
  fi
  exit "$status"
}
trap rollback ERR
docker stop iceforge_staging-backend-1 >/dev/null
umask 077
docker exec iceforge_staging-db-1 pg_dump -U iceforge_staging -d iceforge_staging -Fc >"$backup_dir/database.dump"
docker exec iceforge_staging-db-1 pg_dump -U iceforge_staging -d iceforge_staging --data-only --table=public.flyway_schema_history >"$backup_dir/history.sql"
docker exec -i iceforge_staging-db-1 pg_restore --list <"$backup_dir/database.dump" >/dev/null
(cd "$backup_dir" && sha256sum database.dump history.sql >SHA256SUMS && sha256sum -c SHA256SUMS)
psql_staging <"$script_dir/reconcile-resources-v33.sql"
reconciled=1
sed -i "s|^STAGING_BACKEND_IMAGE=.*|STAGING_BACKEND_IMAGE=$image|" "$env_file"
"$release_dir/deploy.sh" --release-dir "$release_dir"
psql_staging <"$script_dir/verify-flyway-v33.sql"
[[ $(psql_staging -Atc "SELECT checksum FROM public.flyway_schema_history WHERE version='33'") == 377288752 ]]
trap - ERR
printf 'STAGING-RESOURCES-V33=OK backup=%s\n' "$backup_dir"
