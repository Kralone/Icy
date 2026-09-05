import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CatalogMapScope,
  CatalogSyncRun,
  UexDatasetDetail,
  UexDatasetService,
  UexDatasetSummary
} from '../../../core/services/uex/uex-dataset.service';
import { HttpErrorResponse } from '@angular/common/http';

type DatasetCategory = 'UNIVERSE' | 'VEHICLES' | 'EQUIPMENT' | 'ECONOMY' | 'ORGANIZATIONS';

type DatasetPresentation = {
  title: string;
  category: DatasetCategory;
  description: string;
  imageUrl: string;
};

type PreviewRecord = Record<string, unknown>;

const CATEGORY_LABELS: Record<DatasetCategory, string> = {
  UNIVERSE: 'Univers',
  VEHICLES: 'Vaisseaux',
  EQUIPMENT: 'Equipement',
  ECONOMY: 'Economie',
  ORGANIZATIONS: 'Organisations'
};

const CATEGORY_IMAGES: Record<DatasetCategory, string> = {
  UNIVERSE: 'https://media.starcitizen.tools/e/e7/MicroTech-4.3.jpg',
  VEHICLES: 'https://media.starcitizen.tools/thumb/e/e2/SC_MultiShip_Roles.jpg/800px-SC_MultiShip_Roles.jpg.webp',
  EQUIPMENT: 'https://media.starcitizen.tools/6/6d/ItemBankRM.png',
  ECONOMY: 'https://media.starcitizen.tools/thumb/d/d3/Comm-Link-Orion_Mining.jpg/1200px-Comm-Link-Orion_Mining.jpg.webp',
  ORGANIZATIONS: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png'
};

const DATASET_PRESENTATIONS: Record<string, Omit<DatasetPresentation, 'imageUrl'>> = {
  categories: { title: 'Categories d\'objets', category: 'EQUIPMENT', description: 'Familles utilisees pour classer les objets.' },
  categories_attributes: { title: 'Attributs des categories', category: 'EQUIPMENT', description: 'Caracteristiques disponibles par famille d\'objets.' },
  cities: { title: 'Villes', category: 'UNIVERSE', description: 'Villes et zones urbaines visitables.' },
  commodities: { title: 'Marchandises', category: 'ECONOMY', description: 'Ressources et marchandises negociables.' },
  commodities_prices: { title: 'Prix des marchandises', category: 'ECONOMY', description: 'Cours d\'achat et de vente par terminal.' },
  companies: { title: 'Entreprises', category: 'ORGANIZATIONS', description: 'Fabricants, marques et organisations.' },
  items_prices: { title: 'Prix des equipements', category: 'ECONOMY', description: 'Points de vente et tarifs des objets.' },
  jump_points: { title: 'Points de saut', category: 'UNIVERSE', description: 'Passages entre les systemes stellaires.' },
  moons: { title: 'Lunes', category: 'UNIVERSE', description: 'Satellites naturels repertories.' },
  orbits: { title: 'Orbites', category: 'UNIVERSE', description: 'Zones orbitales et leurs relations.' },
  outposts: { title: 'Avant-postes', category: 'UNIVERSE', description: 'Sites planetaires et installations isolees.' },
  planets: { title: 'Planetes', category: 'UNIVERSE', description: 'Mondes connus et leurs proprietes.' },
  poi: { title: 'Points d\'interet', category: 'UNIVERSE', description: 'Lieux remarquables et destinations utiles.' },
  refineries_audits: { title: 'Audits des raffineries', category: 'ECONOMY', description: 'Etat et controles des installations.' },
  refineries_capacities: { title: 'Capacites de raffinage', category: 'ECONOMY', description: 'Capacites disponibles par raffinerie.' },
  refineries_methods: { title: 'Methodes de raffinage', category: 'ECONOMY', description: 'Procedures, couts et durees de traitement.' },
  refineries_yields: { title: 'Rendements des raffineries', category: 'ECONOMY', description: 'Rendements par ressource et installation.' },
  space_stations: { title: 'Stations spatiales', category: 'UNIVERSE', description: 'Stations, ports orbitaux et relais.' },
  star_systems: { title: 'Systemes stellaires', category: 'UNIVERSE', description: 'Structure generale des systemes connus.' },
  terminals: { title: 'Terminaux commerciaux', category: 'ECONOMY', description: 'Commerces, kiosques et points de transaction.' },
  vehicles: { title: 'Vaisseaux et vehicules', category: 'VEHICLES', description: 'Catalogue des appareils et constructeurs.' },
  vehicles_prices: { title: 'Prix indicatifs des vehicules', category: 'VEHICLES', description: 'Valeurs de reference des appareils.' },
  vehicles_purchases_prices: { title: 'Achat de vehicules', category: 'VEHICLES', description: 'Concessionnaires et prix d\'achat.' },
  vehicles_rentals_prices: { title: 'Location de vehicules', category: 'VEHICLES', description: 'Loueurs, tarifs et durees disponibles.' }
};

