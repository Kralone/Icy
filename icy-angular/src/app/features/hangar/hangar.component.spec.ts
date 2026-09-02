import { ElementRef } from '@angular/core';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HangarComponent } from './hangar.component';
import { ShipListDTO } from '../../model/ShipListDTO.model';

const ship = (shipId: number, name: string): ShipListDTO => ({
  shipId,
  name,
  brand: 'Validation Aerospace',
  imageUrl: '',
  focus: 'Exploration',
  crew: '1',
  inGamePurchase: false,
  rewardInGame: false,
  loaner: false
});

describe('HangarComponent WebSocket updates', () => {
  it('keeps one ship when the same ADD update is delivered twice', () => {
    const updates = new Subject<string>();
    const shipService = {
      getAllBrandsWithImages: vi.fn(() => of({ data: [] })),
      listenForUserShips: vi.fn(() => updates.asObservable())
    };
    const wsService = {
      connectShipUpdate: vi.fn(),
      disconnectShipUpdate: vi.fn()
    };
    const authService = { getUserIdFromToken: vi.fn(() => 'user-1') };
    const component = new HangarComponent(
      shipService as never,
      wsService as never,
      new ElementRef(document.createElement('div')),
      { error: vi.fn() } as never,
      authService as never
    );

    component.ngOnInit();
    updates.next(JSON.stringify([ship(1, 'Scout'), ship(1, 'Scout')]));
    updates.next(JSON.stringify({ type: 'ADD', ship: ship(2, 'Hauler') }));
    updates.next(JSON.stringify({ type: 'ADD', ship: ship(2, 'Hauler') }));

    expect(component.ships.map(item => item.shipId)).toEqual([1, 2]);
    expect(component.filteredShips.map(item => item.shipId)).toEqual([2, 1]);

    component.ngOnDestroy();
    expect(wsService.disconnectShipUpdate).toHaveBeenCalledWith('user-1');
  });
});
