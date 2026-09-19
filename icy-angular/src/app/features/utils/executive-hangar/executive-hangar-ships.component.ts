import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ShipService } from '../../../core/services/ship/ship.service';
import { Ship } from '../../../model/ship.model';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';

/** Matches the published PYAM classification without confusing other Executive editions. */
export function isExecutiveHangarShip(ship: Ship): boolean {
  if (ship.catalogGroup) return ship.catalogGroup === 'PYAM_EXEC';
  return /\bPYAM\s+Exec$/i.test(ship.name.trim());
}
const PYAM_IMAGE_FALLBACKS: Record<string, string> = {
  'hornet f7a mk ii': '/assets/images/catalog/pyam/hornet-f7a-mk2.webp',
  meteor: '/assets/images/catalog/pyam/meteor.webp',
  syulen: '/assets/images/catalog/pyam/syulen.webp'
};

@Component({
  standalone: true,
  selector: 'app-executive-hangar-ships',
  imports: [FormsModule, AsyncStateComponent],
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

  constructor(private shipService: ShipService) {}

  ngOnInit(): void { this.loadShips(); }

  loadShips(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.shipService.getAllShips().pipe(finalize(() => this.isLoading = false)).subscribe({
      next: response => {
        const allShips = response.data ?? [];
        const baseByName = new Map(allShips.map(ship => [this.baseName(ship.name), ship]));
        this.ships = allShips.filter(isExecutiveHangarShip).map(ship => {
          if (ship.imageUrl && !ship.imageUrl.includes('fallback')) return ship;
          const key = this.baseName(ship.name);
          const local = PYAM_IMAGE_FALLBACKS[key];
          const base = local ? undefined : (baseByName.get(key) ?? this.findCatalogBase(ship, allShips));
          return base?.imageUrl ? { ...ship, imageUrl: base.imageUrl } : PYAM_IMAGE_FALLBACKS[key] ? { ...ship, imageUrl: PYAM_IMAGE_FALLBACKS[key] } : ship;
        })
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

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private baseName(value: string): string {
    return this.normalize(value).replace(/\s+pyam\s+exec$/i, '').replace(/\s+/g, ' ');
  }

  private findCatalogBase(ship: Ship, allShips: Ship[]): Ship | undefined {
    const tokens = this.baseName(ship.name).split(' ').filter(token => token.length > 2 && !['pyam', 'exec'].includes(token));
    return allShips.filter(candidate => candidate !== ship && candidate.imageUrl && !candidate.imageUrl.includes('fallback'))
      .map(candidate => ({ candidate, score: tokens.filter(token => this.normalize(candidate.name).includes(token)).length }))
      .sort((a, b) => b.score - a.score)[0]?.candidate;
  }
}
