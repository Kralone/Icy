/** Ce que les vues d'une opération partagent sur un groupe : structure, coordination et fiche participant. */
export type EffectiveAssignmentMode = 'FREE' | 'VALIDATION' | 'MANAGED';

export interface GroupMember {
  userId: string;
  username: string;
}

export interface OperationGroupBase {
  id: number;
  parentId: number | null;
  name: string;
  capacity: number | null;
  effectiveMode: EffectiveAssignmentMode;
  /** Vrai si le groupe a des sous-groupes : il ne reçoit alors aucune affectation directe. */
  container: boolean;
  /** Membres uniques confirmés du groupe et de ses sous-groupes. */
  memberCount: number;
  responsibleUsername: string | null;
  members: GroupMember[];
}

/** Places restantes calculées par le serveur. */
export interface GroupSeats {
  /** Plafond du groupe parent compris ; null sans limite. */
  freeSeats: number | null;
  /** Selon la seule capacité du groupe. */
  ownFreeSeats: number | null;
}

export const MODE_LABELS: Record<EffectiveAssignmentMode, string> = {
  FREE: 'Libre',
  VALIDATION: 'Sur validation',
  MANAGED: 'Géré par les organisateurs'
};

export function occupancyLabel(group: Pick<OperationGroupBase, 'memberCount' | 'capacity'>): string {
  if (group.capacity !== null && group.capacity !== undefined) return `${group.memberCount} / ${group.capacity}`;
  return group.memberCount === 1 ? '1 membre' : `${group.memberCount} membres`;
}

/** Part de la capacité occupée, entre 0 et 100 ; null sans capacité définie : aucune jauge n'est alors dessinée. */
export function occupancyPercent(group: Pick<OperationGroupBase, 'memberCount' | 'capacity'>): number | null {
  if (group.capacity === null || group.capacity === undefined) return null;
  if (group.capacity <= 0) return 100;
  return Math.min(100, Math.round((group.memberCount / group.capacity) * 100));
}

/**
 * Places pour un membre venant de `fromGroupId` : s'il est déjà compté dans le même groupe parent,
 * seul le plafond propre à la destination compte (le serveur applique la même règle).
 */
export function seatsFor<G extends Pick<OperationGroupBase, 'id' | 'parentId'> & GroupSeats>(destination: G, fromGroupId: number | null, groups: G[]): number | null {
  const from = fromGroupId === null ? undefined : groups.find(group => group.id === fromGroupId);
  const sameParent = !!from && from.parentId !== null && from.parentId === destination.parentId;
  return sameParent ? destination.ownFreeSeats : destination.freeSeats;
}
