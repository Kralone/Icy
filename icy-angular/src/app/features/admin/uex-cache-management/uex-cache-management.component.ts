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

@Component({
  selector: 'app-uex-cache-management',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './uex-cache-management.component.html'
})
export class UexCacheManagementComponent implements OnInit, OnDestroy {
  datasets: UexDatasetSummary[] = [];
  selectedDatasetKey = '';
  selectedDetail: UexDatasetDetail | null = null;
  previewJson = '';

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
    { value: 'ECONOMY', label: 'Achats, ventes et locations' },
    { value: 'WIKELO', label: 'Wikelo' }
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
      'Scraper toutes les sources externes ? Cette action met uniquement a jour la zone brute et ne mappe pas le catalogue.'
    );
    if (!confirmed) return;

    this.startingCatalogAction = true;
    this.clearMessages();
    this.uexDatasetService.scrapeAllCatalogSources().subscribe({
      next: (response) => {
        this.catalogRun = response?.data ?? null;
        this.startingCatalogAction = false;
        this.success = 'Scrape complet demarre en arriere-plan. Aucune table catalogue ne sera mappee.';
        this.scheduleCatalogPoll();
      },
      error: (error: HttpErrorResponse) => {
        this.startingCatalogAction = false;
        this.error = this.extractHttpErrorMessage('Impossible de demarrer le scrape complet.', error);
      }
    });
  }

  scrapeAndMap(): void {
    const label = this.mapScopes.find((scope) => scope.value === this.selectedMapScope)?.label ?? this.selectedMapScope;
    const confirmed = window.confirm(`Scraper puis mapper uniquement : ${label} ?`);
    if (!confirmed) return;

    this.startingCatalogAction = true;
    this.clearMessages();
    this.uexDatasetService.scrapeAndMapCatalogScope(this.selectedMapScope).subscribe({
      next: (response) => {
        this.catalogRun = response?.data ?? null;
        this.startingCatalogAction = false;
        this.success = `Scrape et mapping demarres pour : ${label}.`;
        this.scheduleCatalogPoll();
      },
      error: (error: HttpErrorResponse) => {
        this.startingCatalogAction = false;
        this.error = this.extractHttpErrorMessage('Impossible de demarrer le scrape et mapping.', error);
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

  loadDatasets(): void {
    this.loadingDatasets = true;
    this.clearMessages();
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
        this.error = this.extractHttpErrorMessage(`Aucune data en base pour "${datasetKey}". Clique sur refresh pour initialiser.`, error);
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
        this.success = `Dataset "${datasetKey}" rafraichi et ecrase en base.`;
        this.refreshingKey = '';
        this.loadDatasets();
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.extractHttpErrorMessage(`Echec du refresh pour "${datasetKey}".`, error);
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

  private extractHttpErrorMessage(defaultMessage: string, error?: HttpErrorResponse): string {
    const apiMessage = error?.error?.messageDetail?.message ?? error?.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : defaultMessage;
  }
}
