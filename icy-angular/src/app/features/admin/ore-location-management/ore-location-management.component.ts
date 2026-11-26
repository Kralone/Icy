import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OreLocation,
  OreLocationService,
  OreLocationUploadResult,
  OreMetricRange,
  OreMix
} from '../../../core/services/ore/ore-location.service';
import {
  ORE_ZONE_KIND_LABELS,
  OreZoneKind,
  formatOreName,
  parseOreZoneCode,
  sortOresByProbability
} from '../../../core/services/ore/ore-location-label';
import { CatalogIconComponent } from '../../../shared/catalog-icon/catalog-icon.component';

/** Zone de minage préparée pour l'affichage. */
export interface OreZoneRow {
  location: OreLocation;
  key: string;
  label: string;
  planet: string;
  kind: OreZoneKind;
  ores: OreMix[];
}

/** Classement d'un minerai : zones où il apparaît, de la plus fréquente à la moins fréquente. */
export interface OreRanking {
  code: string;
  name: string;
  zones: { row: OreZoneRow; ore: OreMix }[];
}

type KindFilter = 'ALL' | OreZoneKind;
type ViewMode = 'zones' | 'ores';

@Component({
  selector: 'app-ore-location-management',
  standalone: true,
  imports: [FormsModule, RouterLink, CatalogIconComponent],
  templateUrl: './ore-location-management.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ore-location-management.component.css'
})
export class OreLocationManagementComponent implements OnInit {
  rows: OreZoneRow[] = [];
  filteredRows: OreZoneRow[] = [];
  rankings: OreRanking[] = [];
  filteredRankings: OreRanking[] = [];
  expandedKey: string | null = null;

  search = '';
  kindFilter: KindFilter = 'ALL';
  viewMode: ViewMode = 'zones';
  loading = false;
  uploading = false;
  errorMessage = '';
  successMessage = '';
  currentPage = 1;
  readonly pageSize = 25;

  readonly kindFilters: { value: KindFilter; label: string }[] = [
    { value: 'ALL', label: 'Toutes' },
    { value: 'PLANET', label: 'Planètes' },
    { value: 'LAGRANGE', label: 'Points de Lagrange' },
    { value: 'OTHER', label: 'Lunes et sites' }
  ];
  readonly kindLabels = ORE_ZONE_KIND_LABELS;
  readonly oreName = formatOreName;

