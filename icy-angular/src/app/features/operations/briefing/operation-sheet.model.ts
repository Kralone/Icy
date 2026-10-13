/** Ce que la fiche d'une opération affiche : la même forme sert à la page publiée et à l'aperçu de l'éditeur. */
export interface OperationSheet {
  id: string;
  title: string;
  description?: string | null;
  briefing?: string | null;
  objectives?: string | null;
  meetingPoint?: string | null;
  imageUrl?: string | null;
  startDateTime: string;
  endDateTime: string;
  finished: boolean;
  /** Heure de fin atteinte selon le serveur : organisation et flotte en lecture seule. */
  locked?: boolean;
  /** Heure de début atteinte selon le serveur. */
  started?: boolean;
  publicationStatus?: 'DRAFT' | 'PUBLISHED';
  allowShipProposals: boolean;
  /** Mode des groupes qui n'en fixent pas un eux-mêmes. */
  defaultAssignmentMode?: string;
  /** Type d'événement choisi à la création : il donne son nom, ses couleurs et son image de repli. */
  typeName?: string | null;
  typeTextColor?: string | null;
  typeBackgroundColor?: string | null;
  typeImageUrl?: string | null;
}

export interface ObjectiveItem { kind: 'PRINCIPAL' | 'SECONDAIRE'; text: string; }

/** Objectifs enregistrés en JSON ; un ancien texte libre reste lisible comme un objectif principal. */
export function parseObjectiveItems(value?: string | null): ObjectiveItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item.text === 'string' && item.text.trim())
        .map(item => ({ kind: item.kind === 'SECONDAIRE' ? 'SECONDAIRE' : 'PRINCIPAL', text: item.text }));
    }
  } catch { /* texte libre */ }
  return [{ kind: 'PRINCIPAL', text: value }];
}
