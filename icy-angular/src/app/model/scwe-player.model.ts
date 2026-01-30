export type ScWorldEventDto = {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;            // ISO string
  endAt?: string | null;      // ISO string | null

  typeName?: string;
  typeTextColor?: string | null;
  typeImageUrl?: string | null;
  bannerImageUrl?: string | null;

  gallery?: any;
  scoreSchema?: any;
};

export type ScWorldEventParticipationDto = {
  id: string;
  status: number;
  total: number;

  // Champs spécifiques
  username?: string;
  data?: string; // JSON string brut venant du back (parfois)
  points: Record<string, number>; // Objet parsé utilisé par le front

  createdAt?: string;
  updatedAt?: string;

  event: ScWorldEventDto;
};

export type ScWorldEventParticipationViewDto = {
  event: ScWorldEventDto;
  participation: ScWorldEventParticipationDto | null;
};

// Définitions du Schéma de Score
export interface ScweMilestone {
  at: number;
  label?: string;
  imageUrl?: string;
}

export interface ScweFieldDefinition {
  key: string;
  label: string;
  max: number;
  min?: number;
  milestones?: ScweMilestone[];
}

export interface ScweTotalDefinition {
  mode: string;
  keys: string[];
  milestones?: ScweMilestone[];
}

export interface ScweScoreSchema {
  fields: ScweFieldDefinition[];
  total?: ScweTotalDefinition;
  version?: number;
}
