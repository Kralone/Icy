import { WarningCategory } from '../../../model/discipline.model';

/**
 * Libellés et aperçu du message privé d'avertissement.
 * Même formulation que WarningMessages côté serveur : une modification doit être reportée des deux côtés.
 */
export const WARNING_CATEGORIES: { key: WarningCategory; label: string; hint: string }[] = [
  { key: 'COMPORTEMENT', label: 'Comportement', hint: 'Propos, attitude envers les membres' },
  { key: 'REGLEMENT', label: 'Non-respect du règlement', hint: 'Une règle écrite de la corpo' },
  { key: 'ABSENCE', label: 'Absence sans prévenir', hint: 'Inscrit puis absent, sans message' },
  { key: 'OPERATION', label: 'Conduite en opération', hint: 'Consignes, tirs alliés, abandon' },
  { key: 'AUTRE', label: 'Autre motif', hint: 'Précisé dans le texte' }
];

export function categoryLabel(key: string | null | undefined): string {
  return WARNING_CATEGORIES.find(category => category.key === key)?.label ?? 'Autre motif';
}

/** 1er, 2e, 3e… */
export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}

/** Teinte d'un avertissement selon sa place avant le seuil : ambre, orange, puis rouge au seuil. */
export function warningTone(rank: number, threshold: number): 'amber' | 'orange' | 'red' {
  if (rank >= threshold) return 'red';
  if (rank === threshold - 1) return 'orange';
  return 'amber';
}

export function consequence(rank: number, threshold: number): string {
  if (rank >= threshold) {
    return `C'est ton ${ordinal(rank)} avertissement : la direction va décider de ton exclusion de la corporation.`;
  }
  if (rank === threshold - 1) {
    return `C'est ton ${ordinal(rank)} avertissement. Au prochain, la direction décidera de ton exclusion de la corporation.`;
  }
  return `C'est ton ${ordinal(rank)} avertissement sur ${threshold}. Au ${ordinal(threshold)}, la direction décide de ton exclusion de la corporation.`;
}

/** Raison d'un refus de Discord, lisible par un officier. */
export function deliveryFailureLabel(failure: string | null | undefined): string {
  switch (failure) {
    case 'dm_closed': return 'messages privés fermés';
    case 'user_not_found': return 'compte Discord introuvable';
    case 'invalid_discord_id': return 'Discord ID invalide';
    case 'no_answer': return 'le bot n\'a pas répondu';
    default: return 'refusé par Discord';
  }
}
