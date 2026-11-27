#!/usr/bin/env bash
# Supprime les bundles chiffrés plus anciens que la durée annoncée dans la
# politique de confidentialité (6 mois), en gardant toujours les plus récents.
#
#   prune-old-archives.sh --dir /var/backups/iceforge [--max-age-days 183] [--keep 3] [--apply]
#
# Sans --apply, le script liste seulement ce qu'il supprimerait.
set -euo pipefail

dir=
max_age_days=183
keep=3
apply=false

while (($#)); do
  case "$1" in
    --dir) dir=${2:?}; shift 2 ;;
    --max-age-days) max_age_days=${2:?}; shift 2 ;;
    --keep) keep=${2:?}; shift 2 ;;
    --apply) apply=true; shift ;;
    *) echo "Option inconnue: $1" >&2; exit 2 ;;
  esac
done

[[ -n $dir && -d $dir && ! -L $dir ]] || { echo 'Répertoire de sauvegarde invalide.' >&2; exit 1; }
[[ $max_age_days =~ ^[0-9]+$ && $max_age_days -ge 30 ]] || { echo 'Durée invalide (30 jours minimum).' >&2; exit 1; }
[[ $keep =~ ^[0-9]+$ && $keep -ge 1 ]] || { echo 'Nombre de bundles à garder invalide.' >&2; exit 1; }

# Du plus récent au plus ancien ; les noms ne contiennent ni espace ni retour à la ligne.
mapfile -t archives < <(find "$dir" -maxdepth 1 -type f -name 'iceforge-*.tar.gz.age' -printf '%T@ %p\n' |
  sort -rn | cut -d' ' -f2-)

cutoff=$(( $(date +%s) - max_age_days * 86400 ))
removed=0
for index in "${!archives[@]}"; do
  (( index < keep )) && continue
  archive=${archives[$index]}
  (( $(stat -c %Y -- "$archive") < cutoff )) || continue
  if [[ $apply == true ]]; then
    rm -f -- "$archive" "$archive.sha256"
    echo "Supprimé: $(basename -- "$archive")"
  else
    echo "À supprimer: $(basename -- "$archive")"
  fi
  removed=$((removed + 1))
done
printf 'PRUNE=%s removed=%d kept_recent=%d max_age_days=%d\n' \
  "$([[ $apply == true ]] && echo APPLY || echo DRY-RUN)" "$removed" "$keep" "$max_age_days"
