import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {CatalogBrowserComponent} from './catalog-browser.component';
import {CatalogEntry, CatalogOffer, CatalogService} from '../../../core/services/catalog/catalog.service';

describe('CatalogBrowserComponent scroll lock', () => {
  it('loads direct family and group links and responds to another shortcut', async () => {
    const params = new BehaviorSubject(convertToParamMap({family: 'SHIP', catalogGroup: 'WIKELO'}));
    const browse = vi.fn(() => of({data: null}));
    await TestBed.configureTestingModule({
      imports: [CatalogBrowserComponent],
      providers: [provideRouter([]),
        {provide: ActivatedRoute, useValue: {queryParamMap: params}},
        {provide: CatalogService, useValue: {browse, canCorrect: () => of(false)}}]
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogBrowserComponent);
    fixture.componentInstance.ngOnInit();
    expect(browse).toHaveBeenLastCalledWith(expect.objectContaining({family: 'SHIP', catalogGroup: 'WIKELO'}));
    params.next(convertToParamMap({family: 'MOON'}));
    expect(browse).toHaveBeenLastCalledWith(expect.objectContaining({family: 'MOON', catalogGroup: 'STANDARD'}));
    params.next(convertToParamMap({family: 'INVALID', catalogGroup: 'INVALID'}));
    expect(browse).toHaveBeenLastCalledWith(expect.objectContaining({family: '', catalogGroup: 'ALL'}));
    fixture.destroy();
  });

  it('restores the initial body overflow on close and destruction', async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogBrowserComponent],
      providers: [provideRouter([]), {provide: CatalogService, useValue: {}}]
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogBrowserComponent);
    const original = document.body.style.overflow;
    try {
      document.body.style.overflow = 'auto';
      fixture.componentInstance.openDetails({id: 1} as CatalogEntry);
      fixture.componentInstance.openDetails({id: 2} as CatalogEntry);
      expect(document.body.style.overflow).toBe('hidden');
      fixture.componentInstance.closeDetails();
      expect(document.body.style.overflow).toBe('auto');
      fixture.componentInstance.openDetails({id: 1} as CatalogEntry);
      fixture.destroy();
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      document.body.style.overflow = original;
    }
  });
});

describe('CatalogBrowserComponent offer places', () => {
  it('shows planet then place, and keeps unresolved terminals unlabelled', async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogBrowserComponent],
      providers: [provideRouter([]), {provide: CatalogService, useValue: {}}]
    }).compileComponents();
    const component = TestBed.createComponent(CatalogBrowserComponent).componentInstance;
    const offer = (place: Partial<CatalogOffer>) => ({location: 'Terminal', ...place} as CatalogOffer);
    expect(component.offerPlace(offer({systemName: 'Stanton', planetName: 'Hurston', placeName: 'Lorville'}))).toBe('Hurston → Lorville');
    expect(component.offerPlace(offer({systemName: 'Stanton', planetName: null, placeName: 'ARC-L1 Wide Forest Station'})))
      .toBe('Stanton → ARC-L1 Wide Forest Station');
    expect(component.offerPlace(offer({systemName: 'Stanton', planetName: 'Crusader', moonName: 'Daymar', placeName: 'Shubin Mining SCD-1'})))
      .toBe('Crusader → Daymar → Shubin Mining SCD-1');
    expect(component.offerPlace(offer({systemName: 'Stanton', planetName: 'Crusader', moonName: 'Daymar', placeName: 'Daymar'})))
      .toBe('Crusader → Daymar');
    expect(component.offerPlace(offer({systemName: 'Stanton', planetName: 'Hurston', placeName: null}))).toBeNull();
    expect(component.offerPlace(offer({}))).toBeNull();
  });
});

describe('CatalogBrowserComponent prices', () => {
  it('shows the cheapest purchase and the best resale of a commodity', async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogBrowserComponent],
      providers: [provideRouter([]), {provide: CatalogService, useValue: {}}]
    }).compileComponents();
    const component = TestBed.createComponent(CatalogBrowserComponent).componentInstance;
    const offer = (type: string, price: number) => ({type, price, currency: 'aUEC', location: type + price} as CatalogOffer);
    const entry = {offers: [offer('SELL', 30), offer('BUY', 12), offer('SELL', 41), offer('BUY', 9), offer('SELL', 0)]} as any;
    expect(component.cheapestOffer(entry)?.price).toBe(9);
    expect(component.bestSellOffer(entry)?.price).toBe(41);
    expect(component.bestSellOffer({offers: [offer('BUY', 5)]} as any)).toBeNull();
  });
});

describe('CatalogBrowserComponent family column', () => {
  it('groups families by colour and hides empty ones unless selected', async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogBrowserComponent],
      providers: [provideRouter([]), {provide: CatalogService, useValue: {}}]
    }).compileComponents();
    const component = TestBed.createComponent(CatalogBrowserComponent).componentInstance;
    component.result = {groupFamilyCounts: {STANDARD: {SHIP: 4, FPS_WEAPON: 2, CITY: 1}}} as any;
    const labels = () => component.familyGroups.map(group => `${group.label}:${group.families.map(f => f.value).join(',')}`);
    expect(labels()).toEqual(['Vaisseaux et véhicules:', 'Armement:FPS_WEAPON', 'Lieux:CITY']);
    component.result = {groupFamilyCounts: {STANDARD: {FPS_WEAPON: 2}}} as any;
    expect(labels()).toEqual(['Armement:FPS_WEAPON']);
    component.result = {groupFamilyCounts: {STANDARD: {SHIP: 4, FPS_WEAPON: 2, CITY: 1}}} as any;
    component.family = 'MOON';
    component.catalogGroup = 'STANDARD';
    expect(labels()).toContain('Lieux:MOON,CITY');
    expect(component.familyTone('SHIP_WEAPON')).toBe('248 113 113');
    expect(component.entryTone({family: 'SHIP', catalogGroup: 'WIKELO'} as CatalogEntry)).toBe('196 181 253');
  });
});
