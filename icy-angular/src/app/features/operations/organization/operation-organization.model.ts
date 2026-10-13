import { EffectiveAssignmentMode, GroupSeats, OperationGroupBase } from '../operation-group.model';

export type AssignmentMode = 'INHERITED' | EffectiveAssignmentMode;

/** Groupe tel que le lit l'éditeur ; les places ne sont renseignées que par la lecture de la structure. */
export interface OrganizationGroup extends OperationGroupBase, Partial<GroupSeats> {
  description: string | null;
  assignmentMode: AssignmentMode;
  sortOrder: number;
  responsibleUserId: string | null;
  pendingRequests: number;
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

export const MODE_HINTS: Record<EffectiveAssignmentMode, string> = {
  FREE: 'Un membre présent rejoint le groupe tout de suite, s’il reste une place.',
  VALIDATION: 'Un membre présent envoie une demande ; un organisateur ou le responsable l’accepte.',
  MANAGED: 'Les membres ne rejoignent pas ce groupe eux-mêmes.'
};

export function sortedChildren(groups: OrganizationGroup[], parentId: number | null): OrganizationGroup[] {
  return groups.filter(group => (group.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
