import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { CelestialBody, CelestialBodyService } from '../../../core/services/celestial/celestial-body.service';
import { OrbitalStation, OrbitalStationService } from '../../../core/services/station/orbital-station.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { UexDatasetService, UexVehiclePurchase, UexVehicleRental, UexVehicleTerminal } from '../../../core/services/uex/uex-dataset.service';
import { Ship } from '../../../model/ship.model';

type ShipByLocationCard = {
  ship: Ship;
  location: string;
  price: number;
  offerType: 'ACHAT' | 'LOCATION';
};

type LocationCardView = {
  location: string;
  titleLine: string;
  bodyLine1: string;
  bodyLine2: string;
  imageUrl: string;
  count: number;
  promoLabel: string;
  stationName: string;
  planetName: string;
  majorKey: string;
  majorLabel: string;
  majorImageUrl: string;
};

type MajorLocationCardView = {
  majorKey: string;
  majorLabel: string;
  majorImageUrl: string;
  count: number;
  cards: LocationCardView[];
};

type TerminalMapping = {
  planetName: string | null;
  cityName: string | null;
  stationName: string | null;
  screenshot: string | null;
};

@Component({
  standalone: true,
  selector: 'app-ship-market',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ship-market.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ship-market.component.css'
})
export class ShipMarketComponent implements OnDestroy {
  readonly offerModes: Array<'ACHAT' | 'LOCATION'> = ['ACHAT', 'LOCATION'];
  isLoading = true;
  errorMessage = '';
  searchTerm = '';
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
  zoomedShip: Ship | null = null;
  filteredLocationCards: LocationCardView[] = [];
  majorLocationCards: MajorLocationCardView[] = [];
  subLocationCards: LocationCardView[] = [];
  selectedMajorKey = '';
  selectedLocationShips: ShipByLocationCard[] = [];
  private locationSwitchTimer?: ReturnType<typeof setTimeout>;
  private majorSwitchTimer?: ReturnType<typeof setTimeout>;
  private offerModeSwitchTimer?: ReturnType<typeof setTimeout>;

  private planets: CelestialBody[] = [];
  private stations: OrbitalStation[] = [];
  private terminals: UexVehicleTerminal[] = [];
  private planetImageByKey: Record<string, string> = {};
  private stationImageByKey: Record<string, string> = {};
  private terminalsByLookupKey: Record<string, TerminalMapping> = {};

  private readonly planetAliases: Record<string, string> = {
    'area 18': 'ArcCorp',
    'area18': 'ArcCorp',
    arcorp: 'ArcCorp',
    arccorp: 'ArcCorp',
    lorville: 'Hurston',
    hurston: 'Hurston',
    crusader: 'Crusader',
    orison: 'Crusader',
    microtech: 'microTech',
    'new babbage': 'microTech'
  };

  private readonly placeAliases: Record<string, string> = {
    'area 18': 'Area 18',
    'area18': 'Area 18',
    nbis: 'New Babbage',
    lorville: 'Lorville',
    crusader: 'Crusader',
    orison: 'Orison',
    'new babbage': 'New Babbage',
    arcl1: 'ARC-L1',
    arcl2: 'ARC-L2',
    arcl4: 'ARC-L4',
    crul1: 'CRU-L1',
    hurl1: 'HUR-L1',
    hurl2: 'HUR-L2',
    micl1: 'MIC-L1',
    micl2: 'MIC-L2',
    micl5: 'MIC-L5',
    checkmate: 'Checkmate',
    orbituary: 'Orbituary',
    'ruin station': 'Ruin Station',
    seraphim: 'Seraphim Station',
    everus: 'Everus Harbor',
    tressler: 'Port Tressler',
    baijini: 'Baijini Point',
    bajini: 'Baijini Point',
    grim: 'Grim HEX'
  };

