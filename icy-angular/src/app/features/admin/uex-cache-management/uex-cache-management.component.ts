import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { UexDatasetDetail, UexDatasetService, UexDatasetSummary } from '../../../core/services/uex/uex-dataset.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-uex-cache-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './uex-cache-management.component.html'
})
export class UexCacheManagementComponent implements OnInit {
  datasets: UexDatasetSummary[] = [];
  selectedDatasetKey = '';
  selectedDetail: UexDatasetDetail | null = null;
  previewJson = '';

  loadingDatasets = false;
  loadingDetail = false;
  refreshingKey = '';
  error = '';
  success = '';

  constructor(private readonly uexDatasetService: UexDatasetService) {}

  ngOnInit(): void {
    this.loadDatasets();
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
    const apiMessage = error?.error?.messageDetail?.message;
    return typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : defaultMessage;
  }
}
