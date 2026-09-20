import { Observable, of, throwError } from 'rxjs';
import { Ship } from '../../../model/ship.model';
import { ExecutiveHangarShipsComponent, isExecutiveHangarShip } from './executive-hangar-ships.component';

const exec = {
  id: 74, name: 'Hornet F7A Mk II PYAM Exec', brand: {name: 'Anvil Aerospace'},
  imageUrl: '/assets/images/catalog/catalog-fallback.svg', scu: null, notes: 'Variante exclusive.'
} as unknown as Ship;
const standard = {id: 75, name: 'F7A Hornet Mk II', imageUrl: '/standard.png', scu: 16} as Ship;

describe('Executive hangar ships', () => {
  it('includes rewards shared with Wikelo using the collected hangar membership', () => {
    expect(isExecutiveHangarShip({...standard, name: 'Guardian MX Wikelo War Special', catalogGroup: 'WIKELO', executiveHangar: true})).toBe(true);
    expect(isExecutiveHangarShip({...standard, name: 'Scorpius Wikelo Sneak Special', catalogGroup: 'WIKELO', executiveHangar: true})).toBe(true);
    expect(isExecutiveHangarShip({...exec, executiveHangar: false})).toBe(false);
  });
  it('includes only the explicit PYAM variant, not generic Executive or Wikelo editions', () => {
    expect(isExecutiveHangarShip(exec)).toBe(true);
    expect(isExecutiveHangarShip({...exec, name: 'Syulen PYAM   Exec '})).toBe(true);
    expect(isExecutiveHangarShip(standard)).toBe(false);
    expect(isExecutiveHangarShip({...exec, name: 'F8C Lightning Executive Edition'})).toBe(false);
    expect(isExecutiveHangarShip({...exec, name: 'F8C Lightning Wikelo Special'})).toBe(false);
    expect(isExecutiveHangarShip({...exec, name: 'F8C Lightning PYAM Exec Prototype'})).toBe(false);
  });

  it('uses explicit catalogue grouping when provided rather than overriding it from the name', () => {
    expect(isExecutiveHangarShip({...standard, catalogGroup: 'PYAM_EXEC'})).toBe(true);
    expect(isExecutiveHangarShip({...exec, catalogGroup: 'STANDARD'})).toBe(false);
    expect(isExecutiveHangarShip({...exec, catalogGroup: 'BATTAGLIA'})).toBe(false);
  });

  it('retains the exact variant data without borrowing standard images or statistics', () => {
    const component = new ExecutiveHangarShipsComponent({getAllShips: () => of({data: [standard, exec]})} as any);
    component.loadShips();
    expect(component.ships).toEqual([exec]);
    expect(component.ships[0].scu).toBeNull();
    expect(component.imageFor(component.ships[0])).toBeNull();
    expect(component.isLoading).toBe(false);
  });

  it('searches the published ships by name or manufacturer and distinguishes no results', () => {
    const component = new ExecutiveHangarShipsComponent({} as any);
    component.ships = [exec];
    component.searchTerm = 'anvil';
    expect(component.filteredShips).toEqual([exec]);
    component.searchTerm = 'Corsair';
    expect(component.filteredShips).toEqual([]);
    expect(component.ships.length).toBe(1);
  });

  it('separates a loading failure from a genuinely empty published list', () => {
    let response: Observable<{data: Ship[]}> = throwError(() => new Error('offline'));
    const component = new ExecutiveHangarShipsComponent({getAllShips: () => response} as any);
    component.loadShips();
    expect(component.errorMessage).toContain('Impossible');
    expect(component.isLoading).toBe(false);
    response = of({data: [standard]});
    component.loadShips();
    expect(component.errorMessage).toBe('');
    expect(component.ships).toEqual([]);
  });

  it('uses a placeholder if the exact variant image fails', () => {
    const component = new ExecutiveHangarShipsComponent({} as any);
    const variant = {...exec, imageUrl: '/exec.png'};
    expect(component.imageFor(variant)).toBe('/exec.png');
    component.imageFailed('/exec.png');
    expect(component.imageFor(variant)).toBeNull();
  });
});
