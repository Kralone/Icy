import { OreLocation, OreMix } from './ore-location.service';

export type OreZoneKind = 'PLANET' | 'LAGRANGE' | 'OTHER';

export interface OreZoneLabel {
  /** Nom lisible : « Hurston », « Hurston L2 », ou le code d'origine. */
  displayLabel: string;
  /** Planète de rattachement, ou le code d'origine quand il ne désigne pas une planète connue. */
  groupPlanet: string;
  kind: OreZoneKind;
}

const PLANET_ALIASES: Record<string, string> = {
  HUR: 'Hurston',
  ARC: 'ArcCorp',
  MIC: 'microTech',
  CRU: 'Crusader',
  PYR: 'Pyro'
};

/** Traduit un code de zone (« HUR-L2 », « MIC », « Daymar ») en libellé et type de zone. */
export function parseOreZoneCode(rawCode: string): OreZoneLabel {
  const raw = (rawCode ?? '').trim();
  const upper = raw.toUpperCase();

  const lagrange = upper.match(/(HUR|ARC|MIC|CRU|PYR)\s*[-_ ]?L([1-6])/);
  if (lagrange) {
    const planet = PLANET_ALIASES[lagrange[1]] ?? lagrange[1];
    return { displayLabel: `${planet} L${lagrange[2]}`, groupPlanet: planet, kind: 'LAGRANGE' };
  }

  const body = upper.match(/\b(HUR|ARC|MIC|CRU|PYR)\b/);
  if (body) {
    const planet = PLANET_ALIASES[body[1]] ?? body[1];
    return { displayLabel: planet, groupPlanet: planet, kind: 'PLANET' };
  }

  return { displayLabel: raw, groupPlanet: raw, kind: 'OTHER' };
}

export const ORE_ZONE_KIND_LABELS: Record<OreZoneKind, string> = {
  PLANET: 'Planète',
  LAGRANGE: 'Point de Lagrange',
  OTHER: 'Lune ou site'
};

/** Minerais d'une zone, du plus fréquent au moins fréquent ; une fréquence absente passe en dernier. */
export function sortOresByProbability(location: Pick<OreLocation, 'ores'>): OreMix[] {
  return [...(location.ores ?? [])].sort((left, right) => {
    if (left.probability !== right.probability) {
      return (right.probability ?? -1) - (left.probability ?? -1);
    }
    return left.oreCode.localeCompare(right.oreCode);
  });
}

/** « QUANTANIUM » devient « Quantanium » ; « INERT MATERIALS » devient « Inert Materials ». */
export function formatOreName(code: string): string {
  return (code ?? '')
    .toLowerCase()
    .replace(/(^|[\s_-])([a-zà-ÿ])/g, (_, separator: string, letter: string) => `${separator === '_' ? ' ' : separator}${letter.toUpperCase()}`);
}

/** Rattachement d'un code de zone de minage dans la hiérarchie système > planète > lieu. */
export type OrePlaceKind = 'PLANET' | 'MOON' | 'LAGRANGE' | 'BELT' | 'OTHER';

export interface OrePlace {
  /** Libellé lisible de la zone (« Daymar », « Pyro I L1 », « RMB-ALME »). */
  label: string;
  /** Onglet de la zone dans la fiche de sa planète (« Surface », « Daymar », « L1 », « Ceinture de Yela »). */
  tabLabel: string;
  /** Planète de rattachement ; null pour un lieu isolé (base, station, amas), visible seulement par la recherche. */
  planet: string | null;
  system: string | null;
  kind: OrePlaceKind;
}

export interface OreBodyRef {
  name: string;
  bodyType: 'PLANET' | 'MOON';
  parentPlanet: string | null;
  systemName: string | null;
}

/** Astres de Stanton et Pyro et leur planète : référence fixe, le catalogue ajoute les astres manquants. */
const KNOWN_BODIES: OreBodyRef[] = [
  ...['Hurston', 'Crusader', 'ArcCorp', 'microTech'].map((name) => ({ name, bodyType: 'PLANET' as const, parentPlanet: null, systemName: 'Stanton' })),
  ...([['Arial', 'Hurston'], ['Aberdeen', 'Hurston'], ['Magda', 'Hurston'], ['Ita', 'Hurston'],
    ['Cellin', 'Crusader'], ['Daymar', 'Crusader'], ['Yela', 'Crusader'],
    ['Lyria', 'ArcCorp'], ['Wala', 'ArcCorp'],
    ['Calliope', 'microTech'], ['Clio', 'microTech'], ['Euterpe', 'microTech']] as const)
    .map(([name, parentPlanet]) => ({ name, bodyType: 'MOON' as const, parentPlanet, systemName: 'Stanton' })),
  ...['Pyro I', 'Monox', 'Bloom', 'Pyro IV', 'Pyro V', 'Terminus'].map((name) => ({ name, bodyType: 'PLANET' as const, parentPlanet: null, systemName: 'Pyro' })),
  ...['Ignis', 'Vatra', 'Adir', 'Fairo', 'Fuego', 'Vuur']
    .map((name) => ({ name, bodyType: 'MOON' as const, parentPlanet: 'Pyro V', systemName: 'Pyro' }))
];