@Component({
  selector: 'app-uex-cache-management',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './uex-cache-management.component.html',
  styleUrl: './uex-cache-management.component.css'
})
export class UexCacheManagementComponent implements OnInit, OnDestroy {
  datasets: UexDatasetSummary[] = [];
  selectedDatasetKey = '';
  selectedDetail: UexDatasetDetail | null = null;
  previewJson = '';
  datasetQuery = '';
  selectedDatasetCategory: DatasetCategory | 'ALL' = 'ALL';
  showRawJson = false;

  loadingDatasets = false;
  loadingDetail = false;
  refreshingKey = '';
  error = '';
  success = '';
  selectedMapScope: CatalogMapScope = 'VEHICLES';
  catalogRun: CatalogSyncRun | null = null;
  startingCatalogAction = false;
  readonly mapScopes: Array<{ value: CatalogMapScope; label: string }> = [
    { value: 'VEHICLES', label: 'Vaisseaux et vehicules' },
    { value: 'ITEMS', label: 'Armes, armures, modules et outils' },
    { value: 'LOCATIONS', label: 'Systemes, planetes, villes et stations' },
    { value: 'ECONOMY', label: 'Prix, achats, ventes et locations' },
    { value: 'WIKELO', label: 'Wikelo' }
  ];
  readonly datasetCategories: Array<{ value: DatasetCategory | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Tout' },
    ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as DatasetCategory, label }))
  ];
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private catalogPollHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly uexDatasetService: UexDatasetService) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.loadCatalogSyncStatus();
  }

  ngOnDestroy(): void {
    this.stopCatalogPolling();
  }

  scrapeAll(): void {
    const confirmed = window.confirm(
      'Telecharger a nouveau toutes les sources ? Les donnees brutes seront remplacees, mais le catalogue visible ne changera pas.'
    );
    if (!confirmed) return;

    this.startingCatalogAction = true;
    this.clearMessages();
    this.uexDatasetService.scrapeAllCatalogSources().subscribe({
      next: (response) => {
        this.catalogRun = response?.data ?? null;
        this.startingCatalogAction = false;
        this.success = 'Mise a jour de toutes les sources lancee. Le catalogue visible ne sera pas modifie.';
        this.scheduleCatalogPoll();
      },
      error: (error: HttpErrorResponse) => {
        this.startingCatalogAction = false;
        this.error = this.extractHttpErrorMessage('Impossible de lancer la mise a jour des sources.', error);
      }
    });
  }

  scrapeAndMap(): void {
    const label = this.mapScopes.find((scope) => scope.value === this.selectedMapScope)?.label ?? this.selectedMapScope;
    const confirmed = window.confirm(`Mettre a jour les sources puis publier cette categorie dans le catalogue : ${label} ?`);
    if (!confirmed) return;

    this.startingCatalogAction = true;
    this.clearMessages();
    this.uexDatasetService.scrapeAndMapCatalogScope(this.selectedMapScope).subscribe({
      next: (response) => {
        this.catalogRun = response?.data ?? null;
        this.startingCatalogAction = false;
        this.success = `Mise a jour et publication lancees pour : ${label}.`;
        this.scheduleCatalogPoll();
      },
      error: (error: HttpErrorResponse) => {
        this.startingCatalogAction = false;
        this.error = this.extractHttpErrorMessage('Impossible de lancer la mise a jour de cette categorie.', error);
      }
    });
  }

  onMapScopeChange(value: string): void {
    if (this.mapScopes.some((scope) => scope.value === value)) {
      this.selectedMapScope = value as CatalogMapScope;
    }
  }

  get catalogRunActive(): boolean {
    return this.catalogRun?.status === 'QUEUED' || this.catalogRun?.status === 'RUNNING';
  }

  get catalogProgressPercent(): number {
    const total = this.catalogRun?.totalSteps ?? 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round(((this.catalogRun?.currentStep ?? 0) / total) * 100));
  }

  get filteredDatasets(): UexDatasetSummary[] {
    const query = this.datasetQuery.trim().toLocaleLowerCase('fr');
    return this.datasets.filter((dataset) => {
      const presentation = this.datasetPresentation(dataset.datasetKey);
      const categoryMatches = this.selectedDatasetCategory === 'ALL' || presentation.category === this.selectedDatasetCategory;
      const queryMatches = !query || `${presentation.title} ${presentation.description} ${dataset.datasetKey}`.toLocaleLowerCase('fr').includes(query);
      return categoryMatches && queryMatches;
    });
  }

  get synchronizedDatasetCount(): number {
    return this.datasets.filter((dataset) => !!dataset.fetchedAt).length;
  }

  get totalDatasetItems(): number {
    return this.datasets.reduce((total, dataset) => total + (dataset.itemCount || 0), 0);
  }

  get previewRecords(): PreviewRecord[] {
    const payload = this.selectedDetail?.previewPayload;
    const rows = Array.isArray(payload)
      ? payload
      : this.isRecord(payload) && Array.isArray(payload['data'])
        ? payload['data']
        : payload === null || payload === undefined
          ? []
          : [payload];
    return rows.filter((row): row is PreviewRecord => this.isRecord(row)).slice(0, 12);
  }

  get selectedPresentation(): DatasetPresentation | null {
    return this.selectedDetail ? this.datasetPresentation(this.selectedDetail.datasetKey) : null;
  }

  datasetPresentation(datasetKey: string): DatasetPresentation {
    const presentation = DATASET_PRESENTATIONS[datasetKey] ?? {
      title: this.humanizeKey(datasetKey),
      category: 'UNIVERSE' as DatasetCategory,
      description: 'Donnees externes disponibles pour inspection.'
    };
    return { ...presentation, imageUrl: CATEGORY_IMAGES[presentation.category] };
  }

  categoryLabel(category: DatasetCategory): string {
    return CATEGORY_LABELS[category];
  }

  setDatasetCategory(value: DatasetCategory | 'ALL'): void {
    this.selectedDatasetCategory = value;
  }

  onDatasetQuery(value: string): void {
    this.datasetQuery = value;
  }

  catalogRunStatusLabel(): string {
    const labels: Record<CatalogSyncRun['status'], string> = {
      QUEUED: 'En attente', RUNNING: 'En cours', SUCCEEDED: 'Termine', FAILED: 'Echec'
    };
    return this.catalogRun ? labels[this.catalogRun.status] : '';
  }

  catalogRunOperationLabel(): string {
    if (!this.catalogRun) return '';
    if (this.catalogRun.operation === 'SCRAPE_ALL') return 'Mise a jour de toutes les sources';
    const scope = this.mapScopes.find((item) => item.value === this.catalogRun?.scope)?.label ?? this.catalogRun.scope;
    return `Mise a jour et publication · ${scope}`;
  }

  recordTitle(record: PreviewRecord, index: number): string {
    for (const key of ['name', 'display_name', 'nickname', 'label', 'code', 'slug']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return `Enregistrement ${index + 1}`;
  }

  recordFields(record: PreviewRecord): Array<{ label: string; value: string }> {
    return Object.entries(record)
      .filter(([key, value]) => !this.isImageKey(key) && this.isDisplayableValue(value))
      .slice(0, 5)
      .map(([key, value]) => ({ label: this.humanizeKey(key), value: this.formatValue(value) }));
  }

  recordImage(record: PreviewRecord): string | null {
    for (const key of ['screenshot', 'image_url', 'image', 'thumbnail_url', 'thumbnail']) {
      const value = record[key];
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
    }
    return null;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/images/catalog/catalog-fallback.svg')) {
      image.src = '/assets/images/catalog/catalog-fallback.svg';
    }
  }

  loadDatasets(clearMessages = true): void {
    this.loadingDatasets = true;
    if (clearMessages) this.clearMessages();
    this.uexDatasetService.listDatasets().subscribe({
      next: (response) => {
        this.datasets = response?.data ?? [];
        this.loadingDatasets = false;
        if (!this.selectedDatasetKey && this.datasets.length > 0) {
          this.selectDataset(this.datasets[0].datasetKey);
        }
      },
      error: () => {
        this.loadingDatasets = false;
        this.error = this.extractHttpErrorMessage('Impossible de charger les datasets UEX.');
      }
    });
  }

  selectDataset(datasetKey: string): void {
    this.selectedDatasetKey = datasetKey;
    this.loadingDetail = true;
    this.showRawJson = false;
    this.clearMessages();
    this.uexDatasetService.getDataset(datasetKey).subscribe({
      next: (response) => {
        this.selectedDetail = response?.data ?? null;
        this.previewJson = this.formatPreviewJson(this.selectedDetail?.previewPayload);
        this.loadingDetail = false;
      },
      error: (error: HttpErrorResponse) => {
        this.selectedDetail = null;
        this.previewJson = '';
        this.loadingDetail = false;
        this.error = this.extractHttpErrorMessage(`Aucune donnee en base pour "${datasetKey}". Utilise « Actualiser cette source » pour l'initialiser.`, error);
      }
    });
  }

  refreshDataset(datasetKey: string): void {
    this.refreshingKey = datasetKey;
    this.clearMessages();
    this.uexDatasetService.refreshDataset(datasetKey).subscribe({
      next: (response) => {
        const refreshed = response?.data ?? null;
        if (refreshed) {
          this.selectedDatasetKey = refreshed.datasetKey;
          this.selectedDetail = refreshed;
          this.previewJson = this.formatPreviewJson(refreshed.previewPayload);
        }
        this.success = `La source « ${this.datasetPresentation(datasetKey).title} » a ete actualisee.`;
        this.refreshingKey = '';
        this.loadDatasets(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.extractHttpErrorMessage(`Echec de l'actualisation de « ${this.datasetPresentation(datasetKey).title} ».`, error);
        this.refreshingKey = '';
      }
    });
  }

  trackDataset(_: number, dataset: UexDatasetSummary): string {
    return dataset.datasetKey;
  }

  private loadCatalogSyncStatus(): void {
    this.uexDatasetService.getCurrentCatalogSync().subscribe({
      next: (response) => {
        this.catalogRun = response?.data ?? null;
        if (this.catalogRunActive) this.scheduleCatalogPoll();
      }
    });
  }

  private scheduleCatalogPoll(): void {
    this.stopCatalogPolling();
    if (!this.isBrowser || !this.catalogRunActive) return;
    this.catalogPollHandle = setTimeout(() => {
      this.uexDatasetService.getCurrentCatalogSync().subscribe({
        next: (response) => {
          this.catalogRun = response?.data ?? null;
          if (this.catalogRunActive) {
            this.scheduleCatalogPoll();
          } else if (this.catalogRun?.status === 'SUCCEEDED') {
            this.success = this.catalogRun.message || 'Traitement catalogue termine.';
            this.loadDatasets();
          } else if (this.catalogRun?.status === 'FAILED') {
            this.error = this.catalogRun.errorMessage || 'Le traitement catalogue a echoue.';
          }
        },
        error: () => this.scheduleCatalogPoll()
      });
    }, 2500);
  }

  private stopCatalogPolling(): void {
    if (this.catalogPollHandle !== null) {
      clearTimeout(this.catalogPollHandle);
      this.catalogPollHandle = null;
    }
  }

  private clearMessages(): void {
    this.error = '';
    this.success = '';
  }

  private formatPreviewJson(payload: unknown): string {
    if (payload === null || payload === undefined) {
      return '';
    }
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return '';
    }
  }

  private humanizeKey(value: string): string {
    const normalized = value.replace(/_/g, ' ').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : value;
  }

  private isRecord(value: unknown): value is PreviewRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isImageKey(key: string): boolean {
    return ['screenshot', 'image_url', 'image', 'thumbnail_url', 'thumbnail'].includes(key);
  }

  private isDisplayableValue(value: unknown): boolean {
    return value === null || ['string', 'number', 'boolean'].includes(typeof value);
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
  }

  private extractHttpErrorMessage(defaultMessage: string, error?: HttpErrorResponse): string {
    const apiMessage = error?.error?.messageDetail?.message ?? error?.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : defaultMessage;
  }
}
