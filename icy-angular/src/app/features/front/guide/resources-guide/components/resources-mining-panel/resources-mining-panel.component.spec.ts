import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ResourcesMiningPanelComponent } from './resources-mining-panel.component';

describe('ResourcesMiningPanelComponent catalogue locations', () => {
  it('selects and tracks distinct catalogue locations even when database ids are null', () => {
    vi.useFakeTimers();
    const component = new ResourcesMiningPanelComponent({
      listFrontLocations: () => of({ data: [
        { id: null, locationKey: 'wiki:hur-l1', locationCode: 'HUR-L1', ores: [{ oreCode: 'Gold', probability: null }] },
        { id: null, locationKey: 'wiki:hur-l2', locationCode: 'HUR-L2', ores: [{ oreCode: 'Gold', probability: 0 }] }
      ] })
    } as never, {
      listFrontBodies: () => of({ data: [] }),
      listFrontLocationImages: () => of({ data: [] })
    } as never);
    try {
      component.ngOnInit();
      expect(component.parsedLocations.map((row, i) => component.trackLocation(i, row))).toEqual(['wiki:hur-l1', 'wiki:hur-l2']);
      component.selectPlanet('hurston');
      component.selectLocation('wiki:hur-l2');
      vi.runAllTimers();
      expect(component.selectedLocation?.key).toBe('wiki:hur-l2');
      expect(component.formatPercent(null)).toBe('Non renseigné');
      expect(component.formatPercent(0)).toBe('0 %');
      component.selectOreSuggestion('Gold');
      component.focusOreResult(component.activeOreResults.find(row => row.locationKey === 'wiki:hur-l1')!);
      expect(component.selectedLocation?.key).toBe('wiki:hur-l1');
    } finally {
      component.ngOnDestroy();
      vi.useRealTimers();
    }
  });

  it('formats game-file ranges and clusters without inventing missing values', () => {
    const component = new ResourcesMiningPanelComponent({ listFrontLocations: () => of({ data: [] }) } as never,
      { listFrontBodies: () => of({ data: [] }), listFrontLocationImages: () => of({ data: [] }) } as never);
    expect(component.formatConcentrationRange(0.283, 0.783)).toBe('28 – 78 %');
    expect(component.formatConcentrationRange(null, null)).toBe('—');
    expect(component.formatConcentrationRange(0.05, null)).toBe('5,0 %');
    const ore = { oreCode: 'Quantainium', probability: 0.02, minPct: null, maxPct: null, medPct: null };
    expect(component.formatCluster(ore)).toBe('—');
    expect(component.formatCluster({ ...ore, clusterMin: 2, clusterMax: 2, clusterProbability: 0.25 })).toBe('2 rochers');
    expect(component.formatCluster({ ...ore, clusterMin: 2, clusterMax: 4 })).toBe('2 à 4 rochers');
    expect(component.clusterTitle({ ...ore, clusterProbability: 0.25 })).toBe('Apparaît en amas dans 25 % des cas');
  });

  it('reuses the planet groups between reads so the page does not rebuild them on every check', () => {
    const component = new ResourcesMiningPanelComponent({ listFrontLocations: () => of({ data: [] }) } as never,
      { listFrontBodies: () => of({ data: [] }), listFrontLocationImages: () => of({ data: [] }) } as never);
    component.catalogLocations = [{ name: 'Daymar', systemName: 'Stanton', imageUrl: 'daymar.jpg' }] as never;
    component.parsedLocations = [{ key: 'wiki:daymar', displayLabel: 'Daymar', visibilityKind: 'MOON', groupPlanet: 'Daymar', ores: [], oresText: '' }] as never;
    const first = component.systemGroups;
    expect(component.systemGroups).toBe(first);
    expect(component.selectedPlanetGroup).toBe(component.selectedPlanetGroup);
    expect(first[0].groups[0]).toMatchObject({ planetName: 'Daymar', systemName: 'Stanton', imageUrl: 'daymar.jpg' });
    component.miningSearch = 'zzz';
    expect(component.systemGroups).not.toBe(first);
  });
});
