/** Grades IceForge, du plus haut au plus bas. Un membre a un seul grade. */
export const MEMBER_RANKS = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'] as const;

/** Fonctions qui s'ajoutent au grade sans le remplacer. */
export const TREASURER_ROLE = 'TRESORIER';

/** Grade qui porte un sous-grade : le pôle dont le membre est le référent. */
export const SPECIALIST_RANK = 'SPECIALISTE';

/** Pôles d'un Spécialiste. Les clés sont celles du serveur. */
export const SPECIALTIES = [
  { key: 'LOGISTIQUE', label: 'Logistique', description: 'Transport, ravitaillement et préparation des opérations.' },
  { key: 'MILITAIRE', label: 'Militaire', description: 'Combat, escorte et protection des joueurs.' },
  { key: 'INDUSTRIE', label: 'Industrie', description: 'Minage, raffinage, récupération et production.' }
] as const;

/** Libellé d'un pôle ; null si le membre n'en a pas ou si la clé est inconnue. */
export function specialtyLabel(specialty: string | null | undefined): string | null {
  const key = (specialty ?? '').trim().toUpperCase();
  return SPECIALTIES.find(entry => entry.key === key)?.label ?? null;
}

const RANK_ALIASES: Record<string, string> = { USER: 'JUNIOR', MEMBRE: 'JUNIOR', RECRUE: 'JUNIOR' };

/**
 * Grade d'un membre à partir de tous ses rôles : le plus haut grade connu, jamais une fonction comme Trésorier.
 * L'ordre des rôles renvoyés par le serveur n'a pas d'importance.
 */
export function memberRank(roles: readonly (string | null | undefined)[] | null | undefined): string {
  const normalized = (roles ?? []).map(role => (role ?? '').trim().toUpperCase()).map(role => RANK_ALIASES[role] ?? role);
  return MEMBER_RANKS.find(rank => normalized.includes(rank)) ?? 'JUNIOR';
}

export function hasRole(roles: readonly (string | null | undefined)[] | null | undefined, role: string): boolean {
  return (roles ?? []).some(candidate => (candidate ?? '').trim().toUpperCase() === role);
}