  private readonly stationAliases: Record<string, string> = {
    nbis: 'New Babbage',
    arcl1: 'ARC-L1',
    arcl2: 'ARC-L2',
    arcl4: 'ARC-L4',
    crul1: 'CRU-L1',
    hurl1: 'HUR-L1',
    hurl2: 'HUR-L2',
    micl1: 'MIC-L1',
    micl2: 'MIC-L2',
    micl5: 'MIC-L5',
    checkmate: 'Checkmate',
    orbituary: 'Orbituary',
    seraphim: 'Seraphim Station',
    everus: 'Everus Harbor',
    tressler: 'Port Tressler',
    baijini: 'Baijini Point',
    bajini: 'Baijini Point',
    grim: 'Grim HEX'
  };

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
  private readonly rentalFallbackShipImageUrl = 'https://media.starcitizen.tools/thumb/0/04/Stanton_system_overview.jpg/1200px-Stanton_system_overview.jpg.webp';
  private readonly fallbackLocationImageUrl = 'https://media.starcitizen.tools/thumb/0/04/Stanton_system_overview.jpg/1200px-Stanton_system_overview.jpg.webp';
  private readonly rentalVehicleAliases: Record<string, string> = {
    mole: 'Argo MOLE',
    roc: 'Greycat ROC'
  };

  constructor(
    private shipService: ShipService,
    private uexDatasetService: UexDatasetService,
    private celestialBodyService: CelestialBodyService,
    private orbitalStationService: OrbitalStationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const initialBackground = this.composeBackgroundStyle(this.defaultBackgroundPalette);
    this.primaryBackground = initialBackground;
    this.secondaryBackground = initialBackground;
    this.loadBrands();
    this.loadUniverseImages();
    this.loadShipsByLocation();
  }

