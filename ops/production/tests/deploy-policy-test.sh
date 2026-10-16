#!/usr/bin/env bash
# Essais isolés de la politique de livraison, sur le serveur, sans toucher aux services de production ni au staging :
#  - choix de la sauvegarde (select-predeploy-backup.sh) dans un dossier temporaire, avec de vraies archives age ;
#  - mise en veille et réveil (ops/staging/suspend.sh, resume.sh) d'un faux staging « iceforge_staging_test… » à volume.
# La production n'est que lue (contrôle de stabilité). Usage, en root depuis la racine du dépôt :
#   ops/production/tests/deploy-policy-test.sh /chemin/du/destinataire-age.txt
set -uo pipefail

RECIPIENT=$(tr -d '\r\n' <"${1:?fichier contenant le destinataire age validé}")
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)
SELECT=$HERE/ops/production/select-predeploy-backup.sh
SUSPEND=$HERE/ops/staging/suspend.sh
RESUME=$HERE/ops/staging/resume.sh
WORK=$(mktemp -d /tmp/iceforge-policy-test.XXXXXX)
TEST_PROJECT=iceforge_staging_test$(tr -dc a-z0-9 </dev/urandom | head -c 6)
pass=0; fail=0
check() { if [[ $2 == "$3" ]]; then echo "OK    $1"; pass=$((pass + 1)); else echo "ÉCHEC $1 : attendu « $3 », obtenu « $2 »"; fail=$((fail + 1)); fi; }
cleanup() {
  docker compose -p "$TEST_PROJECT" -f "$WORK/compose.yml" --env-file "$WORK/test.env" down -v >/dev/null 2>&1 || true
  rm -rf -- "$WORK"
}
trap cleanup EXIT

now=$(date -u +%s)
stamp() { date -u -d "@$1" +%Y%m%dT%H%M%SZ; }
make_archive() { # répertoire époque [destinataire]
  local name="iceforge-$(stamp "$2").tar.gz.age"
  head -c 2048 /dev/urandom | age -r "${3:-$RECIPIENT}" -o "$1/$name"
  (cd "$1" && sha256sum "$name" >"$name.sha256")
  echo "$1/$name"
}
plan() { "$SELECT" --backup-dir "$1" --age-recipient "$RECIPIENT" --current-version "${2:-43}" --target-version "${3:-43}" --last-migration-epoch "${4:-0}" --now-epoch "$now" ${5:-} 2>/dev/null; }
kind() { sed -E 's/^BACKUP-PLAN=(REUSE|FRESH).*/\1/' <<<"$1"; }

echo "## Choix de la sauvegarde"
d=$WORK/b1; mkdir -p "$d"; a=$(make_archive "$d" $((now - 2 * 86400)))
check "archive récente et valide : réutilisée" "$(plan "$d")" "BACKUP-PLAN=REUSE archive=$a age_seconds=$((2 * 86400))"
d=$WORK/b2; mkdir -p "$d"
check "aucune archive : nouvelle sauvegarde" "$(plan "$d")" "BACKUP-PLAN=FRESH reason=no-valid-backup-within-7-days"
d=$WORK/b3; mkdir -p "$d"; make_archive "$d" $((now - 8 * 86400)) >/dev/null
check "archive de plus de 7 jours : nouvelle sauvegarde" "$(kind "$(plan "$d")")" "FRESH"
d=$WORK/b4; mkdir -p "$d"; a=$(make_archive "$d" $((now - 3600))); printf 'x' >>"$a"
check "empreinte non conforme : écartée" "$(kind "$(plan "$d")")" "FRESH"
d=$WORK/b5; mkdir -p "$d"; other=$(age-keygen 2>/dev/null | sed -n 's/^# public key: //p'); make_archive "$d" $((now - 3600)) "$other" >/dev/null
check "chiffrée pour un autre destinataire : écartée" "$(kind "$(plan "$d")")" "FRESH"
d=$WORK/b6; mkdir -p "$d"; make_archive "$d" $((now - 2 * 86400)) >/dev/null
check "antérieure à la dernière migration : écartée" "$(kind "$(plan "$d" 43 43 $((now - 86400)))")" "FRESH"
d=$WORK/b7; mkdir -p "$d"; make_archive "$d" $((now - 3600)) >/dev/null
check "migration Flyway à appliquer : sauvegarde fraîche" "$(plan "$d" 43 44)" "BACKUP-PLAN=FRESH reason=flyway-migration-V43-to-V44"
check "migration destructive V45 : sauvegarde fraîche" "$(plan "$d" 44 45)" "BACKUP-PLAN=FRESH reason=flyway-migration-V44-to-V45"
check "sauvegarde fraîche demandée : fraîche" "$(plan "$d" 43 43 0 --force-fresh)" "BACKUP-PLAN=FRESH reason=requested"
d=$WORK/b8; mkdir -p "$d"; old=$(make_archive "$d" $((now - 3 * 86400))); bad=$(make_archive "$d" $((now - 3600))); : >"$bad"; (cd "$d" && sha256sum "$(basename "$bad")" >"$bad.sha256")
check "la plus récente vide : la précédente valide est réutilisée" "$(plan "$d")" "BACKUP-PLAN=REUSE archive=$old age_seconds=$((3 * 86400))"
d=$WORK/b9; mkdir -p "$d"; a=$(make_archive "$d" $((now - 3600))); head -c 20 "$a" >"$a.t" && mv "$a.t" "$a"; (cd "$d" && sha256sum "$(basename "$a")" >"$a.sha256")
check "en-tête age tronqué : écartée" "$(kind "$(plan "$d")")" "FRESH"
check "destinataire invalide : refus" "$("$SELECT" --backup-dir "$WORK/b1" --age-recipient nope --current-version 43 --target-version 43 --last-migration-epoch 0 >/dev/null 2>&1; echo $?)" "2"
before=$(find "$WORK" -type f -name 'iceforge-*' | sort | xargs -r sha256sum)
plan "$WORK/b1" >/dev/null; plan "$WORK/b8" >/dev/null
check "aucune archive modifiée ni supprimée par le choix" "$(find "$WORK" -type f -name 'iceforge-*' | sort | xargs -r sha256sum)" "$before"

