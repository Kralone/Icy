import { Component, HostListener, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ShipService } from '../../../core/services/ship/ship.service';
import { Ship } from '../../../model/ship.model';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';

/** Matches the published PYAM classification without confusing other Executive editions. */
export function isExecutiveHangarShip(ship: Ship): boolean {
  if (ship.executiveHangar !== undefined) return ship.executiveHangar;
  if (ship.catalogGroup) return ship.catalogGroup === 'PYAM_EXEC';
  return /\bPYAM\s+Exec$/i.test(ship.name.trim());
}

@Component({
  standalone: true,
  selector: 'app-executive-hangar-ships',
  imports: [CommonModule, FormsModule, AsyncStateComponent],
  templateUrl: './executive-hangar-ships.component.html',
  styleUrl: './executive-hangar-ships.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class ExecutiveHangarShipsComponent implements OnInit {
  ships: Ship[] = [];
  searchTerm = '';
  isLoading = true;
  errorMessage = '';
  failedImages = new Set<string>();
  zoomedShip: Ship | null = null;
  imageZoom = 1;

  constructor(private shipService: ShipService) {}

  ngOnInit(): void { this.loadShips(); }

  loadShips(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.shipService.getAllShips().pipe(finalize(() => this.isLoading = false)).subscribe({
      next: response => {
        const allShips = response.data ?? [];
        this.ships = allShips.filter(isExecutiveHangarShip)
          .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
      },
      error: () => { this.errorMessage = 'Impossible de charger les vaisseaux du hangar.'; }
    });
  }

  get filteredShips(): Ship[] {
    const query = this.normalize(this.searchTerm);
    return this.ships.filter(ship => !query || this.normalize(`${ship.name} ${ship.brand?.name ?? ''}`).includes(query));
  }

  imageFor(ship: Ship): string | null {
    const image = ship.imageUrl;
    if (!image || this.failedImages.has(image) || image.includes('/catalog-fallback.')) return null;
    return image;
  }

  imageFailed(image: string): void { this.failedImages.add(image); }

  openImage(ship: Ship): void {
    if (!this.imageFor(ship)) return;
    this.zoomedShip = ship;
    this.imageZoom = 1;
  }

  closeImage(): void {
    this.zoomedShip = null;
    this.imageZoom = 1;
  }

  zoomImage(delta: number): void {
    this.imageZoom = Math.min(3.5, Math.max(1, Number((this.imageZoom + delta).toFixed(2))));
  }

  resetImageZoom(): void { this.imageZoom = 1; }

  @HostListener('document:keydown.escape')
  closeImageOnEscape(): void {
    if (this.zoomedShip) this.closeImage();
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

}

