export interface EventType {
  name: string;
  textColor: string;
  backgroundColor: string;
  imageUrl: string;
  /** Archivé : n'est plus proposé à la création, reste affiché sur les activités existantes. */
  archived?: boolean;
  /** Nombre d'activités (événements et opérations) qui utilisent ce type. */
  usageCount?: number;
}

/** Données envoyées pour créer ou modifier un type. */
export interface EventTypeRequest {
  name: string;
  textColor: string;
  backgroundColor: string;
  imageUrl: string | null;
}