  ngOnDestroy(): void {
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
      this.isSwitchingLocation = false;
      this.locationSwitchTimer = undefined;
    }, 180);
  }

  onSearchTermChange(): void {
    this.refreshFilteredViews();
    const visibleLocations = this.subLocationCards.map((card) => card.location);
    if (!visibleLocations.includes(this.selectedLocation)) {
      this.setSelectedLocation(visibleLocations[0] ?? '');
    }
    this.updateBackgroundForSelection();
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
    return `${item.location}-${item.ship.id}-${item.offerType}`;
  }

  trackByLocation(_: number, item: LocationCardView): string {
    return item.location;
  }

  trackByMajorLocation(_: number, item: MajorLocationCardView): string {
    return item.majorKey;
  }

  openShipZoom(ship: Ship): void {
    this.zoomedShip = ship;
  }

  closeShipZoom(): void {
    this.zoomedShip = null;
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
    this.celestialBodyService.listFrontBodies().subscribe({
      next: (response) => {
        this.planets = (response?.data ?? []).filter((body) => body.bodyType === 'PLANET');
        this.planetImageByKey = {};
        for (const planet of this.planets) {
          this.planetImageByKey[this.normalizeText(planet.name)] = planet.imageUrl;
        }
        this.updateBackgroundForSelection();
      },
      error: () => {
        this.planets = [];
        this.planetImageByKey = {};
      }
    });

    this.orbitalStationService.listFrontStations().subscribe({
      next: (response) => {
        this.stations = response?.data ?? [];
        this.stationImageByKey = {};
        for (const station of this.stations) {
          this.stationImageByKey[this.normalizeText(station.name)] = station.imageUrl;
        }
        this.updateBackgroundForSelection();
      },
      error: () => {
        this.stations = [];
        this.stationImageByKey = {};
      }
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
      ),
      terminals: this.uexDatasetService.listVehicleTerminals().pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([] as UexVehicleTerminal[]))
      )
    })
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ ships, purchases, rentals, terminals }) => {
          this.terminals = terminals;
          this.buildTerminalsLookup();
          this.groupedShips = this.groupShipsByLocation(ships, purchases, rentals);
          this.groupedShipsByMode = this.buildGroupedShipsByMode(this.groupedShips);
          this.locations = Object.keys(this.groupedShips).sort((left, right) => left.localeCompare(right));
          this.selectedLocation = this.locations[0] ?? '';
          this.refreshFilteredViews();
          this.onSearchTermChange();
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
    const shipsByNormalizedName = this.buildShipNameIndex(ships);

    for (const purchase of purchases) {
      const location = (purchase?.terminalName ?? '').trim();
      const price = Number(purchase?.buyPrice);
      if (!location || !Number.isFinite(price) || price <= 0) {
        continue;
      }

      const ship = this.resolveShipForVehicleName(purchase?.vehicleName, purchase?.terminalName, 'Achat', shipsByNormalizedName);
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push({ ship, location, price, offerType: 'ACHAT' });
    }

    for (const rental of rentals) {
      const location = (rental?.terminalName ?? '').trim();
      const price = Number(rental?.rentPrice);
      if (!location || !Number.isFinite(price) || price <= 0) {
        continue;
      }

      const ship = this.resolveShipForVehicleName(rental?.vehicleName, rental?.terminalName, 'Location', shipsByNormalizedName);
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push({ ship, location, price, offerType: 'LOCATION' });
    }

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
    terminalName: string | null | undefined,
    fallbackFocus: string,
    shipsByName: Record<string, Ship>
  ): Ship {
    const rawName = (vehicleName ?? '').trim();
    const normalized = this.normalizeVehicleName(rawName);
    const found = normalized ? shipsByName[normalized] : undefined;
    if (found) {
      return found;
    }

    return {
      id: -Math.abs(this.stableHash(`${rawName}-${terminalName ?? ''}`)),
      name: rawName || 'Vaisseau inconnu',
      brand: { name: 'UEX' },
      imageUrl: this.rentalFallbackShipImageUrl,
      focus: fallbackFocus,
      crew: '-',
      size: '-',
      scu: undefined,
      flightReady: true
    };
  }

  private normalizeVehicleName(name: string): string {
    const base = this.normalizeText(name);
    if (!base) {
      return '';
    }
    return this.rentalVehicleAliases[base] ? this.normalizeText(this.rentalVehicleAliases[base]) : base;
  }

  private stableHash(text: string): number {
    let hash = 0;
    for (let index = 0; index < text.length; index++) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  private buildLocationCard(location: string): LocationCardView {
    const parsed = this.parseLocationLabel(location);
    const terminal = this.resolveTerminalMapping(location);
    const placeKey = this.normalizeText(parsed.place);
    const promoLabel = placeKey.includes('lorville') ? '-15%' : '';
    const stationName = terminal?.stationName || parsed.station || null;
    const cityName = terminal?.cityName || (!stationName ? parsed.place : null);
    const planetName = terminal?.planetName || parsed.planet || parsed.tailPrimary;
    const gatewayMajorLabel = this.resolveGatewayMajorLabel(location, stationName, cityName, parsed.place);
    const majorLabel = gatewayMajorLabel || planetName || stationName || cityName || 'Autres';
    const majorKey = this.normalizeText(majorLabel) || 'autres';
    const majorImageUrl = gatewayMajorLabel
      ? (this.resolveStationImage(gatewayMajorLabel) || this.resolvePlaceImage(stationName, cityName, planetName))
      : (this.resolvePlanetImage(majorLabel) || this.fallbackLocationImageUrl);
    const imageUrl = this.resolvePlaceImage(stationName, cityName, planetName);
    return {
      location,
      titleLine: `${parsed.shop} - ${parsed.place}`,
      bodyLine1: parsed.tailPrimary,
      bodyLine2: parsed.tailSecondary,
      imageUrl,
      count: this.getFilteredShipsForLocation(location).length,
      promoLabel,
      stationName: stationName || cityName || parsed.place,
      planetName,
      majorKey,
      majorLabel,
      majorImageUrl
    };
  }

  private resolveGatewayMajorLabel(
    location: string,
    stationName: string | null,
    cityName: string | null,
    parsedPlace: string
  ): string | null {
    const candidates = [stationName, cityName, parsedPlace, location].filter((value): value is string => !!value && !!value.trim());
    for (const candidate of candidates) {
      const candidateKey = this.normalizeText(candidate);
      if (!candidateKey.includes('gateway')) {
        continue;
      }

      const stationMatch = this.stations.find((station) => {
        const stationKey = this.normalizeText(station.name);
        return stationKey.includes('gateway') && (candidateKey.includes(stationKey) || stationKey.includes(candidateKey));
      });
      if (stationMatch) {
        return stationMatch.name;
      }

      const inlineGateway = candidate.match(/([a-z0-9' -]*gateway\s*\([^)]+\))/i);
      if (inlineGateway?.[1]) {
        return inlineGateway[1].trim().replace(/\s+/g, ' ');
      }
    }
    return null;
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
          majorKey: card.majorKey,
          majorLabel: card.majorLabel,
          majorImageUrl: card.majorImageUrl,
          count: 0,
          cards: []
        };
      }
      if (this.isFallbackLocationImage(byMajor[card.majorKey].majorImageUrl) && !this.isFallbackLocationImage(card.imageUrl)) {
        byMajor[card.majorKey].majorImageUrl = card.imageUrl;
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
    if (!query) return rows;

    return rows.filter((row) => {
      const text = this.normalizeText(
        `${row.ship.name} ${row.ship.brand?.name ?? ''} ${row.ship.focus ?? ''} ${row.ship.crew ?? ''} ${row.location}`
      );
      return text.includes(query);
    });
  }

  private parseLocationLabel(location: string): {
    shop: string;
    place: string;
    tailPrimary: string;
    tailSecondary: string;
    station: string | null;
    planet: string | null;
  } {
    const raw = (location ?? '').trim();
    const split = raw.split(/\s*-\s*/).map((part) => part.trim()).filter((part) => part.length > 0);
    const splitParts = this.resolveShopAndPlace(raw, split);

    const shopPart = splitParts.shop;
    const placePart = splitParts.place;

    const station = this.resolveStationName(placePart);
    const planet = this.resolvePlanetName(placePart, placePart);
    const stationRow = station
      ? this.stations.find((row) => this.normalizeText(row.name) === this.normalizeText(station))
      : null;
    const planetRow = planet
      ? this.planets.find((row) => this.normalizeText(row.name) === this.normalizeText(planet))
      : null;

    const tailPrimary = stationRow?.orbitTarget || planetRow?.name || planet || 'N/A';
    const tailSecondary = stationRow?.systemName || planetRow?.systemName || 'N/A';

    return {
      shop: shopPart || raw || 'N/A',
      place: placePart || 'N/A',
      tailPrimary,
      tailSecondary,
      station,
      planet: planetRow?.name || planet
    };
  }

  private extractShopFallback(raw: string): string {
    const parts = raw.split(/[>/]/).map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return raw;
  }

  private resolveShopAndPlace(raw: string, split: string[]): { shop: string; place: string } {
    if (split.length >= 2) {
      const left = split[0];
      const right = split.slice(1).join(' - ');
      const leftNorm = this.normalizeText(left);
      const rightNorm = this.normalizeText(right);

      if (leftNorm !== rightNorm) {
        const leftScore = this.scorePlaceLikelihood(left);
        const rightScore = this.scorePlaceLikelihood(right);

        if (leftScore > rightScore) {
          return { shop: right, place: this.canonicalizePlace(left) };
        }
        if (rightScore > leftScore) {
          return { shop: left, place: this.canonicalizePlace(right) };
        }

        return { shop: left, place: this.canonicalizePlace(right) };
      }
    }

    const inferredPlace = this.inferPlaceFromRaw(raw);
    if (inferredPlace) {
      const shop = this.removePlaceFromText(raw, inferredPlace.source).trim();
      if (shop.length) {
        return { shop, place: inferredPlace.display };
      }
    }

    const fallbackShop = this.extractShopFallback(raw);
    return { shop: fallbackShop, place: this.canonicalizePlace(raw) };
  }

  private canonicalizePlace(value: string): string {
    const key = this.normalizeText(value);
    for (const aliasKey of Object.keys(this.placeAliases)) {
      if (key.includes(aliasKey)) {
        return this.placeAliases[aliasKey];
      }
    }

    const matchedStation = this.stations.find((station) => key.includes(this.normalizeText(station.name)));
    if (matchedStation) return matchedStation.name;

    const matchedPlanet = this.planets.find((planet) => key.includes(this.normalizeText(planet.name)));
    if (matchedPlanet) return matchedPlanet.name;

    return value.trim() || 'N/A';
  }

  private inferPlaceFromRaw(raw: string): { source: string; display: string } | null {
    const lowered = this.normalizeText(raw);
    const candidates: Array<{ source: string; display: string }> = [];

    for (const aliasKey of Object.keys(this.placeAliases)) {
      if (lowered.includes(aliasKey)) {
        candidates.push({ source: aliasKey, display: this.placeAliases[aliasKey] });
      }
    }
    for (const station of this.stations) {
      const normalized = this.normalizeText(station.name);
      if (lowered.includes(normalized)) {
        candidates.push({ source: normalized, display: station.name });
      }
    }
    for (const planet of this.planets) {
      const normalized = this.normalizeText(planet.name);
      if (lowered.includes(normalized)) {
        candidates.push({ source: normalized, display: planet.name });
      }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.source.length - a.source.length);
    return candidates[0];
  }

  private removePlaceFromText(raw: string, placeSource: string): string {
    const parts = raw.split(/\s+/);
    const target = placeSource.split(/\s+/);
    if (!target.length) return raw;

    for (let start = 0; start <= parts.length - target.length; start++) {
      const chunk = parts.slice(start, start + target.length).join(' ');
      if (this.normalizeText(chunk) === placeSource) {
        const next = [...parts.slice(0, start), ...parts.slice(start + target.length)];
        return next.join(' ').replace(/\s*-\s*/g, ' ').trim();
      }
    }

    return raw.replace(new RegExp(placeSource, 'i'), '').replace(/\s*-\s*/g, ' ').trim();
  }

  private scorePlaceLikelihood(value: string): number {
    const key = this.normalizeText(value);
    let score = 0;

    for (const aliasKey of Object.keys(this.stationAliases)) {
      if (key.includes(aliasKey)) score += 3;
    }
    for (const aliasKey of Object.keys(this.planetAliases)) {
      if (key.includes(aliasKey)) score += 2;
    }
    if (this.stations.some((station) => key.includes(this.normalizeText(station.name)))) score += 3;
    if (this.planets.some((planet) => key.includes(this.normalizeText(planet.name)))) score += 2;

    return score;
  }

  private resolveStationName(locationText: string): string | null {
    const key = this.normalizeText(locationText);
    for (const aliasKey of Object.keys(this.stationAliases)) {
      if (key.includes(aliasKey)) {
        const aliased = this.stationAliases[aliasKey];
        const aliasedKey = this.normalizeText(aliased);
        const fromDb = this.stations.find((station) => {
          const stationKey = this.normalizeText(station.name);
          return stationKey.includes(aliasedKey) || aliasedKey.includes(stationKey);
        });
        return fromDb?.name ?? aliased;
      }
    }
    const matched = this.stations.find((station) => {
      const stationKey = this.normalizeText(station.name);
      return key.includes(stationKey) || stationKey.includes(key);
    });
    return matched?.name ?? null;
  }

  private resolvePlanetName(locationText: string, placePart: string): string {
    const placeKey = this.normalizeText(placePart);
    const fullKey = this.normalizeText(locationText);

    for (const aliasKey of Object.keys(this.planetAliases)) {
      if (placeKey.includes(aliasKey) || fullKey.includes(aliasKey)) {
        return this.planetAliases[aliasKey];
      }
    }

    const matchedPlanet = this.planets.find((planet) =>
      placeKey.includes(this.normalizeText(planet.name)) || fullKey.includes(this.normalizeText(planet.name))
    );
    if (matchedPlanet) {
      return matchedPlanet.name;
    }

    return placePart || locationText;
  }

  private resolveLocationImage(parsed: { station: string | null; planet: string | null }): string {
    if (parsed.station) {
      const stationImage = this.stationImageByKey[this.normalizeText(parsed.station)];
      if (stationImage) return stationImage;
    }

    if (parsed.planet) {
      const planetImage = this.planetImageByKey[this.normalizeText(parsed.planet)];
      if (planetImage) return planetImage;
    }

    return 'https://media.starcitizen.tools/thumb/0/04/Stanton_system_overview.jpg/1200px-Stanton_system_overview.jpg.webp';
  }

  private resolvePlaceImage(stationName: string | null, cityName: string | null, planetName: string): string {
    const stationImage = stationName ? this.resolveStationImage(stationName) : null;
    if (stationImage) {
      return stationImage;
    }
    const cityImage = cityName ? this.resolveStationImage(cityName) : null;
    if (cityImage) {
      return cityImage;
    }
    return this.resolvePlanetImage(planetName) || this.fallbackLocationImageUrl;
  }

  private resolveStationImage(stationName: string): string | null {
    const direct = this.stationImageByKey[this.normalizeText(stationName)];
    if (direct) {
      return direct;
    }
    const target = this.normalizeText(stationName);
    const fuzzy = this.stations.find((station) => {
      const key = this.normalizeText(station.name);
      return key.includes(target) || target.includes(key);
    });
    return fuzzy?.imageUrl || null;
  }

  private resolvePlanetImage(planetName: string): string | null {
    const direct = this.planetImageByKey[this.normalizeText(planetName)];
    if (direct) {
      return direct;
    }
    const target = this.normalizeText(planetName);
    const fuzzy = this.planets.find((planet) => {
      const key = this.normalizeText(planet.name);
      return key.includes(target) || target.includes(key);
    });
    return fuzzy?.imageUrl || null;
  }

  private isFallbackLocationImage(url: string | null | undefined): boolean {
    return !url || url === this.fallbackLocationImageUrl;
  }

  private buildTerminalsLookup(): void {
    this.terminalsByLookupKey = {};
    for (const terminal of this.terminals) {
      const mapping: TerminalMapping = {
        planetName: terminal.planetName ?? null,
        cityName: terminal.cityName ?? null,
        stationName: terminal.spaceStationName ?? null,
        screenshot: terminal.screenshot ?? null
      };

      const candidates = [
        terminal.name,
        terminal.nickname,
        terminal.displayName,
        terminal.code,
        terminal.spaceStationName,
        terminal.cityName
      ];

      for (const candidate of candidates) {
        const key = this.normalizeLookupText(candidate ?? '');
        if (!key) {
          continue;
        }
        const existing = this.terminalsByLookupKey[key];
        this.terminalsByLookupKey[key] = existing ? this.mergeTerminalMappings(existing, mapping) : mapping;
      }
    }
  }

  private resolveTerminalMapping(location: string): TerminalMapping | null {
    const key = this.normalizeLookupText(location);
    if (!key) {
      return null;
    }
    const direct = this.terminalsByLookupKey[key];
    if (direct?.screenshot) {
      return direct;
    }

    let best: { score: number; mapping: TerminalMapping } | null = null;
    for (const lookupKey of Object.keys(this.terminalsByLookupKey)) {
      if (lookupKey.length < 4) {
        continue;
      }
      if (key.includes(lookupKey) || lookupKey.includes(key)) {
        const score = lookupKey.length;
        if (!best || score > best.score) {
          best = { score, mapping: this.terminalsByLookupKey[lookupKey] };
        }
      }
    }
    const fuzzy = best?.mapping ?? null;
    if (direct && fuzzy) {
      return this.mergeTerminalMappings(direct, fuzzy);
    }
    return direct ?? fuzzy;
  }

  private mergeTerminalMappings(primary: TerminalMapping, secondary: TerminalMapping): TerminalMapping {
    return {
      planetName: primary.planetName || secondary.planetName || null,
      cityName: primary.cityName || secondary.cityName || null,
      stationName: primary.stationName || secondary.stationName || null,
      screenshot: primary.screenshot || secondary.screenshot || null
    };
  }

  private normalizeLookupText(value: string): string {
    return this.normalizeText(value).replace(/[^a-z0-9]/g, '');
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
    const planetKey = this.normalizeText(card.bodyLine1);
    const systemKey = this.normalizeText(card.bodyLine2);

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
