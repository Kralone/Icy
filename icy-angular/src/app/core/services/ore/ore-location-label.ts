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
