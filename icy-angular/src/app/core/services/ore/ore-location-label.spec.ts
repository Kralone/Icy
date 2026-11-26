import { describe, expect, it } from 'vitest';
import { formatOreName, parseOreZoneCode, sortOresByProbability } from './ore-location-label';

describe('ore zone labels', () => {
  it('reads planets, Lagrange points and other sites', () => {
    expect(parseOreZoneCode('HUR-L2')).toEqual({ displayLabel: 'Hurston L2', groupPlanet: 'Hurston', kind: 'LAGRANGE' });
    expect(parseOreZoneCode('MIC')).toEqual({ displayLabel: 'microTech', groupPlanet: 'microTech', kind: 'PLANET' });
    expect(parseOreZoneCode(' Daymar ')).toEqual({ displayLabel: 'Daymar', groupPlanet: 'Daymar', kind: 'OTHER' });
  });

  it('sorts ores by frequency and keeps unknown frequencies last', () => {
    const sorted = sortOresByProbability({ ores: [
      { oreCode: 'IRON', probability: null, minPct: null, maxPct: null, medPct: null },
      { oreCode: 'GOLD', probability: 0.2, minPct: null, maxPct: null, medPct: null },
      { oreCode: 'QUANTANIUM', probability: 0.8, minPct: null, maxPct: null, medPct: null }
    ] });
    expect(sorted.map(ore => ore.oreCode)).toEqual(['QUANTANIUM', 'GOLD', 'IRON']);
  });

  it('formats ore codes for display', () => {
    expect(formatOreName('QUANTANIUM')).toBe('Quantanium');
    expect(formatOreName('INERT MATERIALS')).toBe('Inert Materials');
  });
});
