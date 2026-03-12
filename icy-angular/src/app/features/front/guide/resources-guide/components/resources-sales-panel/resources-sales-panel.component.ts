import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UexDatasetService, UexResourceSale, UexResourceSalePoint } from '../../../../../../core/services/uex/uex-dataset.service';
import { ApiResponse } from '../../../../../../model/api-response.model';

interface ResourceSaleMaterial {
  displayName: string;
  bestSell: number | null;
  bestSellTerminal: string | null;
  salePoints: UexResourceSalePoint[];
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
  readonly locationShortcuts: string[] = ['Orison', 'Area 18', 'New Babbage', 'Lorville', 'Levski', 'Ruin Station'];
  locationSearchTerm = '';
  selectedLocation: string | null = null;
  locationSuggestions: string[] = [];
  private saleLocations: string[] = [];
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

  updateLocationSearch(rawValue: string): void {
    this.locationSearchTerm = rawValue ?? '';
    this.selectedLocation = null;
    this.locationSuggestions = this.filterLocationSuggestions(this.locationSearchTerm);
  }

  selectLocation(location: string): void {
    this.selectedLocation = location;
    this.locationSearchTerm = location;
    this.locationSuggestions = [];
  }

  selectLocationShortcut(location: string): void {
    this.selectLocation(location);
  }

  isSelectedLocationShortcut(location: string): boolean {
    if (!this.selectedLocation) {
      return false;
    }
    return this.normalizeSearchKey(this.selectedLocation) === this.normalizeSearchKey(location);
  }

  resetLocation(): void {
    this.locationSearchTerm = '';
    this.selectedLocation = null;
    this.locationSuggestions = [];
  }

  computeRevenue(bestSell: number | null): number | null {
    if (bestSell === null || bestSell <= 0) {
      return null;
    }
    return bestSell * this.cargoScu;
  }

  selectedLocationLabel(): string {
    return this.selectedLocation || 'Lieu choisi';
  }

  selectedLocationSell(material: ResourceSaleMaterial): number | null {
    if (!this.selectedLocation) {
      return null;
    }
    const selectedKey = this.normalizeSearchKey(this.selectedLocation);
    const exactMatch = material.salePoints.find((point) => this.normalizeSearchKey(point.terminalName) === selectedKey);
    if (exactMatch && exactMatch.sellPrice > 0) {
      return exactMatch.sellPrice;
    }
    const partialMatches = material.salePoints
      .filter((point) => this.normalizeSearchKey(point.terminalName).includes(selectedKey))
      .map((point) => point.sellPrice)
      .filter((price) => price > 0);
    if (!partialMatches.length) {
      return null;
    }
    return Math.max(...partialMatches);
  }

  selectedLocationDelta(material: ResourceSaleMaterial): number | null {
    const selectedSell = this.selectedLocationSell(material);
    if (selectedSell === null || material.bestSell === null) {
      return null;
    }
    return selectedSell - material.bestSell;
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
          bestSellTerminal: item.bestSellTerminal,
          salePoints: item.salePoints ?? []
        }));
        this.refreshSaleLocations();
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

  private refreshSaleLocations(): void {
    const unique = new Set<string>();
    for (const material of this.salesMaterials) {
      for (const salePoint of material.salePoints) {
        const label = salePoint.terminalName?.trim();
        if (label) {
          unique.add(label);
        }
      }
    }
    this.saleLocations = Array.from(unique).sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
    if (!this.locationSearchTerm.trim()) {
      this.locationSuggestions = [];
      return;
    }
    this.locationSuggestions = this.filterLocationSuggestions(this.locationSearchTerm);
  }

  private filterLocationSuggestions(search: string): string[] {
    const term = this.normalizeSearchKey(search);
    if (!term) {
      return this.saleLocations.slice(0, 10);
    }
    return this.saleLocations
      .filter((location) => this.normalizeSearchKey(location).includes(term))
      .slice(0, 10);
  }

  private normalizeSearchKey(value: string): string {
    return (value || '').trim().toLowerCase();
  }
}
