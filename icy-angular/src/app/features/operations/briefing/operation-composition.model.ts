/** Composition d'une opération telle que la lit un participant (GET /api/operations/{id}/composition). */
export type CompositionMode = 'FREE' | 'VALIDATION' | 'MANAGED';

export interface CompositionMember { userId: string; username: string; }

export interface CompositionGroup {
  id: number;
  parentId: number | null;
  name: string;
  description?: string | null;
  capacity: number | null;
  effectiveMode: CompositionMode;
  /** Groupe qui répartit ses membres dans ses sous-groupes : personne ne s'y inscrit directement. */
  container: boolean;
  memberCount: number;
  /** Places restantes, plafond du parent compris ; null sans limite. */
  freeSeats: number | null;
  /** Places restantes selon la seule capacité du groupe. */
  ownFreeSeats: number | null;
  responsibleUsername: string | null;
  members: CompositionMember[];
}

export interface CompositionRequest { id: string; groupId: number; groupName: string; createdAt?: string | null; }

export interface OperationComposition {
  /** Inscrit Présent : condition pour rejoindre ou demander un groupe. */
  present: boolean;
  myGroupId: number | null;
  myRequest: CompositionRequest | null;
  groups: CompositionGroup[];
}

export const COMPOSITION_MODE_LABELS: Record<CompositionMode, string> = { FREE: 'Libre', VALIDATION: 'Sur validation', MANAGED: 'Géré par les organisateurs' };

/** Vrai si le membre peut encore rejoindre ou demander ce groupe, d'après ce qui a été lu (le serveur recontrôle). */
export function isOpenTo(group: CompositionGroup, composition: OperationComposition): boolean {
  return !group.container && group.id !== composition.myGroupId && group.effectiveMode !== 'MANAGED'
    && seatsFor(group, composition.myGroupId, composition.groups) !== 0;
}

export function occupancy(group: CompositionGroup): string {
  if (group.capacity !== null) return `${group.memberCount} / ${group.capacity}`;
  return group.memberCount === 1 ? '1 membre' : `${group.memberCount} membres`;
}

/** Taux de remplissage pour la jauge ; null sans capacité : aucune jauge n'est alors dessinée. */
export function fillPercent(group: CompositionGroup): number | null {
  if (group.capacity === null) return null;
  if (group.capacity <= 0) return 100;
  return Math.min(100, Math.round((group.memberCount / group.capacity) * 100));
}

/**
 * Places pour un membre venant de `fromGroupId` : s'il est déjà compté dans le même groupe parent,
 * seul le plafond propre à la destination compte (le serveur applique la même règle).
 */
export function seatsFor(destination: CompositionGroup, fromGroupId: number | null, groups: CompositionGroup[]): number | null {
  const from = fromGroupId === null ? undefined : groups.find(group => group.id === fromGroupId);
  const sameParent = !!from && from.parentId !== null && from.parentId === destination.parentId;
  return sameParent ? destination.ownFreeSeats : destination.freeSeats;
}