/** Planètes de Pyro par rang : PYR2 et PY2 désignent Monox (Pyro II). */
const PYRO_PLANETS = ['Pyro I', 'Monox', 'Bloom', 'Pyro IV', 'Pyro V', 'Terminus'];
const SYSTEM_NAMES = new Set(['stanton', 'pyro', 'nyx']);

const compact = (value: string) => (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Situe un code de zone des fichiers du jeu : « DAY » est la lune Daymar de Crusader,
 * « PYR1-L1 » le point L1 de Pyro I, « YELB » la ceinture de Yela ; « RMB-ALME » reste un lieu isolé.
 */
export function resolveOrePlace(rawCode: string, catalogBodies: readonly OreBodyRef[] = []): OrePlace {
  const raw = (rawCode ?? '').trim();
  const upper = raw.toUpperCase();
  // Les astres connus passent d'abord : le catalogue ne peut pas faire d'une planète une lune ; il complète les autres.
  const bodies = [...KNOWN_BODIES, ...catalogBodies];
  const byName = (name: string) => bodies.find((body) => compact(body.name) === compact(name)) ?? null;
  const planetOf = (body: OreBodyRef) => {
    if (body.bodyType !== 'MOON') return body;
    // Une lune du catalogue sans planète renseignée reprend celle de la liste des astres connus.
    const parent = body.parentPlanet ?? KNOWN_BODIES.find((known) => compact(known.name) === compact(body.name))?.parentPlanet;
    return parent ? byName(parent) ?? body : body;
  };
  const place = (body: OreBodyRef, kind: OrePlaceKind, label: string, tabLabel: string): OrePlace => {
    const planet = planetOf(body);
    return { label, tabLabel, planet: planet.name, system: planet.systemName ?? body.systemName ?? null, kind };
  };

  const stanton = upper.match(/^(HUR|ARC|MIC|CRU)\s*[-_ ]?L([1-6])$/) ?? upper.match(/\b(HUR|ARC|MIC|CRU)\s*[-_ ]?L([1-6])\b/);
  const pyro = upper.match(/^PYR?([1-6])\s*[-_ ]?L([1-6])$/);
  if (stanton || pyro) {
    const name = stanton ? PLANET_ALIASES[stanton[1]] : PYRO_PLANETS[Number(pyro![1]) - 1];
    const body = byName(name);
    const point = (stanton ?? pyro)![2];
    if (body) return place(body, 'LAGRANGE', `${planetOf(body).name} L${point}`, `L${point}`);
  }

  const pyroPlanet = upper.match(/^PYR?([1-6])$/);
  const alias = upper.match(/^(HUR|ARC|MIC|CRU)$/);
  const direct = pyroPlanet ? byName(PYRO_PLANETS[Number(pyroPlanet[1]) - 1])
    : alias ? byName(PLANET_ALIASES[alias[1]])
      : byName(raw) ?? byPrefix(bodies, upper);
  if (direct) {
    return direct.bodyType === 'MOON'
      ? place(direct, 'MOON', direct.name, direct.name)
      : place(direct, 'PLANET', direct.name, 'Surface');
  }

  const belt = upper.match(/^([A-Z]{3})(?:B|[-_ ]BELT)$/);
  const beltBody = belt ? byPrefix(bodies, belt[1]) : null;
  if (beltBody) return place(beltBody, 'BELT', `Ceinture de ${beltBody.name}`, `Ceinture de ${beltBody.name}`);

  return { label: raw, tabLabel: raw, planet: null, system: null, kind: 'OTHER' };
}

/** Code à trois lettres (« DAY », « CEL ») : l'astre dont le nom commence ainsi, s'il est unique. */
function byPrefix(bodies: readonly OreBodyRef[], code: string): OreBodyRef | null {
  if (!/^[A-Z]{3}$/.test(code) || SYSTEM_NAMES.has(code.toLowerCase())) return null;
  const prefix = code.toLowerCase();
  const names = new Map<string, OreBodyRef>();
  for (const body of bodies) {
    if (compact(body.name).startsWith(prefix) && !names.has(compact(body.name))) names.set(compact(body.name), body);
  }
  return names.size === 1 ? [...names.values()][0] : null;
}
