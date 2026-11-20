import { SPECIALTIES } from '../user/member-rank';

export type PoleKey = (typeof SPECIALTIES)[number]['key'];

export interface PoleTool {
  label: string;
  description: string;
  route: string;
}

export interface PoleDefinition {
  key: PoleKey;
  /** Segment d'adresse de la page du pôle : /icy/poles/<slug>. */
  slug: string;
  label: string;
  description: string;
  imageUrl: string;
  /** Outils du site rattachés au pôle. Vide tant que le pôle n'en a pas. */
  tools: PoleTool[];
}

export interface PoleSpecialist {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

/** Réponse de /api/poles : un pôle et ses Spécialistes référents. */
export interface PoleReferents {
  key: string;
  specialists: PoleSpecialist[];
}

const IMAGES: Record<PoleKey, string> = {
  LOGISTIQUE: 'assets/images/home/activities/cargo.jpg',
  MILITAIRE: 'assets/images/home/activities/space-combat.jpg',
  INDUSTRIE: 'assets/images/home/activities/mining.jpg'
};

const TOOLS: Record<PoleKey, PoleTool[]> = {
  LOGISTIQUE: [],
  MILITAIRE: [],
  INDUSTRIE: [
    { label: 'Fiches de minage', description: 'Sessions de minage : raffinage, ventes, frais et partage des gains.', route: '/icy/outils/fiches-minage' },
    { label: 'Ressources de minage', description: 'Où trouver chaque minerai et avec quel équipement.', route: '/icy/outils/ressources-minage' },
    { label: 'Guide de minage', description: 'Les bases pour débuter et progresser.', route: '/icy/outils/guides/minage-star-citizen' },
    { label: 'Minage avancé', description: 'Techniques et réglages pour les mineurs confirmés.', route: '/icy/outils/guides/minage-avance' },
    { label: 'Guide de salvage', description: 'Récupération de coques et de composants.', route: '/icy/outils/guides/salvage' }
  ]
};

/** Les trois pôles, dans l'ordre d'affichage. */
export const POLES: readonly PoleDefinition[] = SPECIALTIES.map(pole => ({
  key: pole.key,
  slug: pole.key.toLowerCase(),
  label: pole.label,
  description: pole.description,
  imageUrl: IMAGES[pole.key],
  tools: TOOLS[pole.key]
}));

export function poleBySlug(slug: string | null | undefined): PoleDefinition | null {
  const wanted = (slug ?? '').trim().toLowerCase();
  return POLES.find(pole => pole.slug === wanted) ?? null;
}

/** Référents d'un pôle dans la réponse du serveur ; liste vide si le pôle n'en a pas. */
export function referentsOf(poles: readonly PoleReferents[] | null | undefined, key: string): PoleSpecialist[] {
  return (poles ?? []).find(pole => (pole.key ?? '').toUpperCase() === key)?.specialists ?? [];
}
