export type AssignmentMode = 'INHERITED' | 'FREE' | 'VALIDATION' | 'MANAGED';
export type EffectiveAssignmentMode = Exclude<AssignmentMode, 'INHERITED'>;

export interface OrganizationMember {
  userId: string;
  username: string;
}

export interface OrganizationGroup {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  capacity: number | null;
  assignmentMode: AssignmentMode;
  effectiveMode: EffectiveAssignmentMode;
  sortOrder: number;
  responsibleUserId: string | null;
  responsibleUsername: string | null;
  /** Vrai si le groupe a des sous-groupes : il ne reçoit alors aucune affectation directe. */
  container: boolean;
  /** Membres uniques confirmés du groupe et de ses sous-groupes. */
  memberCount: number;
  members: OrganizationMember[];
  pendingRequests: number;
  /** Places restantes calculées par le serveur, plafond du groupe principal compris ; null sans limite. */
  freeSeats?: number | null;
  /** Places restantes selon la seule capacité du groupe. */
  ownFreeSeats?: number | null;
}

export interface OperationOrganization {
  defaultAssignmentMode: EffectiveAssignmentMode;
  groups: OrganizationGroup[];
}

export interface GroupSettings {
  name: string;
  description: string;
  capacity: number | null;
  parentId: number | null;
  assignmentMode: AssignmentMode;
  sortOrder: number;
  responsibleUserId: string | null;
}

export const MODE_LABELS: Record<EffectiveAssignmentMode, string> = {
  FREE: 'Libre',
  VALIDATION: 'Sur validation',
  MANAGED: 'Géré par les organisateurs'
};

export const MODE_HINTS: Record<EffectiveAssignmentMode, string> = {
  FREE: 'Un membre présent rejoint le groupe tout de suite, s’il reste une place.',
  VALIDATION: 'Un membre présent envoie une demande ; un organisateur ou le responsable l’accepte.',
  MANAGED: 'Les membres ne rejoignent pas ce groupe eux-mêmes.'
};

export function occupancyLabel(group: Pick<OrganizationGroup, 'memberCount' | 'capacity'>): string {
  if (group.capacity !== null && group.capacity !== undefined) return `${group.memberCount} / ${group.capacity}`;
  return group.memberCount === 1 ? '1 membre' : `${group.memberCount} membres`;
}

/** Part de la capacité occupée, entre 0 et 100 ; null sans capacité définie. */
export function occupancyPercent(group: Pick<OrganizationGroup, 'memberCount' | 'capacity'>): number | null {
  if (group.capacity === null || group.capacity === undefined) return null;
  if (group.capacity === 0) return 100;
  return Math.min(100, Math.round((group.memberCount / group.capacity) * 100));
}

export function sortedChildren(groups: OrganizationGroup[], parentId: number | null): OrganizationGroup[] {
  return groups.filter(group => (group.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
