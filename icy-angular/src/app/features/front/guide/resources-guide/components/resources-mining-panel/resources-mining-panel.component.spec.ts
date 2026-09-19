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
});
