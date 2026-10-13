/** Composition d'une opération telle que la lit un participant (GET /api/operations/{id}/composition). */
import { GroupSeats, OperationGroupBase, seatsFor } from '../operation-group.model';

export interface CompositionGroup extends OperationGroupBase, GroupSeats {
  description?: string | null;
}

export interface CompositionRequest { id: string; groupId: number; groupName: string; createdAt?: string | null; }

export interface OperationComposition {
  /** Inscrit Présent : condition pour rejoindre ou demander un groupe. */
  present: boolean;
  myGroupId: number | null;
  myRequest: CompositionRequest | null;
  groups: CompositionGroup[];
}

/** Vrai si le membre peut encore rejoindre ou demander ce groupe, d'après ce qui a été lu (le serveur recontrôle). */
export function isOpenTo(group: CompositionGroup, composition: OperationComposition): boolean {
  return !group.container && group.id !== composition.myGroupId && group.effectiveMode !== 'MANAGED'
    && seatsFor(group, composition.myGroupId, composition.groups) !== 0;
}
