
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OreLocation, OreLocationService, OreMix } from '../../../../../../core/services/ore/ore-location.service';
import { ApiResponse } from '../../../../../../model/api-response.model';
import { CelestialBody, CelestialBodyService } from '../../../../../../core/services/celestial/celestial-body.service';

interface ParsedOreLocation {
  id: number;
  displayLabel: string;
  visibilityKind: 'PLANET' | 'LAGRANGE' | 'OTHER';
  groupPlanet: string;
  ores: ParsedOreEntry[];
  oresText: string;
}

interface ParsedOreEntry {
  oreCode: string;
  probability: number;
}

interface PlanetGroupCard {
  key: string;
  planetName: string;
  imageUrl: string | null;
  locations: ParsedOreLocation[];
}

interface OreLocationResult {
  locationId: number;
  displayLabel: string;
  groupPlanet: string;
  visibilityKind: 'PLANET' | 'LAGRANGE' | 'OTHER';
  probability: number;
}

@Component({
  selector: 'front-resources-mining-panel',
  standalone: true,
  imports: [],
  templateUrl: './resources-mining-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './resources-mining-panel.component.css'
})
export class ResourcesMiningPanelComponent implements OnInit, OnDestroy {
  parsedLocations: ParsedOreLocation[] = [];
  planets: CelestialBody[] = [];

  miningLoading = false;
  miningLoaded = false;
  miningError = '';
  miningSearch = '';
  selectedOreCode: string | null = null;

  selectedPlanetKey: string | null = null;
  selectedLocationId: number | null = null;
  isLocationDetailAnimating = false;
  currentPlanetPage = 1;
  readonly planetPageSize = 12;
  availableOreCodes: string[] = [];

  private oreLocationResultsByCode = new Map<string, OreLocationResult[]>();

