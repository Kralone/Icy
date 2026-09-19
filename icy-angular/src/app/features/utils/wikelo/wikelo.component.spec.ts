import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { WikeloComponent } from './wikelo.component';
import { WikeloEquipment } from '../../../model/wikelo-equipment.model';
import { WikeloShip } from '../../../model/wikelo-ship.model';
import { Ship } from '../../../model/ship.model';

const offer = { id: 1, shipName: 'Prospector', costText: '2,500 × Ore | 4 × Token', componentsText: 'Laser amélioré' } as WikeloShip;

describe('Wikelo catalogue', () => {
  let component: WikeloComponent;
  let response = of({ data: [offer] });
  let profileRoles: string[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    response = of({ data: [offer] });
    profileRoles = [];
    component = new WikeloComponent(
      { getShips: () => response, getEquipment: () => of({data: []}) } as any,
      { getMyProfile: () => of({data: {roles: profileRoles}}), getAllUsers: () => of({data: []}) } as any,
      { getAllShips: () => of({data: []}) } as any, {} as any, { hasToken: () => true } as any,
      TestBed.inject(Router), TestBed.inject(ActivatedRoute), TestBed.inject(DestroyRef)
    );
    component.ships = [offer];
  });
  it('searches equipment without requiring French accents', () => {
    component.searchTerm = 'ameliore';
    expect(component.filteredShips).toEqual([offer]);
  });
  it('never substitutes specifications from a similarly named variant', () => {
    component.catalogShips = [{ name: 'Prospector Executive' } as Ship];
    expect(component.getCatalogShip('Prospector')).toBeNull();
    component.catalogShips.push({ name: 'Prospector', scu: 32 } as Ship);
    expect(component.getCatalogShip('prospector')?.scu).toBe(32);
  });
  it('shows the missing-image state instead of presenting the catalogue placeholder as a ship', () => {
    component.catalogShips = [{ name: 'Prospector', imageUrl: '/assets/images/catalog/catalog-fallback.svg' } as Ship];
    expect(component.getShipImage('Prospector')).toBeNull();
  });
  it('matches verified short names and the declared manufacturer prefix', () => {
    component.catalogShips = [
      { name: 'A2 Hercules Starlifter' }, { name: 'Ares Star Fighter Inferno' },
      { name: 'MISC Prospector', brand: { name: 'MISC' } },
      { name: 'MISC Starlancer MAX', brand: { name: 'MISC' } }, { name: 'Zeus Mk II CL' }
    ] as Ship[];
    expect(component.getCatalogShip('A2 Hercules')?.name).toBe('A2 Hercules Starlifter');
    expect(component.getCatalogShip('Ares Inferno')?.name).toBe('Ares Star Fighter Inferno');
    expect(component.getCatalogShip('Prospector')?.name).toBe('MISC Prospector');
    expect(component.getCatalogShip('Starlancer MAX')?.name).toBe('MISC Starlancer MAX');
    expect(component.getCatalogShip('Zeus CL')?.name).toBe('Zeus Mk II CL');
    expect(component.getCatalogShip('Zeus ES')).toBeNull();
    expect(component.getCatalogShip('Ares Ion')).toBeNull();
    expect(component.getCatalogShip('Starlancer TAC')).toBeNull();
  });
  it('resolves explicit Wikelo military and stealth aliases to their own variants', () => {
    component.catalogShips = [
      { name: 'F8C Lightning Wikelo War Special', imageUrl: '/war.webp' },
      { name: 'F8C Lightning Wikelo Sneak Special', imageUrl: '/sneak.webp' },
      { name: 'L-21 Wolf Wikelo War Special', imageUrl: '/wolf.webp' }
    ] as Ship[];
    expect(component.getShipImage('F8C Lightning Military')).toBe('/war.webp');
    expect(component.getShipImage('F8C Lightning Stealth')).toBe('/sneak.webp');
    expect(component.getShipImage('L-21 Wolf Military + Gear')).toBe('/wolf.webp');
    expect(component.getShipImage('L-21 Wolf Stealth')).toBeNull();
  });
  it('does not remove special-edition suffixes or guess ambiguous manufacturer matches', () => {
    component.catalogShips = [{ name: 'MISC Prospector Wikelo Work Special', brand: { name: 'MISC' } }] as Ship[];
    expect(component.getCatalogShip('Prospector')).toBeNull();
    component.catalogShips = [
      { name: 'MISC Prospector', brand: { name: 'MISC' } },
      { name: 'Other Prospector', brand: { name: 'Other' } }
    ] as Ship[];
    expect(component.getCatalogShip('Prospector')).toBeNull();
  });
  it('translates presentation and preserves confirmed zero capacity without mutating the catalogue', () => {
    const raw = { name: 'C1 Spirit', focus: 'MEDIUM FREIGHT / GUN SHIP', size: 'Medium', scu: 0 } as Ship;
    component.catalogShips = [raw];
    expect(component.getCatalogShip('C1 Spirit')).toEqual({ ...raw, focus: 'Transport de fret moyen / Canonnière', size: 'Moyen', scu: 0 });
    expect(raw.scu).toBe(0);
    expect(raw.focus).toBe('MEDIUM FREIGHT / GUN SHIP');
  });
  it('preserves commas in quantities from the unstructured source', () => {
    expect(component.ingredients(offer)).toEqual(['2,500 × Ore', '4 × Token']);
  });
  it('preserves explicit ingredient quantities when preparing goals', () => {
    component.selectedGoalShip = offer;
    expect(component.getGoalPreviewIngredients()).toEqual([{ name: 'Ore', target: 2500 }, { name: 'Token', target: 4 }]);
  });
  it('separates comma-delimited ingredients without splitting grouped numbers', () => {
    component.selectedGoalShip = { ...offer, costText: '1,250,000 x Ore, 2,500 × Token,4 x Part' };
    expect(component.ingredients(component.selectedGoalShip)).toEqual(['1,250,000 x Ore', '2,500 × Token', '4 x Part']);
    expect(component.getGoalPreviewIngredients()).toEqual([
      { name: 'Ore', target: 1250000 }, { name: 'Token', target: 2500 }, { name: 'Part', target: 4 }
    ]);
  });
  it('preserves commas in names and separates quantities after numbered names', () => {
    const source = { ...offer, costText: '2 × Module Mk2, 4 × Ore, refined | 5 × Token' };
    expect(component.ingredients(source)).toEqual(['2 × Module Mk2', '4 × Ore, refined', '5 × Token']);
  });
  it('keeps missing capacity distinct from zero and preserves the manufacturer logo', () => {
    const brand = { name: 'MISC', imageUrl: '/misc-logo.webp' };
    component.catalogShips = [{ name: 'Prospector', scu: null, brand } as Ship];
    expect(component.getCatalogShip('Prospector')?.scu).toBeNull();
    expect(component.getCatalogShip('Prospector')?.brand).toEqual(brand);
  });
  it('uses the visual placeholder after an image fails', () => {
    component.catalogShips = [{ name: 'Prospector', imageUrl: '/missing.png' } as Ship];
    component.imageFailed('/missing.png');
    expect(component.getShipImage('Prospector')).toBeNull();
  });
  it('distinguishes API failure from empty catalogue', () => {
    response = throwError(() => new Error('offline'));
    component.loadShips();
    expect(component.errorMessage).toContain('Impossible');
    expect(component.isLoading).toBe(false);
    response = of({ data: [] });
    component.loadShips();
    expect(component.errorMessage).toBe('');
    expect(component.ships).toEqual([]);
  });
  it('persists and clears the query in the shareable URL', async () => {
    component.setSearchTerm('Prospector');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(TestBed.inject(Router).url).toContain('q=Prospector');
    component.clearSearch();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(TestBed.inject(Router).url).not.toContain('q=');
  });
  it('separates ingredient quantities and component classifications for compact display', () => {
    const entry = {...offer, missionText: 'Mission: War Mod - Cost: 2x Ore', componentsText: 'Power Plant: 2x JS-500⭐ (Military A) | Shield: 3x FR-86⭐ (Military A)'};
    expect(component.ingredientDetails(entry)).toEqual([{name: 'Ore', quantity: '2,500 ×'}, {name: 'Token', quantity: '4 ×'}]);
    expect(component.equipmentDetails(entry)[0]).toEqual({name: 'JS-500', quantity: '2 ×', category: 'Centrale énergétique', grade: 'Militaire A'});
    expect(component.missionName(entry)).toBe('War Mod');
  });

  it('opens and closes cards but preserves nested buttons and links', () => {
    const card = document.createElement('article');
    card.className = 'offer';
    card.innerHTML = '<p>Ship</p><button><span>Details</span></button><a href="#">Source</a>';
    const eventFor = (target: Element) => { const event = new MouseEvent('click', {bubbles: true}); target.dispatchEvent(event); return event; };
    component.onCardClick(eventFor(card.querySelector('p')!), 'Prospector');
    expect(component.expandedShipName).toBe('Prospector');
    component.onCardClick(eventFor(card.querySelector('button span')!), 'Prospector');
    component.onCardClick(eventFor(card.querySelector('a')!), 'Prospector');
    expect(component.expandedShipName).toBe('Prospector');
    component.closeOnOutsideClick(eventFor(card.querySelector('p')!));
    expect(component.expandedShipName).toBe('Prospector');
    component.onCardClick(eventFor(card.querySelector('p')!), 'Prospector');
    expect(component.expandedShipName).toBeNull();
    component.expandedShipName = 'Prospector';
    component.closeOnOutsideClick(eventFor(document.createElement('div')));
    expect(component.expandedShipName).toBeNull();
  });

  it('limits Wikelo objective controls to administrators', () => {
    profileRoles = ['OFFICIER'];
    component.ngOnInit();
    expect(component.canCreateGoals).toBe(false);
    component.openGoalModal(offer);
    expect(component.isGoalModalOpen).toBe(false);
    profileRoles = ['ADMIN'];
    component.ngOnInit();
    expect(component.canCreateGoals).toBe(true);
    component.openGoalModal(offer);
    expect(component.isGoalModalOpen).toBe(true);
  });

  it('keeps equipment browsing separate and persists the view in the shared URL', async () => {
    component.setView('equipment');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(TestBed.inject(Router).url).toContain('view=weapons');
    expect(component.selectedView).toBe('weapons');
    expect(component.equipmentLoaded).toBe(true);
    expect(component.equipment).toEqual([]);
    expect(component.ships).toEqual([offer]);
  });

  it('closes expanded equipment with Escape without closing an active goal dialog', () => {
    component.expandedEquipmentId = 42;
    component.closeDetailsOnEscape();
    expect(component.expandedEquipmentId).toBeNull();
    component.expandedShipName = 'Prospector';
    component.isGoalModalOpen = true;
    component.closeDetailsOnEscape();
    expect(component.expandedShipName).toBe('Prospector');
  });

  it('keeps weapons and armor separate while searching recipe ingredients', () => {
    const armor = {id: 1, name: 'Ana Arms Endro', family: 'ARMOR', description: null,
      recipes: [{id: 'ana', name: 'Ana armor', reputation: 'None', sourceUrl: '', sourceVersion: null,
        ingredients: [{name: 'Carinite', quantity: '3 SCU'}], rewards: [{name: 'Ana Arms Endro', quantity: '1'}]}]} as WikeloEquipment;
    const weapon = {id: 2, name: 'Scourge', family: 'FPS_WEAPON'} as WikeloEquipment;
    component.equipment = [armor, weapon];
    component.selectedView = 'armor';
    component.searchTerm = 'Carinite';
    expect(component.filteredEquipment).toEqual([armor]);
    component.selectedView = 'weapons';
    expect(component.filteredEquipment).toEqual([]);
    component.searchTerm = '';
    expect(component.filteredEquipment).toEqual([weapon]);
  });

  it('places equipment with a current recipe before unavailable entries', () => {
    const available = {id: 3, name: 'Zeta Weapon', family: 'FPS_WEAPON', recipes: [{id: 'zeta', name: 'Zeta trade',
      reputation: null, sourceUrl: '', sourceVersion: '4.10', ingredients: [], rewards: []}]} as unknown as WikeloEquipment;
    const unavailable = {id: 4, name: 'Alpha Weapon', family: 'FPS_WEAPON'} as WikeloEquipment;
    component.equipment = [unavailable, available];
    component.selectedView = 'weapons';
    expect(component.filteredEquipment).toEqual([available, unavailable]);
  });

  it('extracts armor specifications without changing units or discarding descriptive prose', () => {
    const armor = {id: 1, family: 'ARMOR', manufacturer: null,
      description: "Type d'article : Armure Lourde\nRéduction des dégâts : 40%\nTempérature de fonctionnement : -95 / 120 °C\nProtection contre les radiations : 52800 REM\nNeutralisation des radiations : 251,1 REM/s\n\nCette armure comporte des crocs.\nDes os sont fixés à l’ensemble.\n\nCouleur : sombre."
    } as WikeloEquipment;
    const presentation = component.equipmentPresentation(armor);
    expect(presentation.characteristics.map(field => field.value)).toEqual(['Armure Lourde', '40%', '-95 / 120 °C', '52800 REM', '251,1 REM/s']);
    expect(presentation.paragraphs).toEqual(['Cette armure comporte des crocs. Des os sont fixés à l’ensemble.', 'Couleur : sombre.']);
  });

  it('does not repeat a known manufacturer and retains one found only in the description', () => {
    const weapon = {description: 'Fabricant : Behring\nCapacité  du chargeur : 6\nPortée effective : 80 m', manufacturer: 'Behring'} as WikeloEquipment;
    expect(component.equipmentPresentation(weapon).characteristics.map(field => field.label)).toEqual(['Chargeur', 'Portée effective']);
    weapon.manufacturer = null;
    expect(component.equipmentPresentation(weapon).characteristics[0]).toEqual({label: 'Fabricant', value: 'Behring', tone: 'general'});
  });

  it('translates a None reputation without inventing an absent requirement', () => {
    expect(component.equipmentReputation('None')).toBe('Aucune');
    expect(component.equipmentReputation(null)).toBeNull();
    expect(component.equipmentReputation(' 900 ')).toBe('900');
  });

});
