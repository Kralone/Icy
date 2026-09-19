import { of } from 'rxjs';
import { ResourcesRefiningPanelComponent } from './resources-refining-panel.component';
import { UexDatasetService } from '../../../../../../core/services/uex/uex-dataset.service';
import { CelestialBodyService } from '../../../../../../core/services/celestial/celestial-body.service';

describe('ResourcesRefiningPanelComponent data projection', () => {
  function create(yields: Record<string, unknown>[]) {
    const component = new ResourcesRefiningPanelComponent(
      { listRefineryDatasets: () => of({ data: { yields, yieldsGameVersion: '4.7' } }) } as unknown as UexDatasetService,
      { listFrontLocationImages: () => of({ data: [
        { name: 'ARC-L1 Wide Forest Station', family: 'STATION', imageUrl: '/catalog/arc.webp', sourceVersion: '4.7' }
      ] }) } as unknown as CelestialBodyService
    );
    component.ngOnInit();
    return component;
  }

  it('retains the newest observation instead of the most favourable yield', () => {
    const component = create([
      { space_station_name: 'ARC-L1 Wide Forest Station', commodity_name: 'Gold', value: 10, date_modified: 1000 },
      { space_station_name: 'ARC-L1 Wide Forest Station', commodity_name: 'Gold', value: -5, date_modified: 2000 },
      { space_station_name: 'ARC-L1 Wide Forest Station', commodity_name: 'Iron', value: 0, date_modified: 2000 },
      { space_station_name: 'ARC-L1 Wide Forest Station', commodity_name: 'Copper', value: null, date_modified: 2000 }
    ]);
    expect(component.refineries[0].yields.find(row => row.commodity === 'Gold')?.bestYieldPct).toBe(-5);
    expect(component.refineries[0].yields.find(row => row.commodity === 'Iron')?.bestYieldPct).toBe(0);
    expect(component.refineries[0].yields.find(row => row.commodity === 'Copper')?.bestYieldPct).toBeNull();
    expect(component.refineries[0].imageUrl).toBe('/catalog/arc.webp');
    expect(component.refineries[0].imageProvenance).toContain('4.7');
    expect(component.yieldFreshness(component.refineries[0].yields[0])).toBe('Relevé ancien');
    component.ngOnDestroy();
  });

  it('does not invent a date or an unrelated station image', () => {
    const component = create([{ space_station_name: 'ARC-L2', commodity_name: 'Gold', value: 0 }]);
    expect(component.refineries[0].imageUrl).toBeNull();
    expect(component.refineries[0].yields[0].sourceUpdatedAt).toBeNull();
    expect(component.yieldFreshness(component.refineries[0].yields[0])).toBe('Date source inconnue');
    component.ngOnDestroy();
  });
});
