import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Ship } from '../../model/ship.model';
import { ShipSelectorComponent } from './ship-selector.component';
import { SimpleChange } from '@angular/core';

const ship = (id: number, name: string, catalogGroup?: Ship['catalogGroup']): Ship => ({
  id,
  name,
  catalogGroup,
  brand: { name: 'Anvil Aerospace' },
  imageUrl: '',
  focus: 'Combat',
  crew: '1'
});

describe('ShipSelectorComponent catalog groups', () => {
  it('updates the search results when the horizontal group selection changes', () => {
    const shipService = {
      getAllBrandsWithImages: vi.fn(() => of({ data: [] }))
    };
    const component = new ShipSelectorComponent(shipService as never);
    component.showCatalogGroups = true;
    component.allShipsModal = [
      ship(1, 'F7C Hornet Mk II'),
      ship(2, 'F7 Hornet Mk Wikelo'),
      ship(3, 'Constellation Phoenix PYAM Exec'),
      ship(4, 'Terrapin Alliance')
    ];

    component.selectCatalogGroup('WIKELO');
    expect(component.filteredShipsSearch.map((item) => item.id)).toEqual([2]);
    expect(component.selectedShip?.id).toBe(2);

    component.selectCatalogGroup('PYAM_EXEC');
    expect(component.filteredShipsSearch.map((item) => item.id)).toEqual([3]);

    component.selectCatalogGroup('BATTAGLIA');
    expect(component.filteredShipsSearch.map((item) => item.id)).toEqual([4]);
  });

  it('uses the catalog group supplied by the API before the name fallback', () => {
    const shipService = {
      getAllBrandsWithImages: vi.fn(() => of({ data: [] }))
    };
    const component = new ShipSelectorComponent(shipService as never);
    component.showCatalogGroups = true;
    component.allShipsModal = [ship(5, 'Special Prototype', 'WIKELO')];

    component.selectCatalogGroup('WIKELO');

    expect(component.filteredShipsSearch.map((item) => item.id)).toEqual([5]);
    expect(component.selectedShip?.id).toBe(5);
  });

  it('resets the form and selects the first standard ship whenever it opens', () => {
    const shipService = {
      getAllBrandsWithImages: vi.fn(() => of({ data: [] }))
    };
    const component = new ShipSelectorComponent(shipService as never);
    component.showCatalogGroups = true;
    component.allShipsModal = [
      ship(2, 'F7 Hornet Mk Wikelo'),
      ship(1, 'F7C Hornet Mk II')
    ];
    (component as any).allShipsLoaded = true;
    component.acquisitionType = 'loaner';
    component.shipSearchQuery = 'hornet';
    component.selectedCatalogGroup = 'WIKELO';
    component.selectedShip = component.allShipsModal[0];

    component.ngOnChanges({ isOpen: new SimpleChange(false, true, false) });

    expect(component.acquisitionType).toBe('rsi');
    expect(component.shipSearchQuery).toBe('');
    expect(component.selectedCatalogGroup).toBe('STANDARD');
    expect(component.selectedShip?.id).toBe(1);
  });
});
