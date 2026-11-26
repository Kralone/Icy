import { describe, expect, it } from 'vitest';
import { formatOreName, parseOreZoneCode, resolveOrePlace, sortOresByProbability } from './ore-location-label';

describe('ore zone labels', () => {
  it('reads planets, Lagrange points and other sites', () => {
    expect(parseOreZoneCode('HUR-L2')).toEqual({ displayLabel: 'Hurston L2', groupPlanet: 'Hurston', kind: 'LAGRANGE' });
    expect(parseOreZoneCode('MIC')).toEqual({ displayLabel: 'microTech', groupPlanet: 'microTech', kind: 'PLANET' });
    expect(parseOreZoneCode(' Daymar ')).toEqual({ displayLabel: 'Daymar', groupPlanet: 'Daymar', kind: 'OTHER' });
  });

  it('sorts ores by frequency and keeps unknown frequencies last', () => {
    const sorted = sortOresByProbability({ ores: [
      { oreCode: 'IRON', probability: null, minPct: null, maxPct: null },
      { oreCode: 'GOLD', probability: 0.2, minPct: null, maxPct: null },
      { oreCode: 'QUANTANIUM', probability: 0.8, minPct: null, maxPct: null }
    ] });
    expect(sorted.map(ore => ore.oreCode)).toEqual(['QUANTANIUM', 'GOLD', 'IRON']);
  });

  it('formats ore codes for display', () => {
    expect(formatOreName('QUANTANIUM')).toBe('Quantanium');
    expect(formatOreName('INERT MATERIALS')).toBe('Inert Materials');
  });
});

describe('resolveOrePlace', () => {
  it('rattache lunes, points de Lagrange et ceintures à leur planète', () => {
    expect(resolveOrePlace('DAY')).toMatchObject({ planet: 'Crusader', system: 'Stanton', kind: 'MOON', tabLabel: 'Daymar' });
    expect(resolveOrePlace('Daymar')).toMatchObject({ planet: 'Crusader', kind: 'MOON' });
    expect(resolveOrePlace('HUR-L2')).toMatchObject({ planet: 'Hurston', kind: 'LAGRANGE', label: 'Hurston L2', tabLabel: 'L2' });
    expect(resolveOrePlace('PYR2L4')).toMatchObject({ planet: 'Monox', system: 'Pyro', kind: 'LAGRANGE', tabLabel: 'L4' });
    expect(resolveOrePlace('PYR1-L1')).toMatchObject({ planet: 'Pyro I', label: 'Pyro I L1' });
    expect(resolveOrePlace('PY4')).toMatchObject({ planet: 'Pyro IV', kind: 'PLANET', tabLabel: 'Surface' });
    expect(resolveOrePlace('VUU')).toMatchObject({ planet: 'Pyro V', kind: 'MOON', label: 'Vuur' });
    expect(resolveOrePlace('YELB')).toMatchObject({ planet: 'Crusader', kind: 'BELT', label: 'Ceinture de Yela' });
    expect(resolveOrePlace('MIC')).toMatchObject({ planet: 'microTech', kind: 'PLANET' });
  });

  it('laisse les bases, stations et amas hors de la hiérarchie', () => {
    for (const code of ['RMB-ALME', 'ST-01K-I43', 'MINING BASE #01K-I43', 'AARON_HALO', 'AKIRO CLUSTER', 'Stanton', 'PYR', 'RAB-ALPHA']) {
      expect(resolveOrePlace(code)).toMatchObject({ planet: null, kind: 'OTHER', label: code });
    }
  });

  it('complète avec les astres du catalogue sans contredire la hiérarchie connue', () => {
    const catalog = [{ name: 'Pyro V', bodyType: 'PLANET' as const, parentPlanet: null, systemName: 'Pyro' },
      { name: 'Ignis', bodyType: 'MOON' as const, parentPlanet: 'Pyro V', systemName: 'Pyro' }];
    expect(resolveOrePlace('IGN', catalog)).toMatchObject({ planet: 'Pyro V', label: 'Ignis' });
    const orphan = [{ name: 'Daymar', bodyType: 'MOON' as const, parentPlanet: null, systemName: 'Stanton' }];
    expect(resolveOrePlace('DAY', orphan)).toMatchObject({ planet: 'Crusader', kind: 'MOON' });
    const wrong = [{ name: 'Pyro I', bodyType: 'MOON' as const, parentPlanet: null, systemName: 'Pyro' }];
    expect(resolveOrePlace('PY1', wrong)).toMatchObject({ planet: 'Pyro I', kind: 'PLANET' });
    const extra = [{ name: 'Glacium', bodyType: 'MOON' as const, parentPlanet: 'Pyro IV', systemName: 'Pyro' }];
    expect(resolveOrePlace('GLACIUM', extra)).toMatchObject({ planet: 'Pyro IV', kind: 'MOON' });
  });
});
