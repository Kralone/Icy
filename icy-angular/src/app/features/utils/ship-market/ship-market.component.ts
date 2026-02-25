import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CelestialBody, CelestialBodyService } from '../../../core/services/celestial/celestial-body.service';
import { OrbitalStation, OrbitalStationService } from '../../../core/services/station/orbital-station.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { Ship, ShipSalePoint } from '../../../model/ship.model';

type ShipByLocationCard = {
  ship: Ship;
  location: string;
  price: number;
};

type LocationCardView = {
  location: string;
  titleLine: string;
  bodyLine1: string;
  bodyLine2: string;
  imageUrl: string;
  count: number;
  promoLabel: string;
};

@Component({
  standalone: true,
  selector: 'app-ship-market',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ship-market.component.html',
  styleUrl: './ship-market.component.css',
  animations: [
    trigger('listFade', [
      transition(':leave', [
        animate('220ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('itemDeploy', [
      transition(':enter', [
        query('.ship-market-card', [
          style({ opacity: 0, transform: 'translateY(14px)' }),
          stagger(55, [
            animate('260ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('locationCardItem', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('130ms ease-in', style({ opacity: 0, transform: 'translateY(-6px)' }))
      ])
    ]),
    trigger('shipCardItem', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('210ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' }))
      ])
    ])
  ]
})
export class ShipMarketComponent implements OnDestroy {
  isLoading = true;
  errorMessage = '';
  searchTerm = '';
  listVisible = false;
  isSwitchingLocation = false;
  locations: string[] = [];
  selectedLocation = '';
  primaryBackground = '';
  secondaryBackground = '';
  isPrimaryLayerVisible = true;
  groupedShips: Record<string, ShipByLocationCard[]> = {};
  brands: { name: string; imageUrl: string }[] = [];
  zoomedShip: Ship | null = null;
  filteredLocationCards: LocationCardView[] = [];
  selectedLocationShips: ShipByLocationCard[] = [];
  private locationSwitchTimer?: ReturnType<typeof setTimeout>;

  private planets: CelestialBody[] = [];
  private stations: OrbitalStation[] = [];
  private planetImageByKey: Record<string, string> = {};
  private stationImageByKey: Record<string, string> = {};

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
    lorville: 'Lorville',
    crusader: 'Crusader',
    orison: 'Orison',
    'new babbage': 'New Babbage',
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

  constructor(
    private shipService: ShipService,
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
  }

  get backToMenuLink(): string {
    return this.router.url.startsWith('/utilitaires') ? '/utilitaires' : '/icy/utilitaires';
  }

  get totalSalePoints(): number {
    return this.locations.reduce((count, location) => count + (this.groupedShips[location]?.length ?? 0), 0);
  }

  selectLocation(location: string): void {
    if (location === this.selectedLocation) {
      return;
    }
    this.isSwitchingLocation = true;
    this.listVisible = false;
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
    }

    this.locationSwitchTimer = setTimeout(() => {
      this.setSelectedLocation(location);
      this.listVisible = true;
      this.isSwitchingLocation = false;
      this.locationSwitchTimer = undefined;
    }, 180);
  }

  onSearchTermChange(): void {
    this.refreshFilteredViews();
    const visibleLocations = this.filteredLocationCards.map((card) => card.location);
    if (!visibleLocations.includes(this.selectedLocation)) {
      this.setSelectedLocation(visibleLocations[0] ?? '');
    }
    this.updateBackgroundForSelection();
  }

  getBrandLogo(brandName?: string): string {
    if (!brandName) return '';
    return this.brands.find((brand) => brand.name === brandName)?.imageUrl ?? '';
  }

  trackByShip(_: number, item: ShipByLocationCard): string {
    return `${item.location}-${item.ship.id}`;
  }

  trackByLocation(_: number, item: LocationCardView): string {
    return item.location;
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

    this.shipService.getAllShips()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          const ships = response?.data ?? [];
          this.groupedShips = this.groupShipsByLocation(ships);
          this.locations = Object.keys(this.groupedShips).sort((left, right) => left.localeCompare(right));
          this.selectedLocation = this.locations[0] ?? '';
          this.refreshFilteredViews();
          this.onSearchTermChange();
          this.updateBackgroundForSelection();
          this.listVisible = true;
        },
        error: () => {
          this.groupedShips = {};
          this.locations = [];
          this.selectedLocation = '';
          this.listVisible = false;
          const fallbackBackground = this.composeBackgroundStyle(this.defaultBackgroundPalette);
          this.primaryBackground = fallbackBackground;
          this.secondaryBackground = fallbackBackground;
          this.isPrimaryLayerVisible = true;
          this.errorMessage = 'Impossible de charger les points de vente des vaisseaux.';
        }
      });
  }

  private groupShipsByLocation(ships: Ship[]): Record<string, ShipByLocationCard[]> {
    const grouped: Record<string, ShipByLocationCard[]> = {};

    for (const ship of ships) {
      const salePoints = ship.salePoints ?? [];
      for (const salePoint of salePoints) {
        const location = this.normalizeLocation(salePoint);
        const price = this.normalizePrice(salePoint);
        if (!location || price === null) continue;

        if (!grouped[location]) {
          grouped[location] = [];
        }

        grouped[location].push({ ship, location, price });
      }
    }

    for (const location of Object.keys(grouped)) {
      grouped[location] = grouped[location].sort((left, right) => left.ship.name.localeCompare(right.ship.name));
    }

    return grouped;
  }

  private buildLocationCard(location: string): LocationCardView {
    const parsed = this.parseLocationLabel(location);
    const placeKey = this.normalizeText(parsed.place);
    const promoLabel = placeKey.includes('lorville') ? '-15%' : '';
    return {
      location,
      titleLine: `${parsed.shop} - ${parsed.place}`,
      bodyLine1: parsed.tailPrimary,
      bodyLine2: parsed.tailSecondary,
      imageUrl: this.resolveLocationImage(parsed),
      count: this.getFilteredShipsForLocation(location).length,
      promoLabel
    };
  }

  private refreshFilteredViews(): void {
    this.filteredLocationCards = this.locations
      .map((location) => this.buildLocationCard(location))
      .filter((card) => card.count > 0);

    this.selectedLocationShips = this.selectedLocation
      ? this.getFilteredShipsForLocation(this.selectedLocation)
      : [];
  }

  private getFilteredShipsForLocation(location: string): ShipByLocationCard[] {
    const rows = this.groupedShips[location] ?? [];
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
        return this.stationAliases[aliasKey];
      }
    }
    const matched = this.stations.find((station) => key.includes(this.normalizeText(station.name)));
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

  private normalizeLocation(salePoint: ShipSalePoint): string | null {
    const location = (salePoint?.location ?? '').trim();
    return location.length ? location : null;
  }

  private normalizePrice(salePoint: ShipSalePoint): number | null {
    const price = Number(salePoint?.price);
    if (!Number.isFinite(price) || price < 0) return null;
    return price;
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
