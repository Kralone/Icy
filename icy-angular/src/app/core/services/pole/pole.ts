import { SPECIALTIES } from '../user/member-rank';

export type PoleKey = (typeof SPECIALTIES)[number]['key'];

export interface PoleTool {
  label: string;
  description: string;
  route: string;
  /** Paramètres d'adresse ajoutés au lien, par exemple le filtre de pôle du calendrier. */
  query?: Record<string, string>;
  imageUrl: string;
}

/** Outils d'un pôle rangés par usage : outils, guides… */
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
  /** État d'une fiche ; absent pour un événement ou une opération. */
  status?: string | null;
}

/** Événement ou opération à venir rattaché au pôle. */
export interface PoleAgendaEntry {
  id: string;
  kind: 'EVENT' | 'OPERATION' | string;
  title: string;
  type?: string | null;
  imageUrl?: string | null;
  startDateTime: string;
  endDateTime: string;
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
  agenda: PoleAgendaEntry[];
  news: PoleNews[];
}

/** Libellé de chaque chiffre renvoyé par le serveur ; un chiffre inconnu n'est pas affiché. */
export const POLE_STAT_LABELS: Record<string, { label: string; period?: string; unit?: string }> = {
  MINING_SHEETS_30D: { label: 'Fiches de minage', period: '30 derniers jours' },
  MINING_SHEETS_OPEN: { label: 'Fiches en cours' },
  MINERS_30D: { label: 'Mineurs actifs', period: '30 derniers jours' },
  MINING_SALES_30D: { label: 'Ventes de minerai', period: '30 derniers jours', unit: 'aUEC' },
  POLE_ACTIVITIES_30D: { label: 'Événements et opérations', period: '30 derniers jours' },
  POLE_PARTICIPANTS_30D: { label: 'Participants', period: '30 derniers jours' },
  POLE_UPCOMING: { label: 'À venir' }
};

const ACTIVITIES = 'assets/images/home/activities/';

const IMAGES: Record<PoleKey, string> = {
  LOGISTIQUE: 'assets/images/poles/logistique.jpg',
  MILITAIRE: 'assets/images/poles/militaire.jpg',
  INDUSTRIE: 'assets/images/poles/industrie.jpg'
};

const WIKI = 'https://media.starcitizen.tools/';

const TOOLS: Record<PoleKey, PoleToolGroup[]> = {
  LOGISTIQUE: [
    {
      label: 'Outils',
      tools: [
        {
          label: 'La flotte',
          description: 'Les vaisseaux de l’organisation et leurs propriétaires.',
          route: '/icy/fleet',
          imageUrl: ACTIVITIES + 'cargo.jpg'
        },
        {
          label: 'Achat de vaisseaux',
          description: 'Où acheter ou louer chaque vaisseau, et à quel prix.',
          route: '/icy/outils/achat-vaisseaux',
          imageUrl: WIKI + 'thumb/f/f6/IAE2954-day5-polaris-tunnel-view.jpg/400px-IAE2954-day5-polaris-tunnel-view.jpg.webp'
        },
        {
          label: 'Wikelo',
          description: 'Les échanges proposés par Wikelo et ce qu’ils demandent.',
          route: '/icy/outils/wikelo',
          imageUrl: WIKI + 'thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp'
        }
      ]
    }
  ],
  MILITAIRE: [
    {
      label: 'Outils',
      tools: [
        {
          label: 'Événements et opérations',
          description: 'Le calendrier des sorties, avec les groupes et les postes des opérations.',
          route: '/icy/events',
          query: { pole: 'militaire' },
          imageUrl: ACTIVITIES + 'space-combat.jpg'
        },
        {
          label: 'Hangars exécutifs',
          description: 'Cycle d’ouverture des hangars exécutifs, cartes et suivi des joueurs.',
          route: '/icy/outils/executive-hangar',
          imageUrl: WIKI + 'b/b8/Cutter_Approaching_Checkmate_Station.png'
        }
      ]
    },
    {
      label: 'Guides',
      tools: [
        {
          label: 'Guide Hathor',
          description: 'Préparation, trajet et exécution de l’opération Hathor.',
          route: '/icy/outils/guides/hathor',
          imageUrl: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png'
        }
      ]
    }
  ],
  INDUSTRIE: [
    {
      label: 'Outils',
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
        { label: 'Minage avancé', description: 'Techniques et réglages pour les mineurs confirmés.', route: '/icy/outils/guides/minage-avance', imageUrl: ACTIVITIES + 'mining-advanced.jpg' },
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
  imageUrl: IMAGES[pole.key],
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
