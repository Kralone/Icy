import { CommonModule, Location } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, OnDestroy, ChangeDetectionStrategy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, Subscription } from 'rxjs';
import { CelestialBodyService } from '../../../core/services/celestial/celestial-body.service';
import { OrbitalStationService } from '../../../core/services/station/orbital-station.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { UexDatasetService, UexVehiclePurchase, UexVehicleRental } from '../../../core/services/uex/uex-dataset.service';
import { Ship } from '../../../model/ship.model';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';

type MarketLocation = {
  terminalId?: string | null;
  terminalName: string;
  planetName?: string | null;
  locationName?: string | null;
  systemName?: string | null;
};

type ShipByLocationCard = {
  ship: Ship;
  location: string;
  price: number;
  offerType: 'ACHAT' | 'LOCATION';
  terminalId?: string | null;
  planetName?: string | null;
  locationName?: string | null;
  systemName?: string | null;
};

type LocationCardView = {
  location: string;
  titleLine: string;
  bodyLine1: string;
  bodyLine2: string;
  imageUrl: string;
  count: number;
  planetName: string;
  systemName: string;
  majorKey: string;
  majorLabel: string;
  majorImageUrl: string;
};

type MajorLocationCardView = {
  systemName: string;
  majorKey: string;
  majorLabel: string;
  majorImageUrl: string;
  count: number;
  cards: LocationCardView[];
};

@Component({
  standalone: true,
  selector: 'app-ship-market',
  imports: [CommonModule, FormsModule, RouterLink, A11yModule, AsyncStateComponent],
  templateUrl: './ship-market.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./ship-market.component.css', './ship-market-filters.css']
})
export class ShipMarketComponent implements OnDestroy {
  roleLabel(value?: string): string {
    const roles: Record<string, string> = {
      'exploration': 'Exploration', 'mining': 'Minage', 'salvage': 'Récupération',
      'cargo': 'Transport de fret', 'freight': 'Transport de fret', 'cargo transport': 'Transport de fret',
      'light freight': 'Fret léger', 'medium freight': 'Fret moyen', 'heavy freight': 'Fret lourd',
      'light fighter': 'Chasseur léger', 'medium fighter': 'Chasseur moyen', 'heavy fighter': 'Chasseur lourd',
      'fighter': 'Chasseur', 'combat': 'Combat', 'bomber': 'Bombardier', 'medical': 'Médical',
      'racing': 'Course', 'racer': 'Course', 'multi-role': 'Polyvalent', 'multi role': 'Polyvalent',
      'starter': 'Débutant', 'refueling': 'Ravitaillement', 'touring': 'Tourisme', 'transport': 'Transport',
      'prospecting': 'Prospection', 'pathfinder': 'Éclaireur', 'luxury': 'Luxe', 'generalist': 'Polyvalent',
      'gunship': 'Canonnière', 'gun ship': 'Canonnière', 'frigate': 'Frégate', 'dropship': 'Transport de troupes',
      'refinery': 'Raffinage', 'heavy salvage': 'Récupération lourde', 'medium salvage': 'Récupération moyenne'
    };
    return value?.split('/').map(part => roles[part.trim().toLowerCase()] || part.trim()).join(' / ') || 'Non renseigné';
  }

