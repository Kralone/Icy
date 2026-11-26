
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { OreLocation, OreLocationService, OreMix } from '../../../../../../core/services/ore/ore-location.service';
import { formatOreName, OrePlaceKind, resolveOrePlace } from '../../../../../../core/services/ore/ore-location-label';
import { AsyncStateComponent } from '../../../../../../shared/async-state/async-state.component';
import { ApiResponse } from '../../../../../../model/api-response.model';
import { CatalogLocationImage, CelestialBody, CelestialBodyService } from '../../../../../../core/services/celestial/celestial-body.service';

interface ParsedOreLocation {
  key: string;
  displayLabel: string;
  /** Onglet dans la fiche de la planète : « Surface », nom de la lune, « L1 », ceinture. */
  tabLabel: string;
  visibilityKind: OrePlaceKind;
  groupPlanet: string;
  systemName: string | null;
  /** Rattachée à une planète ; sinon lieu isolé (base, station, amas) trouvable seulement par la recherche. */
  listed: boolean;
  ores: ParsedOreEntry[];
  oresText: string;
  sourceUrl: string | null;
  gameVersion: string | null;
  updatedAt: string | null;
}

interface ParsedOreEntry extends OreMix {
  oreCode: string;
  probability: number | null;
}

interface PlanetGroupCard {
  key: string;
  planetName: string;
  imageUrl: string | null;
  /** Système de l'astre d'après le catalogue ; null s'il n'y figure pas. */
  systemName: string | null;
  /** Lieu isolé : absent de la barre des astres, affiché seulement depuis la recherche. */
  hidden: boolean;
  locations: ParsedOreLocation[];
}

interface OreLocationResult {
  locationKey: string;
  displayLabel: string;
  groupPlanet: string;
  /** Rattachement affiché sous le nom : « Lune de Crusader · Stanton », « Lieu de minage ». */
  context: string;
  probability: number | null;
}

/** Ordre des planètes dans leur système ; les autres suivent par ordre alphabétique. */
const PLANET_ORDER = ['Hurston', 'Crusader', 'ArcCorp', 'microTech', 'Pyro I', 'Monox', 'Bloom', 'Pyro IV', 'Pyro V', 'Terminus'];
const ZONE_ORDER: Record<OrePlaceKind, number> = { PLANET: 0, MOON: 1, BELT: 2, LAGRANGE: 3, OTHER: 4 };

@Component({
  selector: 'front-resources-mining-panel',
  standalone: true,
  imports: [AsyncStateComponent],
  templateUrl: './resources-mining-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './resources-mining-panel.component.css'
})
export class ResourcesMiningPanelComponent implements OnInit, OnDestroy {
  parsedLocations: ParsedOreLocation[] = [];
  private rawLocations: OreLocation[] = [];
  planets: CelestialBody[] = [];
  catalogLocations: CatalogLocationImage[] = [];

  miningLoading = false;
  miningLoaded = false;
  miningError = '';
  miningSearch = '';
  selectedOreCode: string | null = null;

  selectedPlanetKey: string | null = null;
  selectedLocationKey: string | null = null;
  isLocationDetailAnimating = false;
  currentPlanetPage = 1;
  readonly planetPageSize = 12;
  availableOreCodes: string[] = [];

  private oreLocationResultsByCode = new Map<string, OreLocationResult[]>();
  /** Résultats des accesseurs coûteux, recalculés seulement quand leurs entrées changent de référence. */
  private readonly memoCache = new Map<string, { deps: readonly unknown[]; value: unknown }>();

