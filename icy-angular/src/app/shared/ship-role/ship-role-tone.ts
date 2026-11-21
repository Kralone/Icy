/**
 * Teinte d'un rôle de vaisseau (triplet RVB), reprise des couleurs des pôles :
 * combat en rouge, transport en orange, industrie en vert, exploration en cyan, départ en bleu glace.
 * Un rôle inconnu reste argenté.
 */
const ROLE_TONES: { tone: string; words: string[] }[] = [
  { tone: '248 113 113', words: ['combat', 'fighter', 'chasseur', 'bomb', 'gunship', 'military', 'militaire', 'interdiction', 'frigate', 'frégate', 'destroyer', 'corvette', 'dropship', 'stealth', 'snub', 'escort'] },
  { tone: '251 146 60', words: ['cargo', 'transport', 'freight', 'fret', 'hauler', 'logisti', 'passenger', 'passager', 'refuel', 'ravitaill', 'repair', 'réparation', 'medical', 'médical', 'carrier'] },
  { tone: '52 211 153', words: ['mining', 'minage', 'salvage', 'récupération', 'industri', 'refin', 'raffin', 'construction', 'production'] },
  { tone: '34 211 238', words: ['explor', 'pathfinder', 'expedition', 'expédition', 'touring', 'luxury', 'reporting', 'data', 'science'] },
  { tone: '186 230 253', words: ['starter', 'départ', 'debut', 'début', 'racing', 'course'] }
];

export const DEFAULT_ROLE_TONE = '203 213 225';

export function shipRoleTone(role: string | null | undefined): string {
  const value = (role ?? '').trim().toLowerCase();
  if (!value) return DEFAULT_ROLE_TONE;
  return ROLE_TONES.find(entry => entry.words.some(word => value.includes(word)))?.tone ?? DEFAULT_ROLE_TONE;
}

/** Initiales d'un pseudo pour une pastille : deux lettres au plus. */
export function nameInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/[\s_\-.]+/).filter(Boolean);
  if (!parts.length) return '?';
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}