  constructor(private readonly oreLocationService: OreLocationService) {}

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.loading = true;
    this.errorMessage = '';
    this.oreLocationService.listAdminLocations().subscribe({
      next: (response) => {
        this.rows = (response?.data ?? []).map((location, index) => this.toRow(location, index));
        this.rankings = this.buildRankings(this.rows);
        this.loading = false;
        this.applyFilter();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les zones de minage.';
      }
    });
  }

  onUploadFile(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0] ?? null;
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.errorMessage = 'Le fichier doit être un JSON.';
      if (target) target.value = '';
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.oreLocationService.uploadAndReset(file).subscribe({
      next: (response) => {
        const result = response?.data as OreLocationUploadResult | null;
        this.successMessage = result
          ? `Import terminé : ${result.locationCount} zones et ${result.oreEntryCount} relevés de minerai remplacent les précédents.`
          : 'Import terminé.';
        this.uploading = false;
        if (target) target.value = '';
        this.loadLocations();
      },
      error: () => {
        this.uploading = false;
        this.errorMessage = 'Import impossible. Vérifiez le fichier JSON et réessayez ; les zones actuelles sont conservées.';
        if (target) target.value = '';
      }
    });
  }

  setKindFilter(filter: KindFilter): void {
    this.kindFilter = filter;
    this.applyFilter();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  toggleRow(row: OreZoneRow): void {
    this.expandedKey = this.expandedKey === row.key ? null : row.key;
  }

  /** Depuis le classement par minerai : ouvre la zone dans la vue par zone. */
  openZone(row: OreZoneRow): void {
    this.viewMode = 'zones';
    this.search = row.label;
    this.kindFilter = 'ALL';
    this.applyFilter();
    this.expandedKey = row.key;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) this.currentPage += 1;
  }

  pagedRows(): OreZoneRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  kindCount(filter: KindFilter): number {
    return filter === 'ALL' ? this.rows.length : this.rows.filter((row) => row.kind === filter).length;
  }

  get totalScans(): number {
    return this.rows.reduce((total, row) => total + (row.location.scans ?? 0), 0);
  }

  get latestUpdate(): { version: string | null; date: string | null } {
    const latest = [...this.rows].sort((a, b) => (Date.parse(b.location.updatedAt ?? '') || 0) - (Date.parse(a.location.updatedAt ?? '') || 0))[0];
    return { version: latest?.location.gameVersion ?? null, date: latest?.location.updatedAt ?? null };
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return 'Non renseigné';
    return `${Math.round(value * 100)} %`;
  }

  /** Concentration : les petites valeurs gardent une décimale pour rester lisibles. */
  formatConcentration(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    const pct = value * 100;
    return `${pct < 10 ? pct.toFixed(1).replace('.', ',') : Math.round(pct)} %`;
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  formatRange(range: OreMetricRange | null | undefined): string {
    if (!range || (range.min == null && range.med == null && range.max == null)) return 'Non renseigné';
    return `${this.formatNumber(range.min)} · ${this.formatNumber(range.med)} · ${this.formatNumber(range.max)}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'date inconnue';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR');
  }

  barWidth(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '0%';
    return `${Math.max(2, Math.min(100, value * 100))}%`;
  }

  private toRow(location: OreLocation, index: number): OreZoneRow {
    const parsed = parseOreZoneCode(location.locationCode);
    return {
      location,
      key: location.locationKey ?? (location.id != null ? `id:${location.id}` : `row:${index}`),
      label: parsed.displayLabel,
      planet: parsed.groupPlanet,
      kind: parsed.kind,
      ores: sortOresByProbability(location)
    };
  }

  private buildRankings(rows: OreZoneRow[]): OreRanking[] {
    const byCode = new Map<string, OreRanking>();
    for (const row of rows) {
      for (const ore of row.ores) {
        const ranking = byCode.get(ore.oreCode) ?? { code: ore.oreCode, name: formatOreName(ore.oreCode), zones: [] };
        ranking.zones.push({ row, ore });
        byCode.set(ore.oreCode, ranking);
      }
    }
    const rankings = [...byCode.values()];
    rankings.forEach((ranking) => ranking.zones.sort((a, b) => (b.ore.probability ?? -1) - (a.ore.probability ?? -1)));
    return rankings.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  private applyFilter(): void {
    const search = this.normalize(this.search);
    const byKind = (row: OreZoneRow) => this.kindFilter === 'ALL' || row.kind === this.kindFilter;
    const matches = (row: OreZoneRow) => !search
      || this.normalize(row.label).includes(search)
      || this.normalize(row.location.locationCode).includes(search)
      || row.ores.some((ore) => this.normalize(ore.oreCode).includes(search));

    this.filteredRows = this.rows
      .filter((row) => byKind(row) && matches(row))
      .sort((a, b) => a.planet.localeCompare(b.planet, 'fr') || a.label.localeCompare(b.label, 'fr', { numeric: true }));

    this.filteredRankings = this.rankings
      .map((ranking) => ({
        ...ranking,
        zones: ranking.zones.filter(({ row }) => byKind(row))
      }))
      .filter((ranking) => ranking.zones.length && (!search
        || this.normalize(ranking.code).includes(search)
        || ranking.zones.some(({ row }) => this.normalize(row.label).includes(search))));

    this.currentPage = 1;
    if (this.expandedKey && !this.filteredRows.some((row) => row.key === this.expandedKey)) {
      this.expandedKey = null;
    }
  }

  private normalize(value: string): string {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  }
}
