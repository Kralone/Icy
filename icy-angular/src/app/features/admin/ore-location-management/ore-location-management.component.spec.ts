import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { OreLocationManagementComponent } from './ore-location-management.component';

const range = { min: 1, med: 2, max: 3 };
function create() {
  const component = new OreLocationManagementComponent({
    listAdminLocations: () => of({ data: [
      { id: 1, locationCode: 'HUR-L2', users: 3, scans: 40, clusters: 5, clusterCount: range, mass: range, inst: range, res: range,
        ores: [{ oreCode: 'GOLD', probability: 0.4, minPct: null, maxPct: null, medPct: null }, { oreCode: 'QUANTANIUM', probability: 0.9, minPct: null, maxPct: null, medPct: null }] },
      { id: 2, locationCode: 'Daymar', users: 1, scans: 10, clusters: 2, clusterCount: range, mass: range, inst: range, res: range,
        ores: [{ oreCode: 'GOLD', probability: 0.7, minPct: null, maxPct: null, medPct: null }] }
    ] })
  } as never);
  component.ngOnInit();
  return component;
}

describe('OreLocationManagementComponent', () => {
  it('labels zones and ranks each ore by frequency', () => {
    const component = create();
    expect(component.rows.map(row => row.label)).toEqual(['Hurston L2', 'Daymar']);
    const gold = component.rankings.find(ranking => ranking.code === 'GOLD')!;
    expect(gold.zones.map(zone => zone.row.label)).toEqual(['Daymar', 'Hurston L2']);
    expect(component.totalScans).toBe(50);
  });

  it('filters by zone type and by ore', () => {
    const component = create();
    component.setKindFilter('LAGRANGE');
    expect(component.filteredRows.map(row => row.label)).toEqual(['Hurston L2']);
    component.setKindFilter('ALL');
    component.search = 'quanta';
    component.onSearchChange();
    expect(component.filteredRows.map(row => row.label)).toEqual(['Hurston L2']);
    expect(component.filteredRankings.map(ranking => ranking.code)).toEqual(['QUANTANIUM']);
  });

  it('opens a zone from the ore view', () => {
    const component = create();
    component.setViewMode('ores');
    component.openZone(component.rows[1]);
    expect(component.viewMode).toBe('zones');
    expect(component.expandedKey).toBe(component.rows[1].key);
  });
});
