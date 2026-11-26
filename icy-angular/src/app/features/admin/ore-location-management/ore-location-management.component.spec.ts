import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { OreLocationManagementComponent } from './ore-location-management.component';

function create() {
  const component = new OreLocationManagementComponent({
    listAdminLocations: () => of({ data: [
      { locationKey: 'wiki:hur-l2', locationCode: 'HUR-L2',
        ores: [{ oreCode: 'GOLD', probability: 0.4, minPct: null, maxPct: null }, { oreCode: 'QUANTANIUM', probability: 0.9, minPct: null, maxPct: null }] },
      { locationKey: 'wiki:day', locationCode: 'DAY', systemName: 'Stanton',
        ores: [{ oreCode: 'GOLD', probability: 0.7, minPct: null, maxPct: null }] }
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
    expect(component.rows.map(row => row.system)).toEqual(['Stanton', 'Stanton']);
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
