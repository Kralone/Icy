import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UexDatasetService, UexResourceSale } from '../../../../../../core/services/uex/uex-dataset.service';
import { ApiResponse } from '../../../../../../model/api-response.model';

interface ResourceSaleMaterial {
  displayName: string;
  bestSell: number | null;
  bestSellTerminal: string | null;
}

@Component({
  selector: 'front-resources-sales-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resources-sales-panel.component.html',
  styleUrl: './resources-sales-panel.component.css'
})
export class ResourcesSalesPanelComponent implements OnDestroy {
  readonly salesResourceNames: string[] = [
    'Ricite', 'Stileron', 'Savrilium', 'Quantanium', 'Lindinium', 'Bexalite', 'Taranite',
    'Diamond', 'Gold', 'Borase', 'Laranite', 'Beryl', 'Hephaestanite', 'Agricium',
    'Ice', 'Tungsten', 'Titanium', 'Torite', 'Iron', 'Quartz', 'Copper', 'Corundum',
    'Aluminum', 'Tin', 'Silicon'
  ];

  salesMaterials: ResourceSaleMaterial[] = [];
  salesLoading = false;
  salesLoaded = false;
  salesError = '';
  cargoScu = 32;
  private bestSellMin: number | null = null;
  private bestSellMax: number | null = null;
  private salesLoadSubscription?: Subscription;

  constructor(private readonly uexDatasetService: UexDatasetService) {
    this.loadSalesMaterials();
  }

  ngOnDestroy(): void {
    if (this.salesLoadSubscription) {
      this.salesLoadSubscription.unsubscribe();
      this.salesLoadSubscription = undefined;
    }
  }

  trackMaterial(_: number, material: ResourceSaleMaterial): string {
    return `${material.displayName}-${material.bestSell ?? 0}`;
  }

  formatUec(value: number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  formatUecWithUnit(value: number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }
    return `${this.formatUec(value)} aUEC`;
  }

  updateCargoScu(rawValue: string): void {
    const parsed = Number.parseInt(rawValue, 10);
    this.cargoScu = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }

  computeRevenue(bestSell: number | null): number | null {
    if (bestSell === null || bestSell <= 0) {
      return null;
    }
    return bestSell * this.cargoScu;
  }

  bestSellPriceStyle(bestSell: number | null): { [key: string]: string } {
    if (bestSell === null || bestSell <= 0) {
      return { color: 'rgba(191, 219, 254, 0.72)', borderColor: 'rgba(148, 163, 184, 0.3)' };
    }
    const score = this.getBestSellScore(bestSell);
    const hue = Math.round(8 + (112 * score));
    return { color: `hsl(${hue} 90% 72%)`, borderColor: `hsl(${hue} 80% 46% / 0.55)` };
  }

  revenueStyle(bestSell: number | null): { [key: string]: string } {
    if (bestSell === null || bestSell <= 0) {
      return { color: 'rgba(191, 219, 254, 0.72)', textShadow: 'none' };
    }
    const score = this.getBestSellScore(bestSell);
    const hue = Math.round(8 + (112 * score));
    return { color: `hsl(${hue} 95% 76%)`, textShadow: `0 0 10px hsl(${hue} 95% 62% / 0.35)` };
  }

  private loadSalesMaterials(): void {
    if (this.salesLoaded || this.salesLoading) {
      return;
    }
    this.salesLoading = true;
    this.salesError = '';
    this.salesLoadSubscription = this.uexDatasetService.listResourceSales(this.salesResourceNames).subscribe({
      next: (response: ApiResponse<UexResourceSale[]>) => {
        this.salesMaterials = (response?.data ?? []).map((item) => ({
          displayName: item.displayName,
          bestSell: item.bestSell,
          bestSellTerminal: item.bestSellTerminal
        }));
        this.refreshBestSellBounds();
        this.salesLoaded = true;
        this.salesLoading = false;
      },
      error: () => {
        this.salesLoading = false;
        this.salesError = 'Impossible de charger les prix de vente depuis le backend.';
      }
    });
  }

  private getBestSellScore(bestSell: number | null): number {
    if (bestSell === null || bestSell <= 0 || this.bestSellMin === null || this.bestSellMax === null) {
      return 0;
    }
    if (this.bestSellMax <= this.bestSellMin) {
      return 1;
    }
    return (bestSell - this.bestSellMin) / (this.bestSellMax - this.bestSellMin);
  }

  private refreshBestSellBounds(): void {
    const values = this.salesMaterials.map((m) => m.bestSell).filter((v): v is number => v !== null && v > 0);
    if (!values.length) {
      this.bestSellMin = null;
      this.bestSellMax = null;
      return;
    }
    this.bestSellMin = Math.min(...values);
    this.bestSellMax = Math.max(...values);
  }
}