echo "## Mise en veille et réveil du staging (projet de test $TEST_PROJECT)"
cat >"$WORK/compose.yml" <<'YAML'
services:
  init:
    image: nginx:latest
    pull_policy: never
    command: ["sh", "-c", "test -f /data/marker || echo donnees-recette > /data/marker"]
    volumes: [data:/data]
    restart: "no"
  web:
    image: nginx:latest
    pull_policy: never
    restart: unless-stopped
    network_mode: none
    volumes: [data:/data]
    healthcheck: { test: ["CMD", "test", "-f", "/data/marker"], interval: 2s, retries: 15 }
    depends_on: { init: { condition: service_completed_successfully } }
volumes:
  data: {}
YAML
printf 'TEST=1\n' >"$WORK/test.env"; chmod 600 "$WORK/test.env"
export ICEFORGE_STAGING_PROJECT=$TEST_PROJECT ICEFORGE_STAGING_ENV_FILE=$WORK/test.env ICEFORGE_STAGING_COMPOSE_FILE=$WORK/compose.yml
docker compose -p "$TEST_PROJECT" -f "$WORK/compose.yml" --env-file "$WORK/test.env" up -d --wait >/dev/null 2>&1
prod_state() { for id in $(docker ps -a --filter label=com.docker.compose.project=iceforge -q); do docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.State.Status}}' "$id"; done | sort; }
prod_before=$(prod_state)

ICEFORGE_STAGING_PROJECT=iceforge "$SUSPEND" --skip-production-gate >/dev/null 2>&1
check "projet de production refusé par suspend.sh" "$?" "1"
"$SUSPEND" --min-uptime-minutes 1000000 >/dev/null 2>&1
check "production jugée pas encore stable : refus" "$?" "1"
check "… et le staging de test reste en marche" "$(docker ps -q --filter label=com.docker.compose.project=$TEST_PROJECT | wc -l)" "1"
out=$("$SUSPEND" --min-uptime-minutes 10 2>&1 | tail -1)
check "production saine : mise en veille" "${out%% *}" "STAGING-SUSPENDED=OK"
check "… plus aucun conteneur du test en marche" "$(docker ps -q --filter label=com.docker.compose.project=$TEST_PROJECT | wc -l)" "0"
check "… conteneurs conservés" "$(docker ps -aq --filter label=com.docker.compose.project=$TEST_PROJECT | wc -l)" "2"
check "… volume conservé" "$(docker volume ls -q --filter label=com.docker.compose.project=$TEST_PROJECT | wc -l)" "1"
check "… production intacte" "$(prod_state)" "$prod_before"
out=$("$RESUME" 2>&1 | tail -1)
check "réveil" "${out%% *}" "STAGING-RESUMED=OK"
check "… données du volume intactes" "$(docker compose -p "$TEST_PROJECT" -f "$WORK/compose.yml" --env-file "$WORK/test.env" exec -T web cat /data/marker 2>/dev/null)" "donnees-recette"

echo "RÉSULTAT : $pass réussis, $fail en échec"
((fail == 0))