  sizeLabel(value?: string): string {
    const sizes: Record<string, string> = { small: 'Petit', medium: 'Moyen', large: 'Grand', capital: 'Capital', snub: 'Auxiliaire', vehicle: 'Véhicule' };
    return sizes[value?.trim().toLowerCase() || ''] || value?.trim() || 'Non renseignée';
  }
  readonly offerModes: Array<'ACHAT' | 'LOCATION'> = ['ACHAT', 'LOCATION'];
  isLoading = true;
  errorMessage = '';
  searchTerm = '';
  shareMessage = '';
  shareFailed = false;
  shareUrl = '';
  private readonly ownFilterNavigation = {};
  private querySubscription?: Subscription;
  private urlSearchTimer?: ReturnType<typeof setTimeout>;
  private marketLoaded = false;
  private queryParams: ParamMap | null = null;
  private detailsTrigger: HTMLElement | null = null;
  selectedManufacturer = '';
  selectedGameplays: string[] = [];
  readonly gameplayFilters = [
    { id: 'combat', label: 'Combat', pattern: /combat|fighter|chasseur|bomber|bombard|gunship|canonni|interdict|intercept|frigate|fregate|corvette|destroyer|military/ },
    { id: 'cargo', label: 'Fret', pattern: /cargo|freight|fret|hauling/ },
    { id: 'mining', label: 'Minage', pattern: /mining|minage|prospect/ },
    { id: 'salvage', label: 'Récupération', pattern: /salvage|recuperation|recycl/ },
    { id: 'medical', label: 'Médical', pattern: /medical|medecine|rescue|sauvetage/ },
    { id: 'exploration', label: 'Exploration', pattern: /explor|expedition|pathfind|scout|recon/ },
    { id: 'racing', label: 'Course', pattern: /racing|racer|course/ },
    { id: 'transport', label: 'Transport', pattern: /transport|touring|tourism|tourisme|passenger|passager|luxury|luxe|dropship/ },
    { id: 'support', label: 'Soutien', pattern: /refuel|ravitail|repair|repar|refin|raffin|construction|support|soutien/ },
    { id: 'multi', label: 'Polyvalent', pattern: /multi.?role|polyvalent|starter|debutant|generalist/ }
  ];

