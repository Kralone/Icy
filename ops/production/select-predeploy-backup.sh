#!/usr/bin/env bash
# Choisit la sauvegarde de production à utiliser avant un déploiement, sans rien écrire ni supprimer.
#
# Politique (décision de Florian, 26/11/2026) : une archive complète de moins de 48 h est réutilisée si elle est
# intègre et chiffrée pour le destinataire validé, même si la release applique une migration Flyway.
# Une sauvegarde fraîche n'est prise que si aucune archive ne convient, ou sur demande (--force-fresh).
#
# Sortie, une seule ligne :
#   BACKUP-PLAN=REUSE archive=/var/backups/iceforge/iceforge-AAAAMMJJTHHMMSSZ.tar.gz.age age_seconds=N
#   BACKUP-PLAN=FRESH reason=<raison>
# Les archives écartées sont expliquées sur la sortie d'erreur.
set -euo pipefail

BACKUP_DIR=/var/backups/iceforge
AGE_RECIPIENT=
MAX_AGE_HOURS=48
CURRENT_VERSION=
TARGET_VERSION=
LAST_MIGRATION_EPOCH=
NOW_EPOCH=$(date -u +%s)
FORCE_FRESH=0

usage() {
  echo "Usage: $0 --age-recipient 'ssh-ed25519 AAAA...'|'age1...' --current-version N --target-version N --last-migration-epoch S [--backup-dir DIR] [--max-age-hours N] [--force-fresh]" >&2
}

while (($#)); do
  case "$1" in
    --backup-dir) BACKUP_DIR=${2:?}; shift 2 ;;
    --age-recipient) AGE_RECIPIENT=${2:?}; shift 2 ;;
    --max-age-hours) MAX_AGE_HOURS=${2:?}; shift 2 ;;
    --max-age-days) MAX_AGE_HOURS=$(( ${2:?} * 24 )); shift 2 ;;
    --current-version) CURRENT_VERSION=${2:?}; shift 2 ;;
    --target-version) TARGET_VERSION=${2:?}; shift 2 ;;
    --last-migration-epoch) LAST_MIGRATION_EPOCH=${2:?}; shift 2 ;;
    --now-epoch) NOW_EPOCH=${2:?}; shift 2 ;; # essais isolés uniquement
    --force-fresh) FORCE_FRESH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $AGE_RECIPIENT == age1* || $AGE_RECIPIENT == 'ssh-ed25519 '* ]] || { echo 'Destinataire age invalide.' >&2; exit 2; }
for value in "$MAX_AGE_HOURS" "$CURRENT_VERSION" "$TARGET_VERSION" "$LAST_MIGRATION_EPOCH" "$NOW_EPOCH"; do
  [[ $value =~ ^[0-9]+$ ]] || { usage; exit 2; }
done
[[ -d $BACKUP_DIR && ! -L $BACKUP_DIR ]] || { echo "BACKUP-PLAN=FRESH reason=backup-dir-missing"; exit 0; }

if ((FORCE_FRESH)); then echo "BACKUP-PLAN=FRESH reason=requested"; exit 0; fi
# Les versions Flyway et la date de la dernière migration restent lues pour l'affichage, mais ne déclenchent plus
# de sauvegarde : une archive de moins de 48 h suffit, avec ou sans migration.
max_age=$((MAX_AGE_HOURS * 3600))

# Étiquette qu'age inscrit dans l'en-tête pour un destinataire ssh-ed25519 : 4 premiers octets du SHA-256 de la clé, en base64 sans remplissage.
expected_stanza() {
  python3 - "$AGE_RECIPIENT" <<'PY'
import base64, hashlib, sys
recipient = sys.argv[1].split()
if recipient[0] == 'ssh-ed25519':
    tag = base64.b64encode(hashlib.sha256(base64.b64decode(recipient[1])).digest()[:4]).decode().rstrip('=')
    print('ssh-ed25519 ' + tag)
else:
    print('X25519')
PY
}

# Vrai si l'en-tête age est complet et contient une entrée pour le destinataire attendu.
header_matches() {
  python3 - "$1" "$2" <<'PY'
import sys
path, expected = sys.argv[1], sys.argv[2]
with open(path, 'rb') as handle:
    head = handle.read(64 * 1024)
lines = head.split(b'\n')
if not lines or lines[0] != b'age-encryption.org/v1':
    sys.exit(1)
stanzas, closed = [], False
for line in lines[1:]:
    if line.startswith(b'--- '):
        closed = True
        break
    if line.startswith(b'-> '):
        stanzas.append(line[3:].decode('ascii', 'replace'))
if not closed:
    sys.exit(1)
sys.exit(0 if any(stanza == expected or stanza.startswith(expected + ' ') for stanza in stanzas) else 1)
PY
}

expected=$(expected_stanza)
mapfile -t candidates < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'iceforge-*.tar.gz.age' -printf '%f\n' | grep -E '^iceforge-[0-9]{8}T[0-9]{6}Z\.tar\.gz\.age$' | sort -r)

for name in "${candidates[@]}"; do
  archive=$BACKUP_DIR/$name
  stamp=${name#iceforge-}; stamp=${stamp%.tar.gz.age}
  created=$(date -u -d "${stamp:0:4}-${stamp:4:2}-${stamp:6:2} ${stamp:9:2}:${stamp:11:2}:${stamp:13:2}" +%s 2>/dev/null) || { echo "écartée $name : horodatage illisible" >&2; continue; }
  age_seconds=$((NOW_EPOCH - created))
  # Les noms sont triés du plus récent au plus ancien : au-delà de la limite, les suivants le sont aussi.
  ((age_seconds <= max_age)) || { echo "écartée $name : plus de $MAX_AGE_HOURS h" >&2; break; }
  ((age_seconds >= 0)) || { echo "écartée $name : datée dans le futur" >&2; continue; }
  [[ ! -L $archive && -s $archive && -r $archive ]] || { echo "écartée $name : fichier vide ou illisible" >&2; continue; }
  [[ -f $archive.sha256 && ! -L $archive.sha256 ]] || { echo "écartée $name : empreinte absente" >&2; continue; }
  (cd "$BACKUP_DIR" && sha256sum -c --status "$name.sha256") || { echo "écartée $name : empreinte non conforme" >&2; continue; }
  header_matches "$archive" "$expected" || { echo "écartée $name : non chiffrée pour le destinataire validé" >&2; continue; }
  echo "BACKUP-PLAN=REUSE archive=$archive age_seconds=$age_seconds"
  exit 0
done

echo "BACKUP-PLAN=FRESH reason=no-valid-backup-within-${MAX_AGE_HOURS}-hours"
