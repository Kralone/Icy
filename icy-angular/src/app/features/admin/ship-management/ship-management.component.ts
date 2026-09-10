import { Component, HostListener, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShipService } from '../../../core/services/ship/ship.service';
@Component({
  selector: 'app-ship-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './ship-management.component.html',
})
export class ShipManagementComponent implements OnInit {
  // === Ships ===
  ships: any[] = [];
  shipSearch = '';
  showInGameDeletionDialog = false;
  isDeletingInGameAcquisitions = false;
  inGameDeletionError = '';
  inGameDeletionResult = '';

  // === Brands ===
  brands: any[] = [];
  newBrand = { name: '', imageUrl: '' };
  isSubmittingBrand = false;
  editingBrand: any | null = null;

  // === Pagination ===
  shipPage = 1;
  brandPage = 1;
  itemsPerPage = 10;

  constructor(private shipService: ShipService) {}

  ngOnInit() {
    this.loadShips();
    this.loadBrands();
  }

  // 🛸 Ships
  loadShips() {
    this.shipService.getAllShips().subscribe({
      next: (res) => {
        this.ships = res.data || []; // ✅ on extrait la liste de la réponse
        this.updateShipPagination();
      },
      error: (err) => console.error('Erreur chargement vaisseaux', err),
    });
  }


  openInGameDeletionDialog() {
    this.inGameDeletionError = '';
    this.inGameDeletionResult = '';
    this.showInGameDeletionDialog = true;
  }

  closeInGameDeletionDialog() {
    if (this.isDeletingInGameAcquisitions) return;
    this.showInGameDeletionDialog = false;
    this.inGameDeletionError = '';
  }

  confirmInGameDeletion() {
    if (this.isDeletingInGameAcquisitions) return;

    this.isDeletingInGameAcquisitions = true;
    this.inGameDeletionError = '';
    this.shipService.deleteAllInGameAcquisitions().subscribe({
      next: (response) => {
        const deletedCount = Number(response?.data ?? 0);
        this.isDeletingInGameAcquisitions = false;
        this.showInGameDeletionDialog = false;
        this.inGameDeletionResult = `${deletedCount} acquisition(s) ou récompense(s) en jeu supprimée(s).`;
      },
      error: (err) => {
        console.error('Erreur suppression des acquisitions en jeu', err);
        this.isDeletingInGameAcquisitions = false;
        this.inGameDeletionError = 'La suppression a échoué. Aucune nouvelle tentative automatique ne sera effectuée.';
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showInGameDeletionDialog) {
      this.closeInGameDeletionDialog();
    }
  }

  // 🏷 Brands
  loadBrands() {
    this.shipService.getAllBrandsWithImages().subscribe({
      next: (res) => {
        this.brands = res.data || [];
        this.updateBrandPagination();
      },
      error: (err) => console.error('Erreur chargement marques', err),
    });
  }


  createOrUpdateBrand() {
    if (this.isSubmittingBrand) return;
    this.isSubmittingBrand = true;

    const req = this.editingBrand
      ? this.shipService.updateBrand(this.editingBrand.name, this.newBrand)
      : this.shipService.createBrand(this.newBrand);

    req.subscribe({
      next: () => {
        this.isSubmittingBrand = false;
        this.resetBrandForm();
        this.loadBrands();
      },
      error: (err) => {
        console.error('Erreur création/mise à jour marque', err);
        this.isSubmittingBrand = false;
      },
    });
  }

  editBrand(brand: any) {
    this.editingBrand = brand;
    this.newBrand = { ...brand };
  }

  deleteBrand(name: string) {
    if (!confirm(`Supprimer la marque "${name}" ?`)) return;
    this.shipService.deleteBrand(name).subscribe({
      next: () => this.loadBrands(),
      error: (err) => console.error('Erreur suppression marque', err),
    });
  }

  resetBrandForm() {
    this.editingBrand = null;
    this.newBrand = { name: '', imageUrl: '' };
  }

  // --- PAGINATION ÉTAT ---
  shipsPerPage = 10;
  brandsPerPage = 10;

  currentShipPage = 1;
  currentBrandPage = 1;

  paginatedShips: any[] = [];
  paginatedBrands: any[] = [];

// --- MISE À JOUR PAGINATION ---
  updateShipPagination() {
    const start = (this.currentShipPage - 1) * this.shipsPerPage;
    const end = start + this.shipsPerPage;
    this.paginatedShips = this.filteredShips.slice(start, end);
  }

  updateBrandPagination() {
    const start = (this.currentBrandPage - 1) * this.brandsPerPage;
    const end = start + this.brandsPerPage;
    this.paginatedBrands = this.brands.slice(start, end);
  }

// --- NAVIGATION ---
  nextShipPage() {
    if (this.currentShipPage < this.totalShipPages) {
      this.currentShipPage++;
      this.updateShipPagination();
    }
  }

  prevShipPage() {
    if (this.currentShipPage > 1) {
      this.currentShipPage--;
      this.updateShipPagination();
    }
  }

  nextBrandPage() {
    if (this.currentBrandPage < this.totalBrandPages) {
      this.currentBrandPage++;
      this.updateBrandPagination();
    }
  }

  prevBrandPage() {
    if (this.currentBrandPage > 1) {
      this.currentBrandPage--;
      this.updateBrandPagination();
    }
  }

// --- GETTERS UTILES ---
  get filteredShips(): any[] {
    const query = this.normalize(this.shipSearch);
    if (!query) {
      return this.ships;
    }

    return this.ships.filter((ship) => {
      const name = this.normalize(ship?.name);
      const brand = this.normalize(ship?.brand?.name);
      const focus = this.normalize(ship?.focus);
      const notes = this.normalize(ship?.notes);
      return name.includes(query) || brand.includes(query) || focus.includes(query) || notes.includes(query);
    });
  }

  get totalShipPages(): number {
    return Math.max(1, Math.ceil(this.filteredShips.length / this.shipsPerPage));
  }

  get totalBrandPages(): number {
    return Math.ceil(this.brands.length / this.brandsPerPage);
  }

  onShipSearchChange() {
    this.currentShipPage = 1;
    this.updateShipPagination();
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

}