  get manufacturerOptions(): string[] {
    return [...new Set(Object.values(this.groupedShips).flat().map(row => row.ship.brand?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  toggleGameplay(id: string): void {
    this.selectedGameplays = this.selectedGameplays.includes(id)
      ? this.selectedGameplays.filter(value => value !== id) : [...this.selectedGameplays, id];
    this.onSearchTermChange();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedManufacturer = '';
    this.selectedGameplays = [];
    this.onSearchTermChange();
  }

  shipDescription(ship: Ship): string {
    return (ship.notes ?? '').split(/\r?\n/)
      .filter(line => !/^\s*(fabricant|constructeur|manufacturer|focus|role|rôle|type)\s*:/i.test(line))
      .join('\n').trim();
  }
  selectedOfferMode: 'ACHAT' | 'LOCATION' = 'ACHAT';
  listVisible = false;
  isSwitchingLocation = false;
  isSwitchingMajor = false;
  isSwitchingOfferMode = false;
  locations: string[] = [];
  selectedLocation = '';
  primaryBackground = '';
  secondaryBackground = '';
  isPrimaryLayerVisible = true;
  groupedShips: Record<string, ShipByLocationCard[]> = {};
  groupedShipsByMode: Record<string, { ACHAT: ShipByLocationCard[]; LOCATION: ShipByLocationCard[] }> = {};
  brands: { name: string; imageUrl: string }[] = [];
  selectedShipOffer: ShipByLocationCard | null = null;
  filteredLocationCards: LocationCardView[] = [];
  majorLocationCards: MajorLocationCardView[] = [];
  subLocationCards: LocationCardView[] = [];
  selectedMajorKey = '';
  selectedLocationShips: ShipByLocationCard[] = [];
  private locationSwitchTimer?: ReturnType<typeof setTimeout>;
  private majorSwitchTimer?: ReturnType<typeof setTimeout>;
  private offerModeSwitchTimer?: ReturnType<typeof setTimeout>;

  private locationMetadata: Record<string, MarketLocation> = {};
  private planetImageByKey: Record<string, string> = {};
  private stationImageByKey: Record<string, string> = {};

  private readonly backgroundByPlanet: Record<string, [string, string, string]> = {
    arccorp: ['#12263a', '#184e77', '#1a759f'],
    hurston: ['#2b1b16', '#5a3a2e', '#8a5a44'],
    crusader: ['#0c2d48', '#145da0', '#2e8bc0'],
    microtech: ['#0f2134', '#1f3b5b', '#295f85'],
    terminus: ['#2d0f16', '#4e1f1f', '#7a2f2f'],
    monox: ['#221f38', '#3d2f63', '#6647a8'],
    bloom: ['#132b1e', '#29543b', '#3f7d55']
  };

  private readonly backgroundBySystem: Record<string, [string, string, string]> = {
    stanton: ['#0a111c', '#0f172a', '#1b3145'],
    pyro: ['#1a1013', '#3a1f1a', '#5c2e23'],
    nyx: ['#11111f', '#1c2345', '#2e3f69']
  };

  private readonly defaultBackgroundPalette: [string, string, string] = ['#0a111c', '#0f172a', '#1b3145'];
  private readonly fallbackLocationImageUrl = 'https://media.starcitizen.tools/thumb/0/04/Stanton_system_overview.jpg/1200px-Stanton_system_overview.jpg.webp';
  private readonly rentalVehicleAliases: Record<string, string> = {
    mole: 'Argo MOLE',
    roc: 'Greycat ROC',
    prospector: 'MISC Prospector',
    fortune: 'MISC Fortune',
    'hull a': 'MISC Hull A',
    'freelancer max': 'MISC Freelancer MAX',
    'dragonfly black': 'Dragonfly',
    '600i explorer': '600i',
    freelancer: 'MISC Freelancer',
    m50: 'M50 Interceptor',
    'reliant kore': 'MISC Reliant Kore'
  };

  constructor(
    private shipService: ShipService,
    private uexDatasetService: UexDatasetService,
    private celestialBodyService: CelestialBodyService,
    private orbitalStationService: OrbitalStationService,
    private router: Router,
    private route: ActivatedRoute,
    private locationStrategy: Location
  ) {}

  ngOnInit(): void {
    this.marketLoaded = false;
    this.querySubscription?.unsubscribe();
    this.querySubscription = this.route.queryParamMap.subscribe(params => {
      this.queryParams = params;
      // An in-flight URL write must not overwrite a newer checkbox or typed search.
      // Browser back/forward has no origin token and still restores the complete state.
      if (this.router.currentNavigation()?.extras.info === this.ownFilterNavigation) return;
      this.cancelTransitions();
      this.applyUrlFilters(params);
    });
    const initialBackground = this.composeBackgroundStyle(this.defaultBackgroundPalette);
    this.primaryBackground = initialBackground;
    this.secondaryBackground = initialBackground;
    this.loadBrands();
    this.loadUniverseImages();
    this.loadShipsByLocation();
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
    this.cancelTransitions();
  }

  private cancelTransitions(): void {
    if (this.urlSearchTimer) clearTimeout(this.urlSearchTimer);
    this.urlSearchTimer = undefined;
    this.isSwitchingLocation = false;
    this.isSwitchingMajor = false;
    this.isSwitchingOfferMode = false;
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
      this.locationSwitchTimer = undefined;
    }
    if (this.majorSwitchTimer) {
      clearTimeout(this.majorSwitchTimer);
      this.majorSwitchTimer = undefined;
    }
    if (this.offerModeSwitchTimer) {
      clearTimeout(this.offerModeSwitchTimer);
      this.offerModeSwitchTimer = undefined;
    }
  }

  get backToMenuLink(): string {
    return this.router.url.startsWith('/icy/outils') ? '/icy/outils' : '/utilitaires';
  }

  get totalSalePoints(): number {
    return this.locations.reduce((count, location) => count + (this.groupedShips[location]?.length ?? 0), 0);
  }

  selectLocation(location: string): void {
    if (location === this.selectedLocation) {
      return;
    }
    this.isSwitchingLocation = true;
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
    }

    this.locationSwitchTimer = setTimeout(() => {
      this.setSelectedLocation(location);
      this.updateFilterUrl();
      this.isSwitchingLocation = false;
      this.locationSwitchTimer = undefined;
    }, 180);
  }

  onSearchTermChange(debounce = false): void {
    this.refreshFilteredViews();
    const visibleLocations = this.subLocationCards.map((card) => card.location);
    if (!visibleLocations.includes(this.selectedLocation)) {
      this.setSelectedLocation(visibleLocations[0] ?? '');
    }
    this.updateBackgroundForSelection();
    this.updateFilterUrl(debounce);
  }

  setSelectedMajorLocation(majorKey: string): void {
    if (majorKey === this.selectedMajorKey) {
      return;
    }
    this.isSwitchingMajor = true;
    this.isSwitchingLocation = true;
    if (this.majorSwitchTimer) {
      clearTimeout(this.majorSwitchTimer);
    }
    this.majorSwitchTimer = setTimeout(() => {
      this.selectedMajorKey = majorKey;
      this.refreshMajorAndSubLocations();
      const nextLocation = this.subLocationCards[0]?.location ?? '';
      this.setSelectedLocation(nextLocation);
      this.updateFilterUrl();
      this.isSwitchingMajor = false;
      this.isSwitchingLocation = false;
      this.majorSwitchTimer = undefined;
    }, 170);
  }

  setOfferMode(mode: 'ACHAT' | 'LOCATION'): void {
    if (this.selectedOfferMode === mode) {
      return;
    }
    this.isSwitchingOfferMode = true;
    this.selectedOfferMode = mode;
    this.onSearchTermChange();
    if (this.offerModeSwitchTimer) {
      clearTimeout(this.offerModeSwitchTimer);
    }
    this.offerModeSwitchTimer = setTimeout(() => {
      this.isSwitchingOfferMode = false;
      this.offerModeSwitchTimer = undefined;
    }, 120);
  }

  getBrandLogo(brandName?: string): string {
    if (!brandName) return '';
    return this.brands.find((brand) => brand.name === brandName)?.imageUrl ?? '';
  }

  trackByShip(_: number, item: ShipByLocationCard): string {
    return `${item.terminalId ?? item.location}-${item.ship.id}-${item.offerType}-${item.price}`;
  }

  trackByLocation(_: number, item: LocationCardView): string {
    return item.location;
  }

  trackByMajorLocation(_: number, item: MajorLocationCardView): string {
    return item.majorKey;
  }

  @ViewChild('detailsClose') set detailsClose(button: ElementRef<HTMLButtonElement> | undefined) {
    if (button) queueMicrotask(() => {
      if (this.selectedShipOffer) button.nativeElement.focus();
    });
  }

  openShipDetails(offer: ShipByLocationCard): void {
    this.detailsTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selectedShipOffer = offer;
  }

  openShipDetailsFromSpace(event: Event, offer: ShipByLocationCard): void {
    event.preventDefault();
    this.openShipDetails(offer);
  }

  closeShipDetails(): void {
    this.selectedShipOffer = null;
    this.detailsTrigger?.focus();
    this.detailsTrigger = null;
  }

  @HostListener('document:keydown.escape')
  closeShipDetailsOnEscape(): void {
    if (this.selectedShipOffer) {
      this.closeShipDetails();
    }
  }


  private applyUrlFilters(params: ParamMap): void {
    this.searchTerm = (params.get('q') ?? '').slice(0, 200);
    const manufacturer = (params.get('manufacturer') ?? '').slice(0, 160);
    this.selectedManufacturer = !this.marketLoaded || this.manufacturerOptions.includes(manufacturer) ? manufacturer : '';
    const requestedGameplays = params.getAll('gameplay').flatMap(value => value.split(','));
    this.selectedGameplays = this.gameplayFilters.filter(filter => requestedGameplays.includes(filter.id)).map(filter => filter.id);
    this.selectedOfferMode = params.get('mode')?.toLowerCase() === 'location' ? 'LOCATION' : 'ACHAT';
    this.selectedMajorKey = (params.get('planet') ?? '').slice(0, 1000);
    this.selectedLocation = (params.get('location') ?? '').slice(0, 1000);
    if (this.marketLoaded) {
      // A location identifies its parent unambiguously, even across systems.
      if (this.locations.includes(this.selectedLocation)) {
        this.selectedMajorKey = this.buildLocationCard(this.selectedLocation).majorKey;
      }
      this.refreshFilteredViews();
      this.updateBackgroundForSelection();
    }
    this.shareMessage = '';
    this.shareFailed = false;
  }

  private filterUrlTree() {
    return this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        q: this.searchTerm || null,
        manufacturer: this.selectedManufacturer || null,
        gameplay: this.gameplayFilters.filter(filter => this.selectedGameplays.includes(filter.id)).map(filter => filter.id).join(',') || null,
        mode: this.selectedOfferMode === 'LOCATION' ? 'location' : null,
        planet: this.selectedMajorKey || null,
        location: this.selectedLocation || null,
      }
    });
  }

  private updateFilterUrl(debounce = false): void {
    if (!this.marketLoaded) return;
    this.shareMessage = '';
    this.shareFailed = false;
    if (this.urlSearchTimer) clearTimeout(this.urlSearchTimer);
    this.urlSearchTimer = undefined;
    const write = () => {
      this.urlSearchTimer = undefined;
      const tree = this.filterUrlTree();
      if (this.router.serializeUrl(tree) !== this.router.url) {
        void this.router.navigateByUrl(tree, {info: this.ownFilterNavigation}).catch(() => {
          this.shareMessage = 'Le lien n’a pas pu être actualisé.';
          this.shareFailed = true;
          this.shareUrl = this.buildShareUrl();
        });
      }
    };
    if (debounce) this.urlSearchTimer = setTimeout(write, 300);
    else write();
  }

  private buildShareUrl(): string {
    const path = this.locationStrategy.prepareExternalUrl(this.router.serializeUrl(this.filterUrlTree()));
    return new URL(path, document.baseURI).href;
  }

  async copySearchLink(): Promise<void> {
    this.shareUrl = this.buildShareUrl();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(this.shareUrl);
      this.shareFailed = false;
      this.shareMessage = 'Lien copié.';
    } catch {
      this.shareFailed = true;
      this.shareMessage = 'Copie automatique indisponible. Vous pouvez copier le lien ci-dessous.';
    }
  }

  private loadBrands(): void {
    this.shipService.getAllBrandsWithImages().subscribe({
      next: (response) => {
        this.brands = response?.data ?? [];
      },
      error: () => {
        this.brands = [];
      }
    });
  }

  private loadUniverseImages(): void {
    forkJoin({
      bodies: this.celestialBodyService.listFrontBodies().pipe(
        map(response => response?.data ?? []), catchError(() => of([]))
      ),
      stations: this.orbitalStationService.listFrontStations().pipe(
        map(response => response?.data ?? []), catchError(() => of([]))
      ),
      catalog: this.celestialBodyService.listFrontLocationImages().pipe(
        map(response => response?.data ?? []), catchError(() => of([]))
      )
    }).subscribe(({ bodies, stations, catalog }) => {
      this.planetImageByKey = {};
      this.stationImageByKey = {};
      for (const planet of bodies.filter(body => body.bodyType === 'PLANET')) {
        if (planet.imageUrl) this.planetImageByKey[this.locationImageKey(planet.systemName, planet.name)] = planet.imageUrl;
      }
      for (const station of stations) {
        if (station.imageUrl) this.stationImageByKey[this.locationImageKey(station.systemName, station.name)] = station.imageUrl;
      }
      for (const location of catalog) {
        if (!location.name?.trim() || !location.imageUrl?.trim()) continue;
        const images = location.family === 'PLANET' ? this.planetImageByKey : this.stationImageByKey;
        images[this.locationImageKey(location.systemName ?? '', location.name)] = location.imageUrl;
      }
      this.refreshFilteredViews();
      this.updateBackgroundForSelection();
    });
  }

  private loadShipsByLocation(): void {
    this.errorMessage = '';
    this.isLoading = true;

    forkJoin({
      ships: this.shipService.getAllShips().pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([] as Ship[]))
      ),
      purchases: this.uexDatasetService.listVehiclePurchases().pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([] as UexVehiclePurchase[]))
      ),
      rentals: this.uexDatasetService.listVehicleRentals().pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([] as UexVehicleRental[]))
      )
    })
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ ships, purchases, rentals }) => {
          this.groupedShips = this.groupShipsByLocation(ships, purchases, rentals);
          this.groupedShipsByMode = this.buildGroupedShipsByMode(this.groupedShips);
          this.locations = Object.keys(this.groupedShips).sort((left, right) => left.localeCompare(right));
          this.marketLoaded = true;
          if (this.queryParams) this.applyUrlFilters(this.queryParams);
          else this.refreshFilteredViews();
          this.updateBackgroundForSelection();
          this.listVisible = true;
        },
        error: () => {
          this.groupedShips = {};
          this.groupedShipsByMode = {};
          this.locations = [];
          this.selectedLocation = '';
          this.listVisible = false;
          const fallbackBackground = this.composeBackgroundStyle(this.defaultBackgroundPalette);
          this.primaryBackground = fallbackBackground;
          this.secondaryBackground = fallbackBackground;
          this.isPrimaryLayerVisible = true;
          this.errorMessage = 'Impossible de charger les offres vaisseaux (achat/location).';
        }
      });
  }

  private groupShipsByLocation(
    ships: Ship[],
    purchases: UexVehiclePurchase[],
    rentals: UexVehicleRental[]
  ): Record<string, ShipByLocationCard[]> {
    const grouped: Record<string, ShipByLocationCard[]> = {};
    this.locationMetadata = {};
    const shipsByNormalizedName = this.buildShipNameIndex(ships);
    const addOffer = (offer: MarketLocation & {vehicleName: string}, price: number, offerType: 'ACHAT' | 'LOCATION') => {
      const vehicleName = (offer.vehicleName ?? '').trim();
      const terminalName = (offer.terminalName ?? '').trim();
      if (!vehicleName || !terminalName || !Number.isFinite(price) || price <= 0) return;
      const ship = this.resolveShipForVehicleName(vehicleName, shipsByNormalizedName);
      if (!ship) return;
      const metadata: MarketLocation = {
        terminalName, terminalId: offer.terminalId ?? null,
        locationName: offer.locationName?.trim() || null,
        planetName: offer.planetName?.trim() || null,
        systemName: offer.systemName?.trim() || null
      };
      // Physical places share a card; terminals without a known place stay distinct.
      const key = JSON.stringify([this.normalizeText(metadata.systemName ?? ''), this.normalizeText(metadata.planetName ?? ''),
        metadata.locationName ? 'place:' + this.normalizeText(metadata.locationName) : 'terminal:' + (metadata.terminalId ?? terminalName)]);
      this.locationMetadata[key] = metadata;
      (grouped[key] ??= []).push({ship, location: terminalName, price, offerType,
        terminalId: metadata.terminalId, locationName: metadata.locationName,
        planetName: metadata.planetName, systemName: metadata.systemName});
    };
    for (const purchase of purchases) addOffer(purchase, Number(purchase.buyPrice), 'ACHAT');
    for (const rental of rentals) addOffer(rental, Number(rental.rentPrice), 'LOCATION');

    for (const location of Object.keys(grouped)) {
      grouped[location] = grouped[location].sort((left, right) => {
        const nameComparison = left.ship.name.localeCompare(right.ship.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return left.offerType.localeCompare(right.offerType);
      });
    }

    return grouped;
  }

  private buildShipNameIndex(ships: Ship[]): Record<string, Ship> {
    const index: Record<string, Ship> = {};
    for (const ship of ships) {
      const key = this.normalizeVehicleName(ship.name);
      if (key) {
        index[key] = ship;
      }
    }
    return index;
  }

  private buildGroupedShipsByMode(
    grouped: Record<string, ShipByLocationCard[]>
  ): Record<string, { ACHAT: ShipByLocationCard[]; LOCATION: ShipByLocationCard[] }> {
    const index: Record<string, { ACHAT: ShipByLocationCard[]; LOCATION: ShipByLocationCard[] }> = {};
    for (const location of Object.keys(grouped)) {
      const rows = grouped[location] ?? [];
      index[location] = {
        ACHAT: rows.filter((row) => row.offerType === 'ACHAT'),
        LOCATION: rows.filter((row) => row.offerType === 'LOCATION')
      };
    }
    return index;
  }

  private resolveShipForVehicleName(
    vehicleName: string | null | undefined,
    shipsByName: Record<string, Ship>
  ): Ship | null {
    const rawName = (vehicleName ?? '').trim();
    const normalized = this.normalizeVehicleName(rawName);
    const found = normalized ? shipsByName[normalized] : undefined;
    return found ?? null;
  }

  private normalizeVehicleName(name: string): string {
    const base = this.normalizeText(name);
    if (!base) {
      return '';
    }
    return this.rentalVehicleAliases[base] ? this.normalizeText(this.rentalVehicleAliases[base]) : base;
  }

  private buildLocationCard(location: string): LocationCardView {
    const metadata = this.locationMetadata[location];
    const planetName = metadata?.planetName ?? '';
    const systemName = metadata?.systemName ?? '';
    const placeName = metadata?.locationName ?? '';
    const majorLabel = planetName || 'Lieux hors planète';
    const majorKey = JSON.stringify([this.normalizeText(systemName), planetName ? 'planet:' + this.normalizeText(planetName) : 'unassigned']);
    const majorImageUrl = this.planetImageByKey[this.locationImageKey(systemName, planetName)] || this.fallbackLocationImageUrl;
    const imageUrl = this.stationImageByKey[this.locationImageKey(systemName, placeName)] || majorImageUrl;
    const terminalNames = [...new Set(this.getFilteredShipsForLocation(location).map(offer => offer.location))];
    return {
      location, titleLine: placeName || metadata?.terminalName || 'Lieu non renseigné',
      bodyLine1: placeName ? terminalNames.join(' · ') : 'Lieu non renseigné',
      bodyLine2: '', imageUrl, count: this.getFilteredShipsForLocation(location).length,
      planetName, systemName, majorKey, majorLabel, majorImageUrl
    };
  }

  private refreshFilteredViews(): void {
    this.filteredLocationCards = this.locations
      .map((location) => this.buildLocationCard(location))
      .filter((card) => card.count > 0);
    this.refreshMajorAndSubLocations();

    this.selectedLocationShips = this.selectedLocation
      ? this.getFilteredShipsForLocation(this.selectedLocation)
      : [];
  }

  private refreshMajorAndSubLocations(): void {
    const byMajor: Record<string, MajorLocationCardView> = {};
    for (const card of this.filteredLocationCards) {
      if (!byMajor[card.majorKey]) {
        byMajor[card.majorKey] = {
          systemName: card.systemName,
          majorKey: card.majorKey,
          majorLabel: card.majorLabel,
          majorImageUrl: card.majorImageUrl,
          count: 0,
          cards: []
        };
      }
      byMajor[card.majorKey].cards.push(card);
      byMajor[card.majorKey].count += card.count;
    }

    this.majorLocationCards = Object.values(byMajor)
      .map((major) => ({
        ...major,
        cards: major.cards.sort((left, right) => left.titleLine.localeCompare(right.titleLine))
      }))
      .sort((left, right) => left.majorLabel.localeCompare(right.majorLabel));

    const availableMajorKeys = this.majorLocationCards.map((major) => major.majorKey);
    if (!availableMajorKeys.includes(this.selectedMajorKey)) {
      this.selectedMajorKey = availableMajorKeys[0] ?? '';
    }

    const selectedMajor = this.majorLocationCards.find((major) => major.majorKey === this.selectedMajorKey);
    this.subLocationCards = selectedMajor?.cards ?? [];

    if (!this.subLocationCards.some((card) => card.location === this.selectedLocation)) {
      this.selectedLocation = this.subLocationCards[0]?.location ?? '';
    }
  }

  private getFilteredShipsForLocation(location: string): ShipByLocationCard[] {
    const rows = this.groupedShipsByMode[location]?.[this.selectedOfferMode] ?? [];
    const query = this.normalizeText(this.searchTerm);
    return rows.filter((row) => {
      if (this.selectedManufacturer && row.ship.brand?.name !== this.selectedManufacturer) return false;
      if (this.selectedGameplays.length && !this.gameplayFilters.some(filter =>
        this.selectedGameplays.includes(filter.id) && filter.pattern.test(this.normalizeText(row.ship.focus ?? '')))) return false;
      const text = this.normalizeText(
        `${row.ship.name} ${row.ship.brand?.name ?? ''} ${row.ship.focus ?? ''} ${row.ship.crew ?? ''} ${row.location} ${row.locationName ?? ''} ${row.planetName ?? ''} ${row.systemName ?? ''}`
      );
      return text.includes(query);
    });
  }

  private locationImageKey(systemName: string, name: string): string {
    return JSON.stringify([this.normalizeText(systemName), this.normalizeText(name).replace(/\s+/g, '')]);
  }

  private normalizeText(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private setSelectedLocation(location: string): void {
    this.selectedLocation = location;
    this.selectedLocationShips = this.selectedLocation
      ? this.getFilteredShipsForLocation(this.selectedLocation)
      : [];
    this.updateBackgroundForSelection();
  }

  private updateBackgroundForSelection(): void {
    const selectedCard = this.filteredLocationCards.find((card) => card.location === this.selectedLocation);
    const palette = selectedCard ? this.resolvePaletteForCard(selectedCard) : this.defaultBackgroundPalette;
    const nextStyle = this.composeBackgroundStyle(palette);

    if (this.isPrimaryLayerVisible) {
      if (this.primaryBackground === nextStyle) return;
      this.secondaryBackground = nextStyle;
      this.isPrimaryLayerVisible = false;
      return;
    }

    if (this.secondaryBackground === nextStyle) return;
    this.primaryBackground = nextStyle;
    this.isPrimaryLayerVisible = true;
  }

  private resolvePaletteForCard(card: LocationCardView): [string, string, string] {
    const planetKey = this.normalizeText(card.planetName);
    const systemKey = this.normalizeText(card.systemName);

    for (const key of Object.keys(this.backgroundByPlanet)) {
      if (planetKey.includes(key)) {
        return this.backgroundByPlanet[key];
      }
    }
    for (const key of Object.keys(this.backgroundBySystem)) {
      if (systemKey.includes(key)) {
        return this.backgroundBySystem[key];
      }
    }
    return this.defaultBackgroundPalette;
  }

  private composeBackgroundStyle(palette: [string, string, string]): string {
    const [a, b, c] = palette;
    return `linear-gradient(155deg, ${this.hexToRgba(a, 0.9)} 0%, ${this.hexToRgba(b, 0.86)} 45%, ${this.hexToRgba(c, 0.82)} 100%)`;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const source = hex.replace('#', '').trim();
    if (source.length !== 6) {
      return `rgba(15,23,42,${alpha})`;
    }
    const red = parseInt(source.slice(0, 2), 16);
    const green = parseInt(source.slice(2, 4), 16);
    const blue = parseInt(source.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
