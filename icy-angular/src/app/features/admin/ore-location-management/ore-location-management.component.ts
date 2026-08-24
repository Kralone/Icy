
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OreLocation,
  OreLocationService,
  OreLocationUploadResult,
  OreMix
} from '../../../core/services/ore/ore-location.service';

@Component({
  selector: 'app-ore-location-management',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ore-location-management.component.html',
  styleUrl: './ore-location-management.component.css'
})
export class OreLocationManagementComponent implements OnInit {
  locations: OreLocation[] = [];
  filteredLocations: OreLocation[] = [];
  selectedLocation: OreLocation | null = null;

  search = '';
  loading = false;
  uploading = false;
  errorMessage = '';
  successMessage = '';
  currentPage = 1;
  readonly pageSize = 20;

  constructor(private readonly oreLocationService: OreLocationService) {}

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.oreLocationService.listAdminLocations().subscribe({
      next: (response) => {
        this.locations = [...(response?.data ?? [])];
        this.applyFilter();
        this.loading = false;
        if (this.filteredLocations.length > 0) {
          this.selectLocation(this.filteredLocations[0]);
        } else {
          this.selectedLocation = null;
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les ore locations.';
      }
    });
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  onUploadFile(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.errorMessage = 'Le fichier doit etre un JSON.';
      if (target) {
        target.value = '';
      }
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.oreLocationService.uploadAndReset(file).subscribe({
      next: (response) => {
        const result = response?.data as OreLocationUploadResult | null;
        const countLabel = result
          ? `${result.locationCount} locations / ${result.oreEntryCount} minerais`
          : 'upload termine';
        this.successMessage = `Reset effectue: ${countLabel}.`;
        this.uploading = false;
        if (target) {
          target.value = '';
        }
        this.loadLocations();
      },
      error: () => {
        this.uploading = false;
        this.errorMessage = 'Upload impossible. Verifie le JSON et reessaie.';
        if (target) {
          target.value = '';
        }
      }
    });
  }

  selectLocation(location: OreLocation): void {
    this.selectedLocation = location;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) {
      this.currentPage += 1;
    }
  }

  pagedLocations(): OreLocation[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLocations.slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLocations.length / this.pageSize));
  }

  topOres(location: OreLocation, limit = 4): OreMix[] {
    return [...(location.ores ?? [])]
      .sort((left, right) => {
        if (left.probability !== right.probability) {
          return right.probability - left.probability;
        }
        return left.oreCode.localeCompare(right.oreCode);
      })
      .slice(0, limit);
  }

  formatPercent(value: number | null | undefined): string {
    const safeValue = Number(value ?? 0);
    return `${Math.round(safeValue * 100)}%`;
  }

  private applyFilter(): void {
    const normalizedSearch = this.normalize(this.search);
    const source = [...this.locations].sort((left, right) => left.locationCode.localeCompare(right.locationCode));

    if (!normalizedSearch) {
      this.filteredLocations = source;
    } else {
      this.filteredLocations = source.filter((location) => {
        if (this.normalize(location.locationCode).includes(normalizedSearch)) {
          return true;
        }
        return (location.ores ?? []).some((ore) => this.normalize(ore.oreCode).includes(normalizedSearch));
      });
    }

    this.currentPage = 1;
    if (this.selectedLocation) {
      const stillVisible = this.filteredLocations.some((location) => location.id === this.selectedLocation?.id);
      if (!stillVisible) {
        this.selectedLocation = this.filteredLocations[0] ?? null;
      }
    }
  }

  private normalize(value: string): string {
    return (value ?? '').trim().toLowerCase();
  }
}
