
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { OrbitalStation, OrbitalStationService } from '../../../../../../core/services/station/orbital-station.service';
import { UexDatasetService, UexRefineryDatasets } from '../../../../../../core/services/uex/uex-dataset.service';
import { ApiResponse } from '../../../../../../model/api-response.model';

type RawRow = Record<string, unknown>;

interface YieldRow {
  stationName: string;
  commodity: string;
  yieldPct: number | null;
}

interface RefineryCommodityYield {
  commodity: string;
  bestYieldPct: number | null;
}

interface RefinerySummaryRow {
  key: string;
  stationName: string;
  imageUrl: string | null;
  oresCount: number;
  yields: RefineryCommodityYield[];
}

@Component({
  selector: 'front-resources-refining-panel',
  standalone: true,
  imports: [],
  templateUrl: './resources-refining-panel.component.html',
  styleUrl: './resources-refining-panel.component.css'
})
export class ResourcesRefiningPanelComponent implements OnInit, OnDestroy {
  loading = false;
  error = '';

  refineries: RefinerySummaryRow[] = [];
  searchQuery = '';
  expandedRefineryKey: string | null = null;
  yieldsFetchedAt: string | null = null;
  searchAnimating = false;

  private loadSubscription?: Subscription;
  private stationLoadSubscription?: Subscription;
  private stationImageByKey = new Map<string, string>();
  private searchAnimationTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly uexDatasetService: UexDatasetService,
    private readonly orbitalStationService: OrbitalStationService
  ) {}

  ngOnInit(): void {
    this.loadStationImages();
    this.loadRefineryDatasets();
  }

  ngOnDestroy(): void {
    if (this.loadSubscription) {
      this.loadSubscription.unsubscribe();
      this.loadSubscription = undefined;
    }
    if (this.stationLoadSubscription) {
      this.stationLoadSubscription.unsubscribe();
      this.stationLoadSubscription = undefined;
    }
    if (this.searchAnimationTimer) {
      clearTimeout(this.searchAnimationTimer);
      this.searchAnimationTimer = undefined;
    }
  }

  trackRefinery(_: number, row: RefinerySummaryRow): string {
    return row.key;
  }

  trackYield(_: number, row: RefineryCommodityYield): string {
    return `${row.commodity}-${row.bestYieldPct ?? -1}`;
  }

  toggleRefinery(row: RefinerySummaryRow): void {
    this.expandedRefineryKey = this.expandedRefineryKey === row.key ? null : row.key;
  }

  isExpanded(row: RefinerySummaryRow): boolean {
    return this.expandedRefineryKey === row.key;
  }

  updateSearch(rawValue: string): void {
    this.searchQuery = rawValue ?? '';
    this.syncExpandedWithFilter();
    this.pulseSearchAnimation();
  }

  get filteredRefineries(): RefinerySummaryRow[] {
    const query = this.normalizeText(this.searchQuery);
    if (!query) {
      return this.refineries;
    }

    return this.refineries.filter((row) => {
      if (this.normalizeText(row.stationName).includes(query)) {
        return true;
      }
      return row.yields.some((yieldRow) => this.normalizeText(yieldRow.commodity).includes(query));
    });
  }

  yieldDeltaLeft(value: number | null): string {
    if (value === null || !Number.isFinite(value) || value === 0) {
      return '50%';
    }
    if (value > 0) {
      return '50%';
    }
    const clamped = Math.max(-50, value);
    return `${50 + clamped}%`;
  }

  yieldDeltaWidth(value: number | null): string {
    if (value === null || !Number.isFinite(value) || value === 0) {
      return '0%';
    }
    const clamped = Math.min(50, Math.abs(value));
    return `${clamped}%`;
  }

  yieldDeltaTone(value: number | null): 'neg' | 'pos' | 'neu' {
    if (value === null || !Number.isFinite(value) || value === 0) {
      return 'neu';
    }
    return value < 0 ? 'neg' : 'pos';
  }

  formatNumber(value: number | null, suffix = ''): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }
    const rendered = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
    return suffix ? `${rendered}${suffix}` : rendered;
  }

  formatDate(value: string): string {
    if (!value) {
      return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString('fr-FR');
  }

  private loadStationImages(): void {
    this.stationLoadSubscription = this.orbitalStationService.listFrontStations().subscribe({
      next: (response: ApiResponse<OrbitalStation[]>) => {
        this.stationImageByKey.clear();
        for (const station of response?.data ?? []) {
          if (!station?.name || !station?.imageUrl) {
            continue;
          }
          this.stationImageByKey.set(this.normalizeKey(station.name), station.imageUrl);
        }
        this.applyStationImages();
      },
      error: () => {
        this.stationImageByKey.clear();
      }
    });
  }

  private loadRefineryDatasets(): void {
    this.loading = true;
    this.error = '';

    this.loadSubscription = this.uexDatasetService.listRefineryDatasets().subscribe({
      next: (response: ApiResponse<UexRefineryDatasets>) => {
        const data = response?.data;
        const yields = this.toRawRows(data?.yields);

        this.refineries = this.buildRefinerySummaries(this.toYieldRows(yields));
        this.applyStationImages();
        this.expandedRefineryKey = null;
        this.yieldsFetchedAt = data?.yieldsFetchedAt ?? null;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les datasets raffineries.';
        this.loading = false;
      }
    });
  }

  private toYieldRows(rows: RawRow[]): YieldRow[] {
    return rows
      .map((row) => ({
        stationName: this.extractStationName(row),
        commodity: this.sanitizeCommodity(this.pickString(row, ['commodity_name', 'commodity', 'resource', 'ore'])),
        yieldPct: this.pickNumber(row, ['value', 'yield', 'yield_pct', 'yield_percent', 'recovery'])
      }))
      .filter((row) => !!row.stationName && !!row.commodity);
  }

  private buildRefinerySummaries(yieldsRows: YieldRow[]): RefinerySummaryRow[] {
    const byKey = new Map<string, RefinerySummaryRow>();
    const commodityMapByRefinery = new Map<string, Map<string, RefineryCommodityYield>>();

    for (const row of yieldsRows) {
      const stationName = row.stationName.trim();
      const refineryKey = this.normalizeKey(stationName);
      if (!refineryKey) {
        continue;
      }

      if (!byKey.has(refineryKey)) {
        byKey.set(refineryKey, {
          key: refineryKey,
          stationName,
          imageUrl: null,
          oresCount: 0,
          yields: []
        });
      }

      const commodityKey = this.normalizeKey(row.commodity);
      if (!commodityKey) {
        continue;
      }
      if (!commodityMapByRefinery.has(refineryKey)) {
        commodityMapByRefinery.set(refineryKey, new Map<string, RefineryCommodityYield>());
      }
      const commodityMap = commodityMapByRefinery.get(refineryKey)!;
      const existing = commodityMap.get(commodityKey);
      if (!existing) {
        commodityMap.set(commodityKey, {
          commodity: row.commodity,
          bestYieldPct: row.yieldPct
        });
        continue;
      }

      const existingValue = existing.bestYieldPct ?? -999;
      const candidateValue = row.yieldPct ?? -999;
      if (candidateValue > existingValue) {
        existing.bestYieldPct = row.yieldPct;
      }
    }

    const summaries = Array.from(byKey.values());
    for (const summary of summaries) {
      const commodityMap = commodityMapByRefinery.get(summary.key);
      const yields = commodityMap ? Array.from(commodityMap.values()) : [];
      yields.sort((a, b) => (b.bestYieldPct ?? -999) - (a.bestYieldPct ?? -999));
      summary.yields = yields;
      summary.oresCount = yields.length;
    }

    summaries.sort((a, b) => a.stationName.localeCompare(b.stationName, undefined, { sensitivity: 'base' }));
    return summaries;
  }

  private applyStationImages(): void {
    if (!this.refineries.length || !this.stationImageByKey.size) {
      return;
    }
    this.refineries = this.refineries.map((row) => ({
      ...row,
      imageUrl: this.findStationImage(row.stationName)
    }));
  }

  private findStationImage(stationName: string): string | null {
    const exact = this.stationImageByKey.get(this.normalizeKey(stationName));
    if (exact) {
      return exact;
    }
    const target = this.normalizeKey(stationName);
    for (const [nameKey, imageUrl] of this.stationImageByKey.entries()) {
      if (nameKey.includes(target) || target.includes(nameKey)) {
        return imageUrl;
      }
    }
    return null;
  }

  private extractStationName(row: RawRow): string {
    const directStation = this.pickString(row, ['space_station_name', 'station_name', 'space_station', 'station']);
    if (directStation) {
      return this.sanitizeRefineryName(directStation);
    }

    const terminal = this.pickString(row, ['terminal_name', 'refinery_name', 'refinery']);
    if (terminal) {
      return this.sanitizeRefineryName(terminal);
    }

    const orbit = this.pickString(row, ['orbit_name', 'city_name', 'moon_name', 'planet_name']);
    return this.sanitizeRefineryName(orbit);
  }

  private sanitizeRefineryName(value: string): string {
    if (!value) {
      return '';
    }
    const withoutPrefix = value
      .replace(/refin(?:e)?ment\s*center\s*-\s*/gi, '')
      .replace(/refin(?:e)?ment\s*processing\s*-\s*/gi, '')
      .replace(/refin(?:e)?ment\s*center/gi, '')
      .replace(/refin(?:e)?ment\s*processing/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return withoutPrefix;
  }

  private sanitizeCommodity(value: string): string {
    if (!value) {
      return '';
    }
    return value
      .replace(/\s*\(Raw\)\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private toRawRows(value: unknown): RawRow[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((row): row is RawRow => !!row && typeof row === 'object' && !Array.isArray(row));
  }

  private pickString(row: RawRow, candidates: string[]): string {
    const key = this.findKey(row, candidates);
    if (!key) {
      return '';
    }
    const raw = row[key];
    if (raw === null || raw === undefined) {
      return '';
    }
    return String(raw).trim();
  }

  private pickNumber(row: RawRow, candidates: string[]): number | null {
    const key = this.findKey(row, candidates);
    if (!key) {
      return null;
    }
    const raw = row[key];
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  private findKey(row: RawRow, candidates: string[]): string | null {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const direct = keys.find((k) => k === candidate);
      if (direct) {
        return direct;
      }
      const loose = keys.find((k) => this.normalizeKey(k) === this.normalizeKey(candidate));
      if (loose) {
        return loose;
      }
    }
    return null;
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private syncExpandedWithFilter(): void {
    if (!this.expandedRefineryKey) {
      return;
    }
    const stillVisible = this.filteredRefineries.some((row) => row.key === this.expandedRefineryKey);
    if (!stillVisible) {
      this.expandedRefineryKey = null;
    }
  }

  private pulseSearchAnimation(): void {
    if (this.searchAnimationTimer) {
      clearTimeout(this.searchAnimationTimer);
      this.searchAnimationTimer = undefined;
    }
    this.searchAnimating = true;
    this.searchAnimationTimer = setTimeout(() => {
      this.searchAnimating = false;
      this.searchAnimationTimer = undefined;
    }, 220);
  }
}
