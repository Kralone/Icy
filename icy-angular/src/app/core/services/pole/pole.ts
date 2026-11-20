import { SPECIALTIES } from '../user/member-rank';

export type PoleKey = (typeof SPECIALTIES)[number]['key'];

export interface PoleTool {
  label: string;
  description: string;
  route: string;
  imageUrl: string;
}

/** Outils d'un pôle rangés par usage : sur le terrain, guides… */
export interface PoleToolGroup {
  label: string;
  tools: PoleTool[];
}

export interface PoleDefinition {
  key: PoleKey;
  /** Segment d'adresse de la page du pôle : /icy/poles/<slug>. */
  slug: string;
  label: string;
  description: string;
  imageUrl: string;
  /** Image locale affichée si imageUrl, hébergée ailleurs, ne répond pas. */
  fallbackImageUrl: string;
  /** Outils du site rattachés au pôle. Vide tant que le pôle n'en a pas. */
  toolGroups: PoleToolGroup[];
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

export interface PoleStat {
  key: string;
  value: number;
}

export interface PoleActivity {
  kind: string;
  id: string;
  name: string;
  date: string;
  status: string;
}

export interface PoleNews {
  id: number;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string | null;
}

/** Réponse de /api/poles/<pôle> : l'accueil d'un pôle pour le membre connecté. */
export interface PoleHome {
  key: string;
  specialists: PoleSpecialist[];
  canManage: boolean;
  stats: PoleStat[];
  activity: PoleActivity[];
  news: PoleNews[];
}

/** Libellé de chaque chiffre renvoyé par le serveur ; un chiffre inconnu n'est pas affiché. */
export const POLE_STAT_LABELS: Record<string, { label: string; period?: string; unit?: string }> = {
  MINING_SHEETS_30D: { label: 'Fiches de minage', period: '30 derniers jours' },
  MINING_SHEETS_OPEN: { label: 'Fiches en cours' },
  MINERS_30D: { label: 'Mineurs actifs', period: '30 derniers jours' },
  MINING_SALES_30D: { label: 'Ventes de minerai', period: '30 derniers jours', unit: 'aUEC' }
};

const ACTIVITIES = 'assets/images/home/activities/';

const IMAGES: Record<PoleKey, { imageUrl: string; fallbackImageUrl: string }> = {
  LOGISTIQUE: { imageUrl: 'https://jolstatic.fr/www/captures/1895/8/168378.jpg', fallbackImageUrl: ACTIVITIES + 'cargo.jpg' },
  MILITAIRE: {
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRabh5fyox7sTu-KA8cOXF30-hVM0bz4Q68ExQXEiG5TC3sTJG1-OWbff6H&s=10',
    fallbackImageUrl: ACTIVITIES + 'space-combat.jpg'
  },
  INDUSTRIE: {
    imageUrl: 'https://media.starcitizen.tools/f/f9/Levski_-_Low_view_with_murial_in_the_distance.jpg?ngiuz',
    fallbackImageUrl: ACTIVITIES + 'mining.jpg'
  }
};

const TOOLS: Record<PoleKey, PoleToolGroup[]> = {
  LOGISTIQUE: [],
  MILITAIRE: [],
  INDUSTRIE: [
    {
      label: 'Sur le terrain',
      tools: [
        {
          label: 'Fiches de minage',
          description: 'Sessions de minage : raffinage, ventes, frais et partage des gains.',
          route: '/icy/outils/fiches-minage',
          imageUrl: 'https://media.starcitizen.tools/thumb/d/d3/Comm-Link-Orion_Mining.jpg/1200px-Comm-Link-Orion_Mining.jpg.webp'
        },
        {
          label: 'Ressources de minage',
          description: 'Où trouver chaque minerai et avec quel équipement.',
          route: '/icy/outils/ressources-minage',
          imageUrl: 'https://media.starcitizen.tools/thumb/6/64/Refinery_01_V2-Min.jpg/1200px-Refinery_01_V2-Min.jpg.webp?b5eg9'
        }
      ]
    },
    {
      label: 'Guides',
      tools: [
        { label: 'Guide de minage', description: 'Les bases pour débuter et progresser.', route: '/icy/outils/guides/minage-star-citizen', imageUrl: ACTIVITIES + 'mining.jpg' },
        { label: 'Minage avancé', description: 'Techniques et réglages pour les mineurs confirmés.', route: '/icy/outils/guides/minage-avance', imageUrl: ACTIVITIES + 'mining.jpg' },
        { label: 'Guide de salvage', description: 'Récupération de coques et de composants.', route: '/icy/outils/guides/salvage', imageUrl: ACTIVITIES + 'salvage.jpg' }
      ]
    }
  ]
};

/** Les trois pôles, dans l'ordre d'affichage. */
export const POLES: readonly PoleDefinition[] = SPECIALTIES.map(pole => ({
  key: pole.key,
  slug: pole.key.toLowerCase(),
  label: pole.label,
  description: pole.description,
  ...IMAGES[pole.key],
  toolGroups: TOOLS[pole.key]
}));

export function poleBySlug(slug: string | null | undefined): PoleDefinition | null {
  const wanted = (slug ?? '').trim().toLowerCase();
  return POLES.find(pole => pole.slug === wanted) ?? null;
}

/** Référents d'un pôle dans la réponse du serveur ; liste vide si le pôle n'en a pas. */
export function referentsOf(poles: readonly PoleReferents[] | null | undefined, key: string): PoleSpecialist[] {
  return (poles ?? []).find(pole => (pole.key ?? '').toUpperCase() === key)?.specialists ?? [];
}