  private miningLoadSubscription?: Subscription;
  private celestialLoadSubscription?: Subscription;
  private catalogLoadSubscription?: Subscription;
  private miningSearchDebounceTimer?: ReturnType<typeof setTimeout>;
  private locationSwitchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly oreLocationService: OreLocationService,
    private readonly celestialBodyService: CelestialBodyService
  ) {}

  ngOnInit(): void {
    this.catalogLoadSubscription = this.celestialBodyService.listFrontLocationImages().subscribe({
      next: response => {
        this.catalogLocations = response.data ?? [];
        this.reparseLocations();
      },
      error: () => this.catalogLocations = []
    });
    this.loadCelestialBodies();
    this.loadMiningLocations();
  }

  ngOnDestroy(): void {
    this.catalogLoadSubscription?.unsubscribe();
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

  trackLocation(_: number, location: ParsedOreLocation): string {
    return location.key;
  }

  trackOreResult(_: number, row: OreLocationResult): string {
    return `${row.locationKey}-${row.probability}`;
  }

  /**
   * Le gabarit lit ces accesseurs des centaines de fois par rafraîchissement (chaque astre, chaque ligne).
   * Sans cache, chaque lecture reconstruisait toute la liste et la page se figeait avec les données réelles.
   */
  private memo<T>(key: string, deps: readonly unknown[], compute: () => T): T {
    const hit = this.memoCache.get(key);
    if (hit && hit.deps.length === deps.length && hit.deps.every((dep, index) => dep === deps[index])) {
      return hit.value as T;
    }
    const value = compute();
    this.memoCache.set(key, { deps, value });
    return value;
  }

  /** Index nom normalisé → image et système, construit une fois par chargement. */
  private get placeIndex(): Map<string, { imageUrl: string | null; systemName: string | null }> {
    return this.memo('placeIndex', [this.planets, this.catalogLocations], () => {
      // Même priorité qu'avant : première image du catalogue, sinon celle de l'astre ; système de l'astre d'abord.
      const firstCatalog = new Map<string, CatalogLocationImage>();
      for (const row of this.catalogLocations) {
        const key = this.normalizeText(row.name);
        if (!firstCatalog.has(key)) firstCatalog.set(key, row);
      }
      const firstPlanet = new Map<string, CelestialBody>();
      for (const planet of this.planets) {
        const key = this.normalizeText(planet.name);
        if (!firstPlanet.has(key)) firstPlanet.set(key, planet);
      }
      const index = new Map<string, { imageUrl: string | null; systemName: string | null }>();
      for (const key of new Set([...firstCatalog.keys(), ...firstPlanet.keys()])) {
        const row = firstCatalog.get(key);
        const planet = firstPlanet.get(key);
        index.set(key, {
          imageUrl: row?.imageUrl || planet?.imageUrl || null,
          systemName: planet?.systemName ?? row?.systemName ?? null
        });
      }
      return index;
    });
  }

  get sortedPlanetGroups(): PlanetGroupCard[] {
    return this.memo('sortedPlanetGroups', [this.parsedLocations, this.planets, this.catalogLocations], () => this.buildPlanetGroups());
  }

  private buildPlanetGroups(): PlanetGroupCard[] {
    const planetMap = new Map<string, PlanetGroupCard>();
    const isolated: PlanetGroupCard[] = [];

    for (const location of this.parsedLocations) {
      if (!location.listed) {
        isolated.push({
          key: `lieu:${location.key}`,
          planetName: location.displayLabel,
          imageUrl: this.findImageForPlanet(location.displayLabel),
          systemName: location.systemName,
          hidden: true,
          locations: [location]
        });
        continue;
      }
      const key = this.normalizeText(location.groupPlanet);
      if (!planetMap.has(key)) {
        planetMap.set(key, {
          key,
          planetName: location.groupPlanet,
          imageUrl: this.findImageForPlanet(location.groupPlanet),
          systemName: location.systemName ?? this.findSystemFor(location.groupPlanet),
          hidden: false,
          locations: []
        });
      }
      planetMap.get(key)?.locations.push(location);
    }

    const byName = (a: PlanetGroupCard, b: PlanetGroupCard) => a.planetName.localeCompare(b.planetName, undefined, { sensitivity: 'base' });
    const planets = Array.from(planetMap.values()).sort((a, b) => this.planetRank(a.planetName) - this.planetRank(b.planetName) || byName(a, b));
    for (const group of planets) {
      group.locations.sort((a, b) =>
        ZONE_ORDER[a.visibilityKind] - ZONE_ORDER[b.visibilityKind]
        || a.tabLabel.localeCompare(b.tabLabel, undefined, { sensitivity: 'base', numeric: true }));
    }
    return [...planets, ...isolated.sort(byName)];
  }

  private planetRank(name: string): number {
    const index = PLANET_ORDER.findIndex((planet) => this.normalizeText(planet) === this.normalizeText(name));
    return index < 0 ? PLANET_ORDER.length : index;
  }

  get filteredPlanetGroups(): PlanetGroupCard[] {
    const sorted = this.sortedPlanetGroups;
    return this.memo('filteredPlanetGroups', [sorted, this.miningSearch], () => {
      const search = this.normalizeText(this.miningSearch);
      if (!search) {
        return sorted;
      }
      return sorted
        .map((group) => this.filterGroupBySearch(group, search))
        .filter((group): group is PlanetGroupCard => group !== null);
    });
  }

  get totalPlanetPages(): number {
    return Math.max(1, Math.ceil(this.filteredPlanetGroups.length / this.planetPageSize));
  }

  get pagedPlanetGroups(): PlanetGroupCard[] {
    const start = (this.currentPlanetPage - 1) * this.planetPageSize;
    return this.filteredPlanetGroups.slice(start, start + this.planetPageSize);
  }

  /** Astres qui ont au moins une zone, rangés par système pour la barre de sélection. */
  get systemGroups(): { system: string; groups: PlanetGroupCard[] }[] {
    const filtered = this.filteredPlanetGroups;
    return this.memo('systemGroups', [filtered], () => {
      const bySystem = new Map<string, PlanetGroupCard[]>();
      for (const group of filtered.filter((candidate) => !candidate.hidden && candidate.locations.length)) {
        const system = group.systemName || 'Autres';
        bySystem.set(system, [...(bySystem.get(system) ?? []), group]);
      }
      return [...bySystem.entries()]
        .sort(([a], [b]) => this.systemRank(a) - this.systemRank(b) || a.localeCompare(b))
        .map(([system, groups]) => ({ system, groups }));
    });
  }

  /** Stanton d'abord, puis les autres systèmes ; les astres hors catalogue en dernier. */
  private systemRank(system: string): number {
    return system === 'Stanton' ? 0 : system === 'Autres' ? 2 : 1;
  }

  /** Astre affiché : celui choisi, sinon le premier qui a des zones. */
  get selectedPlanetGroup(): PlanetGroupCard | null {
    const groups = this.filteredPlanetGroups;
    const chosen = this.selectedPlanetKey ? groups.find((group) => group.key === this.selectedPlanetKey) : null;
    return chosen ?? this.systemGroups[0]?.groups[0] ?? null;
  }

  /** Lieux isolés dont le nom correspond à la recherche : bases, stations, amas. */
  get matchingPlaces(): PlanetGroupCard[] {
    const filtered = this.filteredPlanetGroups;
    return this.memo('matchingPlaces', [filtered, this.miningSearch], () => {
      const search = this.normalizeText(this.miningSearch);
      if (search.length < 2) return [];
      return filtered.filter((group) => group.hidden && this.normalizeText(group.planetName).includes(search));
    });
  }

  oreBarWidth(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '0%';
    return `${Math.max(2, Math.min(100, value * 100))}%`;
  }

  formatConcentration(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    const pct = value * 100;
    return `${pct < 10 ? pct.toFixed(1).replace('.', ',') : Math.round(pct)} %`;
  }

  /** Zone issue des fichiers du jeu (API Star Citizen Wiki) plutôt que d'un relevé importé. */
  isGameData(location: ParsedOreLocation): boolean {
    return location.key.startsWith('wiki:');
  }

  get hasMedian(): boolean {
    return this.selectedLocationOres.some((ore) => ore.medPct != null);
  }

  get hasClusters(): boolean {
    return this.selectedLocationOres.some((ore) => ore.clusterMax != null);
  }

  formatConcentrationRange(min: number | null | undefined, max: number | null | undefined): string {
    if (min == null && max == null) return '—';
    if (min == null || max == null || min === max) return this.formatConcentration(min ?? max);
    return `${this.formatConcentration(min).replace(' %', '')} – ${this.formatConcentration(max)}`;
  }

  formatCluster(ore: OreMix): string {
    if (ore.clusterMax == null) return '—';
    const min = ore.clusterMin ?? ore.clusterMax;
    return min === ore.clusterMax ? `${min} rochers` : `${min} à ${ore.clusterMax} rochers`;
  }

  clusterTitle(ore: OreMix): string | null {
    return ore.clusterProbability == null ? null : `Apparaît en amas dans ${this.formatPercent(ore.clusterProbability)} des cas`;
  }

  oreName(code: string): string {
    return formatOreName(code);
  }

  get selectedLocation(): ParsedOreLocation | null {
    const currentGroup = this.selectedPlanetGroup;
    if (!currentGroup || currentGroup.locations.length === 0) {
      return null;
    }
    if (this.selectedLocationKey === null) {
      return currentGroup.locations[0];
    }
    return currentGroup.locations.find((location) => location.key === this.selectedLocationKey) ?? currentGroup.locations[0];
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
    return this.activeOreResults.length ? (this.activeOreResults[0].probability ?? 0) : 0;
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return 'Non renseigné';
    const safeValue = value;
    return `${(safeValue * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
  }

  formatSourceDate(value: string | null): string {
    if (!value) return 'date non renseignée';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR');
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
    this.miningSearch = formatOreName(oreCode);
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

  probabilityBarWidth(probability: number | null): string {
    if (probability == null || !Number.isFinite(probability) || probability <= 0 || this.maxActiveOreProbability <= 0) {
      return '0%';
    }
    const raw = (probability / this.maxActiveOreProbability) * 100;
    const clamped = Math.min(100, Math.max(8, raw));
    return `${clamped}%`;
  }

  focusOreResult(result: OreLocationResult): void {
    const targetGroup = this.filteredPlanetGroups.find((group) => group.locations.some((location) => location.key === result.locationKey));
    if (!targetGroup) {
      return;
    }
    const groupIndex = this.filteredPlanetGroups.findIndex((group) => group.key === targetGroup.key);
    if (groupIndex >= 0) {
      this.currentPlanetPage = Math.floor(groupIndex / this.planetPageSize) + 1;
    }
    this.selectedPlanetKey = targetGroup.key;
    this.selectedLocationKey = result.locationKey;
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
      this.selectedLocationKey = null;
      return;
    }
    this.selectedPlanetKey = groupKey;
    this.syncSelectedLocation();
  }

  selectLocation(locationKey: string): void {
    if (this.selectedLocationKey === locationKey) {
      return;
    }
    if (this.locationSwitchTimer) {
      clearTimeout(this.locationSwitchTimer);
      this.locationSwitchTimer = undefined;
    }
    this.isLocationDetailAnimating = true;
    this.locationSwitchTimer = setTimeout(() => {
      this.selectedLocationKey = locationKey;
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
      this.selectedLocationKey = null;
      return;
    }
    this.syncSelectedLocation();
  }

  private syncSelectedLocation(): void {
    const currentGroup = this.selectedPlanetGroup;
    if (!currentGroup || currentGroup.locations.length === 0) {
      this.selectedLocationKey = null;
      return;
    }
    const currentLocation = this.selectedLocationKey
      ? currentGroup.locations.find((location) => location.key === this.selectedLocationKey)
      : null;
    if (currentLocation) {
      return;
    }
    this.selectedLocationKey = currentGroup.locations[0].key;
  }

  private loadMiningLocations(): void {
    if (this.miningLoaded || this.miningLoading) {
      return;
    }
    this.miningLoading = true;
    this.miningError = '';
    this.miningLoadSubscription = this.oreLocationService.listFrontLocations().subscribe({
      next: (response: ApiResponse<OreLocation[]>) => {
        this.rawLocations = response?.data ?? [];
        this.reparseLocations();
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
        // Planètes et lunes : les lunes servent à rattacher leurs zones à la bonne planète.
        this.planets = response?.data ?? [];
        this.reparseLocations();
      },
      error: () => {
        this.planets = [];
      }
    });
  }

  /** Situe à nouveau les zones quand les astres du catalogue arrivent après elles. */
  private reparseLocations(): void {
    this.parsedLocations = this.rawLocations.map((location) => this.toParsedLocation(location));
    this.rebuildOreSearchIndex();
    this.syncSelectedPlanet();
  }

  private toParsedLocation(location: OreLocation): ParsedOreLocation {
    const place = resolveOrePlace(location.locationCode, this.planets);
    const parsedOres = this.extractOres(location.ores ?? []);
    const oresText = parsedOres.map((ore) => ore.oreCode).join(' | ');

    return {
      key: location.locationKey ?? (location.id != null ? `manual:${location.id}` : `legacy:${location.sourceUrl ?? ''}:${location.locationCode}`),
      displayLabel: place.label,
      tabLabel: place.tabLabel,
      visibilityKind: place.kind,
      groupPlanet: place.planet ?? place.label,
      systemName: place.system ?? this.findSystemFor(place.label),
      listed: place.planet != null,
      ores: parsedOres,
      oresText,
      sourceUrl: location.sourceUrl ?? null,
      gameVersion: location.gameVersion ?? null,
      updatedAt: location.updatedAt ?? null
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
      const probability = ore.probability ?? null;
      if (!existing || (probability ?? -1) > (existing.probability ?? -1)) {
        oreMap.set(code, { ...ore, oreCode: code, probability });
      }
    }
    return Array.from(oreMap.values()).sort((left, right) => {
      if (left.probability !== right.probability) {
        return (right.probability ?? -1) - (left.probability ?? -1);
      }
      return left.oreCode.localeCompare(right.oreCode, undefined, { sensitivity: 'base' });
    });
  }

  private findSystemFor(name: string): string | null {
    return this.placeIndex.get(this.normalizeText(name))?.systemName ?? null;
  }

  private findImageForPlanet(planetName: string): string | null {
    return this.placeIndex.get(this.normalizeText(planetName))?.imageUrl ?? null;
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

    // La zone garde tous ses minerais : celui recherché est mis en évidence dans le tableau.
    return location.ores.some((ore) => this.normalizeText(ore.oreCode).includes(search)) ? location : null;
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
          locationKey: location.key,
          displayLabel: location.displayLabel,
          groupPlanet: location.groupPlanet,
          context: this.placeContext(location),
          probability: ore.probability
        });
      }
    }

    for (const rows of oreResults.values()) {
      rows.sort((left, right) => {
        if (left.probability !== right.probability) {
          return (right.probability ?? -1) - (left.probability ?? -1);
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

  private placeContext(location: ParsedOreLocation): string {
    const system = location.systemName ? ` · ${location.systemName}` : '';
    switch (location.visibilityKind) {
      case 'PLANET': return `Planète${system}`;
      case 'MOON': return `Lune de ${location.groupPlanet}${system}`;
      case 'LAGRANGE': return `Point de Lagrange de ${location.groupPlanet}`;
      case 'BELT': return `Ceinture · ${location.groupPlanet}`;
      default: return `Lieu de minage${system}`;
    }
  }

  private normalizeOreKey(value: string): string {
    return this.normalizeText(value).replace(/\s+/g, '');
  }
}
