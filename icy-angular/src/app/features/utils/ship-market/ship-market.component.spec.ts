import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { of, Subject, throwError, firstValueFrom, filter, take } from 'rxjs';

import { CelestialBodyService } from '../../../core/services/celestial/celestial-body.service';
import { OrbitalStationService } from '../../../core/services/station/orbital-station.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { UexDatasetService, UexVehiclePurchase, UexVehicleRental } from '../../../core/services/uex/uex-dataset.service';
import { Ship } from '../../../model/ship.model';
import { ShipMarketComponent } from './ship-market.component';

describe('ShipMarketComponent', () => {
  let fixture: ComponentFixture<ShipMarketComponent>;
  let component: ShipMarketComponent;

  const ship: Ship = {
    id: 42,
    name: 'C1 Spirit',
    brand: { name: 'Crusader Industries' },
    imageUrl: '/c1.webp',
    focus: 'Transport',
    crew: '1-2',
    size: 'Medium',
    scu: 64
  };
  const prospector: Ship = {
    id: 43,
    name: 'MISC Prospector',
    brand: { name: 'MISC' },
    imageUrl: '/prospector.webp',
    focus: 'Minage',
    crew: '1',
    size: 'Small',
    scu: 32
  };

  const uexDatasetService = {
    listVehiclePurchases: vi.fn(() => of({
      data: [
        { vehicleName: 'C1 Spirit', terminalName: 'Crusader Showroom - Orison', terminalId: '1', planetName: 'Crusader', locationName: 'Orison', systemName: 'Stanton', buyPrice: 3_118_500 },
        { vehicleName: '', terminalName: 'Invalid name', buyPrice: 10 },
        { vehicleName: 'Bad location', terminalName: '', buyPrice: 10 },
        { vehicleName: 'Bad price', terminalName: 'Orison', buyPrice: 0 }
      ]
    })),
    listVehicleRentals: vi.fn(() => of({
      data: [
        { vehicleName: 'Prospector', terminalName: 'Traveler Rentals - Orison', terminalId: '2', planetName: 'Crusader', locationName: 'Orison', systemName: 'Stanton', rentPrice: 62_370 },
        { vehicleName: 'Unknown catalog ship', terminalName: 'Orison', rentPrice: 1_000 },
        { vehicleName: 'Bad rental', terminalName: 'Orison', rentPrice: -1 }
      ]
    })),
    listVehicleTerminals: vi.fn(() => of({ data: [] }))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ShipMarketComponent],
      providers: [
        provideRouter([]),
        { provide: ShipService, useValue: {
          getAllShips: vi.fn(() => of({ data: [ship, prospector] })),
          getAllBrandsWithImages: vi.fn(() => of({ data: [] }))
        } },
        { provide: UexDatasetService, useValue: uexDatasetService },
        { provide: CelestialBodyService, useValue: { listFrontBodies: vi.fn(() => of({ data: [] })), listFrontLocationImages: vi.fn(() => of({ data: [] })) } },
        { provide: OrbitalStationService, useValue: { listFrontStations: vi.fn(() => of({ data: [] })) } }
      ]
    }).compileComponents();

    // Unit tests below exercise local filtering without starting real navigation.
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ShipMarketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('combines manufacturer, gameplay and search across offers and their locations', () => {
    component.selectedManufacturer = 'MISC';
    component.toggleGameplay('mining');
    expect(component.majorLocationCards).toHaveLength(0);
    expect(component.selectedLocationShips).toHaveLength(0);
    component.setOfferMode('LOCATION');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([43]);
    expect(component.majorLocationCards.map(row => row.majorLabel)).toEqual(['Crusader']);
    component.searchTerm = 'MicroTech';
    component.onSearchTermChange();
    expect(component.majorLocationCards).toHaveLength(0);
    component.resetFilters();
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([43]);
    expect(component.selectedManufacturer).toBe('');
    expect(component.selectedGameplays).toEqual([]);
  });

  it('accepts any checked gameplay while preserving the manufacturer constraint', () => {
    component.toggleGameplay('transport');
    component.toggleGameplay('mining');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([42]);
    component.setOfferMode('LOCATION');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([43]);
    component.selectedManufacturer = 'Crusader Industries';
    component.onSearchTermChange();
    expect(component.selectedLocationShips).toHaveLength(0);
  });

  it('removes imported identity labels from prose but keeps descriptive paragraphs', () => {
    expect(component.shipDescription({ ...ship, notes: 'Fabricant : Argo Astronautics\nFocus: Cargo\n\nUne soute supplémentaire.\n\nDimensions utiles : 20 mètres.' }))
      .toBe('Une soute supplémentaire.\n\nDimensions utiles : 20 mètres.');
    expect(component.roleLabel('CARGO / MEDICAL')).toBe('Transport de fret / Médical');
  });

  it('keeps purchase and rental modes separate and excludes invalid offers', () => {
    const allOffers = Object.values(component.groupedShips).flat();

    expect(uexDatasetService.listVehiclePurchases).toHaveBeenCalledOnce();
    expect(uexDatasetService.listVehicleRentals).toHaveBeenCalledOnce();
    expect(uexDatasetService.listVehicleTerminals).not.toHaveBeenCalled();
    expect(allOffers).toHaveLength(2);
    expect(allOffers.map((offer) => offer.offerType).sort()).toEqual(['ACHAT', 'LOCATION']);
    expect(allOffers.every((offer) => offer.ship.name && offer.location && offer.price > 0)).toBe(true);

    expect(component.selectedOfferMode).toBe('ACHAT');
    expect(component.selectedLocationShips).toHaveLength(1);
    expect(component.selectedLocationShips[0].offerType).toBe('ACHAT');

    component.setOfferMode('LOCATION');

    expect(component.selectedLocationShips).toHaveLength(1);
    expect(component.selectedLocationShips[0].offerType).toBe('LOCATION');
    expect(component.selectedLocationShips[0].ship).toEqual(prospector);
  });

  it('opens an accessible details dialog and closes it with Escape', () => {
    const card = fixture.nativeElement.querySelector('.ship-market-card') as HTMLElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('C1 Spirit');
    expect(dialog.textContent).toContain('Crusader Industries');
    expect(dialog.textContent).toContain('Prix d’achat');
    expect(dialog.querySelector('.ship-market-offer-badge')).toBeNull();
    expect(dialog.textContent).not.toContain('Type d’offre');
    expect(dialog.textContent).toContain('3,118,500 aUEC');
    expect(dialog.textContent).toContain('Crusader Showroom - Orison');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.selectedShipOffer).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows supplied ship details without inventing missing cargo capacity', () => {
    component.openShipDetails({ ...component.selectedLocationShips[0], ship: {
      ...ship, scu: undefined, oreCapacity: 32, notes: 'Deux accès à la soute.', flightReady: false,
      cargoGrids: [{sizeX: 4, sizeY: 8, sizeZ: 2}]
    }});
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Deux accès à la soute.');
    expect(dialog.textContent).toContain('En développement');
    expect(dialog.textContent).toContain('4 × 8 × 2');
    expect(dialog.textContent).not.toContain('0 SCU');
    expect(dialog.textContent).toContain('Non renseignée');
    expect(dialog.textContent).toContain('Stockage de minerai32 SCU');
  });

  it('shows a confirmed zero cargo capacity in cards and details', () => {
    const offer = { ...component.selectedLocationShips[0], ship: { ...ship, scu: 0 } };
    component.selectedLocationShips = [offer];
    component.openShipDetails(offer);
    fixture.detectChanges();
    const capacity = fixture.nativeElement.querySelector('.ship-market-stats') as HTMLElement;
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(capacity.textContent).toContain('SCU0');
    expect(dialog.textContent).toContain('0 SCU');
    offer.ship.scu = null as any;
    fixture.detectChanges();
    expect(capacity.textContent).toContain('Non renseignée');
    expect(dialog.textContent).not.toContain('0 SCU');
  });
  function reload(purchases: UexVehiclePurchase[], rentals: UexVehicleRental[] = []): void {
    uexDatasetService.listVehiclePurchases.mockReturnValueOnce(of({data: purchases}) as any);
    uexDatasetService.listVehicleRentals.mockReturnValueOnce(of({data: rentals}) as any);
    component.ngOnInit();
    fixture.detectChanges();
  }

  it('builds planet then place navigation from structured location fields', () => {
    reload([
      {vehicleName: ship.name, terminalName: 'Astro Armada', terminalId: '10', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Stanton', buyPrice: 100},
      {vehicleName: ship.name, terminalName: 'Checkmate', terminalId: '11', planetName: 'Monox', locationName: 'Checkmate Station', systemName: 'Pyro', buyPrice: 110},
      {vehicleName: ship.name, terminalName: 'Orbituary', terminalId: '12', planetName: 'Bloom', locationName: 'Orbituary', systemName: 'Pyro', buyPrice: 120},
      {vehicleName: ship.name, terminalName: 'Ruin Station', terminalId: '13', planetName: 'Terminus', locationName: 'Ruin Station', systemName: 'Pyro', buyPrice: 130}
    ]);
    expect(component.majorLocationCards.map(card => card.majorLabel)).toEqual(['ArcCorp', 'Bloom', 'Monox', 'Terminus']);
    expect(component.subLocationCards[0].titleLine).toBe('Area 18');
    expect(component.selectedLocationShips[0].location).toBe('Astro Armada');
  });

  it('names the moon of a place under its planet and finds it by search', () => {
    reload([
      {vehicleName: ship.name, terminalName: 'Shubin Rentals', terminalId: '50', planetName: 'Crusader', moonName: 'Daymar', locationName: 'Shubin Mining SCD-1', systemName: 'Stanton', buyPrice: 100},
      {vehicleName: prospector.name, terminalName: 'Seraphim', terminalId: '51', planetName: 'Crusader', moonName: null, locationName: 'Seraphim Station', systemName: 'Stanton', buyPrice: 200}
    ]);
    expect(component.majorLocationCards.map(card => card.majorLabel)).toEqual(['Crusader']);
    const cards = component.subLocationCards;
    expect(cards.find(card => card.titleLine === 'Shubin Mining SCD-1')!.bodyLine2).toBe('Daymar');
    expect(cards.find(card => card.titleLine === 'Seraphim Station')!.bodyLine2).toBe('');
    component.searchTerm = 'daymar';
    component.onSearchTermChange();
    expect(component.subLocationCards.map(card => card.titleLine)).toEqual(['Shubin Mining SCD-1']);
  });

  it('keeps unassigned locations outside planets without inferring one from a terminal name', () => {
    reload([
      {vehicleName: ship.name, terminalName: "Teach's Levski", terminalId: '20', planetName: null, locationName: 'Levski', systemName: 'Nyx', buyPrice: 100},
      {vehicleName: ship.name, terminalName: 'Crusader Showroom - Orison', terminalId: '21', buyPrice: 100}
    ]);
    expect(component.majorLocationCards.every(card => card.majorLabel === 'Lieux hors planète')).toBe(true);
    expect(component.majorLocationCards.map(card => card.systemName).sort()).toEqual(['', 'Nyx']);
    expect(component.filteredLocationCards.some(card => card.titleLine === 'Levski')).toBe(true);
  });

  it('groups vendors at the same place and keeps identical place names in different systems separate', () => {
    reload([
      {vehicleName: ship.name, terminalName: 'Vendor A', terminalId: '30', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Stanton', buyPrice: 100},
      {vehicleName: ship.name, terminalName: 'Vendor B', terminalId: '31', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Stanton', buyPrice: 120},
      {vehicleName: ship.name, terminalName: 'Vendor A', terminalId: '32', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Other system', buyPrice: 140}
    ]);
    expect(component.majorLocationCards).toHaveLength(2);
    const stanton = component.majorLocationCards.find(card => card.systemName === 'Stanton')!;
    expect(stanton.cards).toHaveLength(1);
    expect(stanton.count).toBe(2);
    component.selectedMajorKey = stanton.majorKey;
    component.onSearchTermChange();
    expect(component.selectedLocationShips.map(offer => offer.location)).toEqual(['Vendor A', 'Vendor B']);
    expect(new Set(component.selectedLocationShips.map((offer, index) => component.trackByShip(index, offer))).size).toBe(2);
  });

  it('filters planets, places and ships together and keeps rental-only planets out of purchase mode', () => {
    reload([
      {vehicleName: ship.name, terminalName: 'Dealer', terminalId: '40', planetName: 'Monox', locationName: 'Checkmate Station', systemName: 'Pyro', buyPrice: 100},
      {vehicleName: prospector.name, terminalName: 'New Deal', terminalId: '41', planetName: 'Hurston', locationName: 'Lorville', systemName: 'Stanton', buyPrice: 200}
    ], [{vehicleName: ship.name, terminalName: 'Rentals', terminalId: '42', planetName: 'microTech', locationName: 'New Babbage', systemName: 'Stanton', rentPrice: 50}]);
    expect(component.majorLocationCards.map(card => card.majorLabel)).not.toContain('microTech');
    for (const query of ['Monox', 'Checkmate', 'Pyro']) {
      component.searchTerm = query;
      component.onSearchTermChange();
      expect(component.majorLocationCards.map(card => card.majorLabel)).toEqual(['Monox']);
      expect(component.selectedLocationShips[0].ship.name).toBe(ship.name);
    }
    component.searchTerm = 'Prospector';
    component.onSearchTermChange();
    expect(component.majorLocationCards.map(card => card.majorLabel)).toEqual(['Hurston']);
    component.searchTerm = '';
    component.setOfferMode('LOCATION');
    expect(component.majorLocationCards.map(card => card.majorLabel)).toEqual(['microTech']);
  });

  it('prioritizes catalog city and planet images regardless of source completion order', () => {
    const bodies = new Subject<any>();
    const stations = new Subject<any>();
    const catalog = new Subject<any>();
    vi.mocked(TestBed.inject(CelestialBodyService).listFrontBodies).mockReturnValueOnce(bodies);
    vi.mocked(TestBed.inject(OrbitalStationService).listFrontStations).mockReturnValueOnce(stations);
    vi.mocked(TestBed.inject(CelestialBodyService).listFrontLocationImages).mockReturnValueOnce(catalog);
    reload([{vehicleName: ship.name, terminalName: 'Astro Armada', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Stanton', buyPrice: 100}]);
    catalog.next({data: [
      {name: 'Area18', systemName: 'Stanton', family: 'CITY', imageUrl: '/area18.webp'},
      {name: 'ArcCorp', systemName: 'Stanton', family: 'PLANET', imageUrl: '/arccorp.webp'},
      {name: 'Area18', systemName: 'Pyro', family: 'LOCATION', imageUrl: '/other-system.webp'}
    ]});
    catalog.complete();
    stations.next({data: [{name: 'Area 18', systemName: 'Stanton', imageUrl: '/old-place.webp'}]});
    stations.complete();
    bodies.next({data: [{name: 'ArcCorp', systemName: 'Stanton', bodyType: 'PLANET', imageUrl: '/old-planet.webp'}]});
    bodies.complete();
    expect(component.subLocationCards[0].imageUrl).toBe('/area18.webp');
    expect(component.subLocationCards[0].majorImageUrl).toBe('/arccorp.webp');
  });

  it('retains station and planet fallback images when the catalog image endpoint fails', () => {
    vi.mocked(TestBed.inject(CelestialBodyService).listFrontLocationImages).mockReturnValueOnce(throwError(() => new Error('Unavailable')));
    vi.mocked(TestBed.inject(CelestialBodyService).listFrontBodies).mockReturnValueOnce(of({data: [{name: 'Crusader', systemName: 'Stanton', bodyType: 'PLANET', imageUrl: '/crusader.webp'}]} as any));
    vi.mocked(TestBed.inject(OrbitalStationService).listFrontStations).mockReturnValueOnce(of({data: [{name: 'Orison', systemName: 'Stanton', imageUrl: '/orison.webp'}]} as any));
    reload([{vehicleName: ship.name, terminalName: 'Showroom', planetName: 'Crusader', locationName: 'Orison', systemName: 'Stanton', buyPrice: 100}]);
    expect(component.subLocationCards[0].imageUrl).toBe('/orison.webp');
    expect(component.subLocationCards[0].majorImageUrl).toBe('/crusader.webp');
    expect(component.selectedLocationShips).toHaveLength(1);
  });


  it('moves focus into the details dialog and returns it to the originating card', async () => {
    const card = fixture.nativeElement.querySelector('.ship-market-card') as HTMLElement;
    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.ship-market-details-close'));
    component.closeShipDetails();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(card);
  });
});

describe('Ship market shareable filters', () => {
  let harness: RouterTestingHarness;
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const ships: Ship[] = [
    {id: 1, name: 'Prospector', imageUrl: '', brand: {name: 'MISC'}, focus: 'Mining', crew: '1', size: 'Small', scu: 0},
    {id: 2, name: 'C1 Spirit', imageUrl: '', brand: {name: 'Crusader'}, focus: 'Cargo', crew: '2', size: 'Medium', scu: 64},
  ];
  beforeEach(async () => {
    await TestBed.configureTestingModule({providers: [
      provideRouter([{path: 'market', component: ShipMarketComponent}]), provideLocationMocks(),
      {provide: ShipService, useValue: {getAllShips: () => of({data: ships}), getAllBrandsWithImages: () => of({data: []})}},
      {provide: UexDatasetService, useValue: {
        listVehiclePurchases: () => of({data: [{vehicleName: 'C1 Spirit', terminalName: 'New Deal', planetName: 'Hurston', locationName: 'Lorville', systemName: 'Stanton', buyPrice: 100}]}),
        listVehicleRentals: () => of({data: [{vehicleName: 'Prospector', terminalName: 'Rentals', planetName: 'ArcCorp', locationName: 'Area 18', systemName: 'Stanton', rentPrice: 50}]}),
      }},
      {provide: CelestialBodyService, useValue: {listFrontBodies: () => of({data: []}), listFrontLocationImages: () => of({data: []})}},
      {provide: OrbitalStationService, useValue: {listFrontStations: () => of({data: []})}},
    ]}).compileComponents();
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('restores combined URL filters after the catalog loads and discards unknown values', async () => {
    const component = await harness.navigateByUrl('/market?q=Prospector&manufacturer=MISC&gameplay=mining,unknown,mining&mode=location', ShipMarketComponent);
    expect(component.selectedManufacturer).toBe('MISC');
    expect(component.selectedGameplays).toEqual(['mining']);
    expect(component.selectedOfferMode).toBe('LOCATION');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([1]);
    expect(component.subLocationCards[0].titleLine).toBe('Area 18');
    await harness.navigateByUrl('/market?manufacturer=INVALID&gameplay=invalid&mode=INVALID&planet=invalid&location=invalid', ShipMarketComponent);
    expect(component.selectedManufacturer).toBe('');
    expect(component.selectedGameplays).toEqual([]);
    expect(component.selectedOfferMode).toBe('ACHAT');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([2]);
  });

  it('restores previous and next filter states on browser history navigation', async () => {
    const component = await harness.navigateByUrl('/market?q=Spirit&manufacturer=Crusader', ShipMarketComponent);
    await harness.navigateByUrl('/market?mode=location&manufacturer=MISC&gameplay=mining', ShipMarketComponent);
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    // The harness uses imperative navigation without bootstrapping the app listener.
    router.setUpLocationChangeListener();
    let navigation = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    location.back();
    await navigation;
    expect(component.searchTerm).toBe('Spirit');
    expect(component.selectedOfferMode).toBe('ACHAT');
    expect(component.selectedManufacturer).toBe('Crusader');
    expect(component.selectedLocationShips[0].ship.id).toBe(2);
    navigation = firstValueFrom(router.events.pipe(filter(event => event instanceof NavigationEnd), take(1)));
    location.forward();
    await navigation;
    expect(component.selectedOfferMode).toBe('LOCATION');
    expect(component.selectedGameplays).toEqual(['mining']);
    expect(component.selectedLocationShips[0].ship.id).toBe(1);
  });

  it('copies current filters and the selected location without waiting for debounced search', async () => {
    const component = await harness.navigateByUrl('/market?mode=location', ShipMarketComponent);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
    component.searchTerm = 'Prospector';
    component.onSearchTermChange(true);
    component.selectedManufacturer = 'MISC';
    component.selectedGameplays = ['mining'];
    await component.copySearchLink();
    const link = new URL(writeText.mock.calls[0][0]);
    expect(link.searchParams.get('q')).toBe('Prospector');
    expect(link.searchParams.get('manufacturer')).toBe('MISC');
    expect(link.searchParams.get('gameplay')).toBe('mining');
    expect(link.searchParams.get('mode')).toBe('location');
    expect(link.searchParams.get('planet')).toBe(component.selectedMajorKey);
    expect(link.searchParams.get('location')).toBe(component.selectedLocation);
    expect(component.shareMessage).toBe('Lien copié.');
    component.ngOnDestroy();
  });

  it('provides a selectable link when clipboard access fails', async () => {
    const component = await harness.navigateByUrl('/market', ShipMarketComponent);
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: vi.fn().mockRejectedValue(new Error('denied'))}});
    await component.copySearchLink();
    harness.detectChanges();
    const input = harness.routeNativeElement?.querySelector('.share-search input') as HTMLInputElement;
    expect(component.shareFailed).toBe(true);
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(component.shareUrl);
    expect(component.shareMessage).not.toBe('Lien copié.');
  });

  it('does not replay an older URL over a newer checkbox or pending search', async () => {
    const component = await harness.navigateByUrl('/market?mode=location', ShipMarketComponent);
    const router = TestBed.inject(Router);
    const searchNavigation = firstValueFrom(router.events.pipe(
      filter(event => event instanceof NavigationEnd && router.parseUrl(event.urlAfterRedirects).queryParams['q'] === 'Prospector'),
      take(1),
    ));
    component.selectedManufacturer = 'MISC';
    component.onSearchTermChange();
    component.toggleGameplay('mining');
    component.searchTerm = 'Prospector';
    component.onSearchTermChange(true);
    await searchNavigation;
    await harness.fixture.whenStable();
    expect(component.selectedManufacturer).toBe('MISC');
    expect(component.selectedGameplays).toEqual(['mining']);
    expect(component.searchTerm).toBe('Prospector');
    expect(component.selectedLocationShips.map(row => row.ship.id)).toEqual([1]);
    const url = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url);
    expect(url.queryParams['gameplay']).toBe('mining');
    expect(url.queryParams['q']).toBe('Prospector');
  });
});