  private miningLoadSubscription?: Subscription;
  private celestialLoadSubscription?: Subscription;
  private miningSearchDebounceTimer?: ReturnType<typeof setTimeout>;
  private locationSwitchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly oreLocationService: OreLocationService,
    private readonly celestialBodyService: CelestialBodyService
  ) {}

  ngOnInit(): void {
    this.loadCelestialBodies();
    this.loadMiningLocations();
  }

  ngOnDestroy(): void {
    if (this.miningLoadSubscription) {
      this.miningLoadSubscription.unsubscribe();
      this.miningLoadSubscription = undefined;
    }
    if (this.celestialLoadSubscription) {
      this.celestialLoadSubscription.unsubscribe();
      this.celestialLoadSubscription = undefined;
    }
    if (this.miningSearchDebounceTimer) {
      clearTimeout(this.miningSearchDebounceTimer);
      this.miningSearchDebounceTimer = undefined;
    }
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
      this.locationSwitchTimer = undefined;
    }
  }

  trackPlanetGroup(_: number, group: PlanetGroupCard): string {
    return group.key;
  }

  trackLocation(_: number, location: ParsedOreLocation): number {
    return location.id;
  }

  trackOreResult(_: number, row: OreLocationResult): string {
    return `${row.locationId}-${row.probability}`;
  }

  get sortedPlanetGroups(): PlanetGroupCard[] {
    const visibleLocations = this.parsedLocations.filter((location) => location.visibilityKind !== 'OTHER');
    const planetMap = new Map<string, PlanetGroupCard>();

    for (const planet of this.planets.filter((body) => body.bodyType === 'PLANET')) {
      const key = this.normalizeText(planet.name);
      planetMap.set(key, {
        key,
        planetName: planet.name,
        imageUrl: planet.imageUrl ?? null,
        locations: []
      });
    }

    for (const location of visibleLocations) {
      const key = this.normalizeText(location.groupPlanet);
      if (!planetMap.has(key)) {
        planetMap.set(key, {
          key,
          planetName: location.groupPlanet,
          imageUrl: this.findImageForPlanet(location.groupPlanet),
          locations: []
        });
      }
      planetMap.get(key)?.locations.push(location);
    }

    const groups = Array.from(planetMap.values()).sort((a, b) =>
      a.planetName.localeCompare(b.planetName, undefined, { sensitivity: 'base' })
    );

    for (const group of groups) {
      group.locations.sort((a, b) => {
        if (a.visibilityKind !== b.visibilityKind) {
          return a.visibilityKind === 'PLANET' ? -1 : 1;
        }
        return a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: 'base' });
      });
    }
    return groups;
  }

  get filteredPlanetGroups(): PlanetGroupCard[] {
    const search = this.normalizeText(this.miningSearch);
    if (!search) {
      return this.sortedPlanetGroups;
    }
    return this.sortedPlanetGroups
      .map((group) => this.filterGroupBySearch(group, search))
      .filter((group): group is PlanetGroupCard => group !== null);
  }

  get totalPlanetPages(): number {
    return Math.max(1, Math.ceil(this.filteredPlanetGroups.length / this.planetPageSize));
  }

  get pagedPlanetGroups(): PlanetGroupCard[] {
    const start = (this.currentPlanetPage - 1) * this.planetPageSize;
    return this.filteredPlanetGroups.slice(start, start + this.planetPageSize);
  }

  get selectedPlanetGroup(): PlanetGroupCard | null {
    if (!this.selectedPlanetKey) {
      return null;
    }
    return this.filteredPlanetGroups.find((group) => group.key === this.selectedPlanetKey) ?? null;
  }

  get selectedLocation(): ParsedOreLocation | null {
    const currentGroup = this.selectedPlanetGroup;
    if (!currentGroup || currentGroup.locations.length === 0) {
      return null;
    }
    if (this.selectedLocationId === null) {
      return currentGroup.locations[0];
    }
    return currentGroup.locations.find((location) => location.id === this.selectedLocationId) ?? currentGroup.locations[0];
  }

  get selectedLocationOres(): ParsedOreEntry[] {
    return this.selectedLocation?.ores ?? [];
  }

  get activeOreCode(): string | null {
    if (this.selectedOreCode) {
      return this.selectedOreCode;
    }
    const normalizedSearch = this.normalizeOreKey(this.miningSearch);
    if (!normalizedSearch) {
      return null;
    }
    const exactMatch = this.availableOreCodes.find((oreCode) => this.normalizeOreKey(oreCode) === normalizedSearch);
    return exactMatch ?? null;
  }

  get oreSuggestions(): string[] {
    if (this.activeOreCode) {
      return [];
    }
    const normalizedSearch = this.normalizeOreKey(this.miningSearch);
    if (!normalizedSearch) {
      return [];
    }
    return this.availableOreCodes
      .filter((oreCode) => this.normalizeOreKey(oreCode).includes(normalizedSearch))
      .sort((left, right) => {
        const leftNormalized = this.normalizeOreKey(left);
        const rightNormalized = this.normalizeOreKey(right);
        const leftStarts = leftNormalized.startsWith(normalizedSearch) ? 0 : 1;
        const rightStarts = rightNormalized.startsWith(normalizedSearch) ? 0 : 1;
        if (leftStarts !== rightStarts) {
          return leftStarts - rightStarts;
        }
        return left.localeCompare(right, undefined, { sensitivity: 'base' });
      })
      .slice(0, 8);
  }

  get activeOreResults(): OreLocationResult[] {
    const oreCode = this.activeOreCode;
    if (!oreCode) {
      return [];
    }
    return this.oreLocationResultsByCode.get(this.normalizeOreKey(oreCode)) ?? [];
  }

  get maxActiveOreProbability(): number {
    return this.activeOreResults.length ? this.activeOreResults[0].probability : 0;
  }

  formatPercent(value: number | null | undefined): string {
    const safeValue = Number(value ?? 0);
    return `${Math.round(safeValue * 100)}%`;
  }

  oreResultCount(oreCode: string): number {
    return this.oreLocationResultsByCode.get(this.normalizeOreKey(oreCode))?.length ?? 0;
  }

  selectOreSuggestion(oreCode: string): void {
    if (this.miningSearchDebounceTimer) {
      clearTimeout(this.miningSearchDebounceTimer);
      this.miningSearchDebounceTimer = undefined;
    }
    this.selectedOreCode = oreCode;
    this.miningSearch = oreCode;
    this.currentPlanetPage = 1;
    this.syncSelectedPlanet();
  }

  clearSelectedOre(): void {
    if (this.miningSearchDebounceTimer) {
      clearTimeout(this.miningSearchDebounceTimer);
      this.miningSearchDebounceTimer = undefined;
    }
    this.selectedOreCode = null;
    this.miningSearch = '';
    this.currentPlanetPage = 1;
    this.syncSelectedPlanet();
  }

  probabilityBarWidth(probability: number): string {
    if (!Number.isFinite(probability) || probability <= 0 || this.maxActiveOreProbability <= 0) {
      return '0%';
    }
    const raw = (probability / this.maxActiveOreProbability) * 100;
    const clamped = Math.min(100, Math.max(8, raw));
    return `${clamped}%`;
  }

  focusOreResult(result: OreLocationResult): void {
    const targetGroup = this.filteredPlanetGroups.find((group) => group.locations.some((location) => location.id === result.locationId));
    if (!targetGroup) {
      return;
    }
    const groupIndex = this.filteredPlanetGroups.findIndex((group) => group.key === targetGroup.key);
    if (groupIndex >= 0) {
      this.currentPlanetPage = Math.floor(groupIndex / this.planetPageSize) + 1;
    }
    this.selectedPlanetKey = targetGroup.key;
    this.selectedLocationId = result.locationId;
  }

  updateMiningSearch(rawValue: string): void {
    const nextValue = rawValue ?? '';
    if (this.miningSearchDebounceTimer) {
      clearTimeout(this.miningSearchDebounceTimer);
    }
    this.miningSearchDebounceTimer = setTimeout(() => {
      this.miningSearch = nextValue;
      this.selectedOreCode = null;
      this.currentPlanetPage = 1;
      this.syncSelectedPlanet();
    }, 90);
  }

  selectPlanet(groupKey: string): void {
    if (this.selectedPlanetKey === groupKey) {
      this.selectedPlanetKey = null;
      this.selectedLocationId = null;
      return;
    }
    this.selectedPlanetKey = groupKey;
    this.syncSelectedLocation();
  }

  selectLocation(locationId: number): void {
    if (this.selectedLocationId === locationId) {
      return;
    }
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
      this.locationSwitchTimer = undefined;
    }
    this.isLocationDetailAnimating = true;
    this.locationSwitchTimer = setTimeout(() => {
      this.selectedLocationId = locationId;
      this.isLocationDetailAnimating = false;
      this.locationSwitchTimer = undefined;
    }, 140);
  }

  previousPlanetPage(): void {
    if (this.currentPlanetPage > 1) {
      this.currentPlanetPage -= 1;
      this.syncSelectedPlanet();
    }
  }

  nextPlanetPage(): void {
    if (this.currentPlanetPage < this.totalPlanetPages) {
      this.currentPlanetPage += 1;
      this.syncSelectedPlanet();
    }
  }

  private syncSelectedPlanet(): void {
    if (!this.selectedPlanetKey) {
      return;
    }
    const stillVisible = this.filteredPlanetGroups.find((group) => group.key === this.selectedPlanetKey);
    if (!stillVisible) {
      this.selectedPlanetKey = null;
      this.selectedLocationId = null;
      return;
    }
    this.syncSelectedLocation();
  }

  private syncSelectedLocation(): void {
    const currentGroup = this.selectedPlanetGroup;
    if (!currentGroup || currentGroup.locations.length === 0) {
      this.selectedLocationId = null;
      return;
    }
    const currentLocation = this.selectedLocationId
      ? currentGroup.locations.find((location) => location.id === this.selectedLocationId)
      : null;
    if (currentLocation) {
      return;
    }
    this.selectedLocationId = currentGroup.locations[0].id;
  }

  private loadMiningLocations(): void {
    if (this.miningLoaded || this.miningLoading) {
      return;
    }
    this.miningLoading = true;
    this.miningError = '';
    this.miningLoadSubscription = this.oreLocationService.listFrontLocations().subscribe({
      next: (response: ApiResponse<OreLocation[]>) => {
        this.parsedLocations = (response?.data ?? []).map((location) => this.toParsedLocation(location));
        this.rebuildOreSearchIndex();
        this.miningLoaded = true;
        this.miningLoading = false;
        this.syncSelectedPlanet();
      },
      error: () => {
        this.miningLoading = false;
        this.miningError = 'Impossible de charger les ore locations depuis le backend.';
      }
    });
  }

  private loadCelestialBodies(): void {
    this.celestialLoadSubscription = this.celestialBodyService.listFrontBodies().subscribe({
      next: (response: ApiResponse<CelestialBody[]>) => {
        this.planets = (response?.data ?? []).filter((body) => body.bodyType === 'PLANET');
      },
      error: () => {
        this.planets = [];
      }
    });
  }

  private toParsedLocation(location: OreLocation): ParsedOreLocation {
    const parsed = this.parseLocationCode(location.locationCode);
    const parsedOres = this.extractOres(location.ores ?? []);
    const oresText = parsedOres.map((ore) => ore.oreCode).join(' | ');

    return {
      id: location.id,
      displayLabel: parsed.displayLabel,
      visibilityKind: parsed.visibilityKind,
      groupPlanet: parsed.groupPlanet,
      ores: parsedOres,
      oresText
    };
  }

  private extractOres(ores: OreMix[]): ParsedOreEntry[] {
    const oreMap = new Map<string, ParsedOreEntry>();
    for (const ore of ores) {
      const code = (ore.oreCode ?? '').trim();
      if (!code || this.isIgnoredOreCode(code)) {
        continue;
      }
      const existing = oreMap.get(code);
      const probability = Number(ore.probability ?? 0);
      if (!existing || probability > existing.probability) {
        oreMap.set(code, { oreCode: code, probability });
      }
    }
    return Array.from(oreMap.values()).sort((left, right) => {
      if (left.probability !== right.probability) {
        return right.probability - left.probability;
      }
      return left.oreCode.localeCompare(right.oreCode, undefined, { sensitivity: 'base' });
    });
  }

  private parseLocationCode(rawCode: string): { displayLabel: string; groupPlanet: string; visibilityKind: 'PLANET' | 'LAGRANGE' | 'OTHER' } {
    const raw = (rawCode ?? '').trim();
    const upper = raw.toUpperCase();
    const aliasMap: Record<string, string> = {
      HUR: 'Hurston',
      ARC: 'ArcCorp',
      MIC: 'microTech',
      CRU: 'Crusader',
      PYR: 'Pyro'
    };

    const lagrangeMatch = upper.match(/(HUR|ARC|MIC|CRU|PYR)\s*[-_ ]?L([1-6])/);
    if (lagrangeMatch) {
      const planet = aliasMap[lagrangeMatch[1]] ?? lagrangeMatch[1];
      return {
        displayLabel: `${planet} L${lagrangeMatch[2]}`,
        groupPlanet: planet,
        visibilityKind: 'LAGRANGE'
      };
    }

    const bodyMatch = upper.match(/\b(HUR|ARC|MIC|CRU|PYR)\b/);
    if (bodyMatch) {
      const planet = aliasMap[bodyMatch[1]] ?? bodyMatch[1];
      return {
        displayLabel: planet,
        groupPlanet: planet,
        visibilityKind: 'PLANET'
      };
    }

    return {
      displayLabel: raw,
      groupPlanet: raw,
      visibilityKind: 'OTHER'
    };
  }

  private findImageForPlanet(planetName: string): string | null {
    const key = this.normalizeText(planetName);
    const match = this.planets.find((planet) => this.normalizeText(planet.name) === key);
    return match?.imageUrl ?? null;
  }

  private filterGroupBySearch(group: PlanetGroupCard, search: string): PlanetGroupCard | null {
    const planetMatches = this.normalizeText(group.planetName).includes(search);
    const filteredLocations = group.locations
      .map((location) => this.filterLocationBySearch(location, search, planetMatches))
      .filter((location): location is ParsedOreLocation => location !== null);

    if (!planetMatches && filteredLocations.length === 0) {
      return null;
    }

    return {
      ...group,
      locations: filteredLocations
    };
  }

  private filterLocationBySearch(location: ParsedOreLocation, search: string, planetMatches: boolean): ParsedOreLocation | null {
    if (planetMatches || this.normalizeText(location.displayLabel).includes(search)) {
      return location;
    }

    const filteredOres = location.ores.filter((ore) => this.normalizeText(ore.oreCode).includes(search));
    if (filteredOres.length === 0) {
      return null;
    }

    return {
      ...location,
      ores: filteredOres,
      oresText: filteredOres.map((ore) => ore.oreCode).join(' | ')
    };
  }

  private normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private isIgnoredOreCode(code: string): boolean {
    const normalized = this.normalizeText(code).replace(/\s+/g, '');
    return normalized === 'inertmaterial' || normalized === 'inertmaterials';
  }

  private rebuildOreSearchIndex(): void {
    const oreCodesByNormalized = new Map<string, string>();
    const oreResults = new Map<string, OreLocationResult[]>();

    for (const location of this.parsedLocations) {
      for (const ore of location.ores) {
        const normalized = this.normalizeOreKey(ore.oreCode);
        if (!normalized) {
          continue;
        }
        if (!oreCodesByNormalized.has(normalized)) {
          oreCodesByNormalized.set(normalized, ore.oreCode);
        }
        if (!oreResults.has(normalized)) {
          oreResults.set(normalized, []);
        }
        oreResults.get(normalized)?.push({
          locationId: location.id,
          displayLabel: location.displayLabel,
          groupPlanet: location.groupPlanet,
          visibilityKind: location.visibilityKind,
          probability: Number(ore.probability ?? 0)
        });
      }
    }

    for (const rows of oreResults.values()) {
      rows.sort((left, right) => {
        if (left.probability !== right.probability) {
          return right.probability - left.probability;
        }
        const planetSort = left.groupPlanet.localeCompare(right.groupPlanet, undefined, { sensitivity: 'base' });
        if (planetSort !== 0) {
          return planetSort;
        }
        return left.displayLabel.localeCompare(right.displayLabel, undefined, { sensitivity: 'base' });
      });
    }

    this.availableOreCodes = Array.from(oreCodesByNormalized.values())
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
    this.oreLocationResultsByCode = oreResults;
  }

  private normalizeOreKey(value: string): string {
    return this.normalizeText(value).replace(/\s+/g, '');
  }
}
