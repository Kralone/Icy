import { OperationIconName } from '../briefing/operation-icon.component';
import { GroupMember } from '../operation-group.model';

export type PositionMode = 'SELF' | 'MANAGED';

/** Poste d'un équipage : une fonction à bord, facultative, avec ou sans nombre de places. */
export interface CrewPosition {
  id: number;
  label: string;
  icon: string | null;
  /** Null : pas de limite propre au poste. */
  capacity: number | null;
  taken: number;
  sortOrder: number;
}

export interface CrewMember extends GroupMember {
  /** Null : membre de l'équipage sans poste. */
  positionId: number | null;
}

/** Ce qu'un groupe « Équipage de vaisseau » ajoute à un groupe ordinaire (GET /api/operations/{id}/crews). */
export interface OperationCrew {
  groupId: number;
  /** Null si le modèle a quitté le catalogue : le nom enregistré reste affiché. */
  shipModelId: number | null;
  shipModelName: string | null;
  shipModelImageUrl: string | null;
  positionMode: PositionMode;
  manageable: boolean;
  positions: CrewPosition[];
  members: CrewMember[];
}

export interface CrewPresetPosition { label: string; icon: string | null; capacity: number | null; }

export interface CrewPreset {
  id: string;
  name: string;
  description: string | null;
  shipModelId: number | null;
  shipModelName: string;
  shipModelImageUrl: string | null;
  capacity: number | null;
  positionMode: PositionMode;
  archived: boolean;
  positions: CrewPresetPosition[];
}

export interface PositionDraft { label: string; icon: string | null; capacity: number | null; }

export const POSITION_MODE_LABELS: Record<PositionMode, string> = {
  SELF: 'Choisis par les membres',
  MANAGED: 'Attribués par les responsables'
};

export const POSITION_MODE_HINTS: Record<PositionMode, string> = {
  SELF: 'Chaque membre de l’équipage choisit son poste, ou reste sans poste.',
  MANAGED: 'Seuls les organisateurs et le responsable de l’équipage attribuent les postes.'
};

/** Pictogrammes proposés pour un poste ; le choix est facultatif. */
export const POSITION_ICONS: ReadonlyArray<{ key: OperationIconName; label: string }> = [
  { key: 'pilot', label: 'Pilotage' },
  { key: 'target', label: 'Tir' },
  { key: 'wrench', label: 'Technique' },
  { key: 'medic', label: 'Soins' },
  { key: 'cargo', label: 'Cargaison' },
  { key: 'radar', label: 'Détection' },
  { key: 'star', label: 'Commandement' }
];

/** Pictogramme d'un poste ; un nom inconnu ou absent rend le pictogramme neutre. */
export function positionIcon(icon: string | null | undefined): OperationIconName {
  return POSITION_ICONS.find(candidate => candidate.key === icon)?.key ?? 'assignment';
}

export function isPositionFull(position: Pick<CrewPosition, 'capacity' | 'taken'>): boolean {
  return position.capacity !== null && position.taken >= position.capacity;
}

export function positionOccupancy(position: Pick<CrewPosition, 'capacity' | 'taken'>): string {
  return position.capacity === null ? `${position.taken} · sans limite` : `${position.taken} / ${position.capacity}`;
}

export function membersAt(crew: OperationCrew, positionId: number | null): CrewMember[] {
  return crew.members.filter(member => (member.positionId ?? null) === positionId);
}
