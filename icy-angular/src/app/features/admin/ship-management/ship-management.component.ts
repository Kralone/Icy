import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShipService } from '../../../core/services/ship/ship.service';
import { ShipCargoGrid, ShipCreateDTO, ShipSalePoint } from '../../../model/ship.model';

interface ShipSalePointFormValue {
  location: string;
  price: number | null;
}

interface ShipCargoGridFormValue {
  sizeX: number | null;
  sizeY: number | null;
  sizeZ: number | null;
}

@Component({
  selector: 'app-ship-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ship-management.component.html',
})
export class ShipManagementComponent implements OnInit {
  // === Ships ===
  ships: any[] = [];
  shipSearch = '';
  newShip = {
    name: '',
    brandName: '',
    imageUrl: '',
    focus: '',
    notes: '',
    scu: null as number | null,
    size: '',
    crew: '',
    flightReady: false,
    salePoints: [this.createEmptySalePoint()] as ShipSalePointFormValue[],
    cargoGrids: [this.createEmptyCargoGrid()] as ShipCargoGridFormValue[],
  };

  isSubmittingShip = false;
  editingShip: any | null = null;
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


  createOrUpdateShip() {
    if (this.isSubmittingShip) return;

    // 🔒 Champs requis côté DB
    if (!this.newShip.name?.trim() || !this.newShip.brandName?.trim() || !this.newShip.imageUrl?.trim()) {
      console.error('Nom, Marque et Image URL sont requis.');
      return;
    }

    this.isSubmittingShip = true;

    // ✅ Payload conforme à Ship entity (Brand en objet + champs DB)
    const shipPayload: ShipCreateDTO = {
      name: this.newShip.name.trim(),
      brand: { name: this.newShip.brandName },
      imageUrl: this.newShip.imageUrl.trim(),
      flightReady: this.newShip.flightReady,

      focus: this.newShip.focus?.trim() || undefined,
      notes: this.newShip.notes?.trim() || undefined,
      size: this.newShip.size?.trim() || undefined,
      crew: this.newShip.crew?.trim() || undefined,
      scu:
        this.newShip.scu === null || this.newShip.scu === undefined
          ? undefined
          : Number(this.newShip.scu),
    };
    const salePoints = this.mapSalePointsForPayload();
    if (salePoints.length > 0) {
      shipPayload.salePoints = salePoints;
    }
    const cargoGrids = this.mapCargoGridsForPayload();
    if (cargoGrids.length > 0) {
      shipPayload.cargoGrids = cargoGrids;
    }



    const req = this.editingShip
      ? this.shipService.updateShip(this.editingShip.id, shipPayload)
      : this.shipService.createShip(shipPayload);

    req.subscribe({
      next: () => {
        this.isSubmittingShip = false;
        this.resetShipForm();
        this.loadShips();
      },
      error: (err) => {
        console.error('Erreur création/mise à jour vaisseau', err);
        this.isSubmittingShip = false;
      },
    });
  }


  editShip(ship: any) {
    this.editingShip = ship;

    // ✅ On remplit le form en gardant brandName pour le <select>
    this.newShip = {
      name: ship.name ?? '',
      brandName: ship.brand?.name ?? '',
      focus: ship.focus ?? '',
      notes: ship.notes ?? '',
      scu: ship.scu ?? null,
      size: ship.size ?? '',
      crew: ship.crew ?? '',
      flightReady: !!ship.flightReady,
      imageUrl: ship.imageUrl ?? '',
      salePoints: Array.isArray(ship.salePoints) && ship.salePoints.length > 0
        ? ship.salePoints.map((salePoint: any) => this.toSalePointFormValue(salePoint))
        : [this.createEmptySalePoint()],
      cargoGrids: Array.isArray(ship.cargoGrids) && ship.cargoGrids.length > 0
        ? ship.cargoGrids.map((cargoGrid: any) => this.toCargoGridFormValue(cargoGrid))
        : [this.createEmptyCargoGrid()],
    };
  }

  deleteShip(id: number, name: string) {
    if (!confirm(`Supprimer le vaisseau "${name}" ?`)) return;
    this.shipService.deleteShipAdmin(id).subscribe({
      next: () => this.loadShips(),
      error: (err) => console.error('Erreur suppression vaisseau', err),
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

  resetShipForm() {
    this.editingShip = null;
    this.newShip = {
      name: '',
      brandName: '',
      focus: '',
      notes: '',
      scu: null,
      size: '',
      crew: '',
      flightReady: false,
      imageUrl: '',
      salePoints: [this.createEmptySalePoint()],
      cargoGrids: [this.createEmptyCargoGrid()],
    };
  }

  addSalePoint() {
    this.newShip.salePoints.push(this.createEmptySalePoint());
  }

  removeSalePoint(index: number) {
    if (this.newShip.salePoints.length <= 1) {
      this.newShip.salePoints[0] = this.createEmptySalePoint();
      return;
    }
    this.newShip.salePoints.splice(index, 1);
  }

  addCargoGrid() {
    this.newShip.cargoGrids.push(this.createEmptyCargoGrid());
  }

  removeCargoGrid(index: number) {
    if (this.newShip.cargoGrids.length <= 1) {
      this.newShip.cargoGrids[0] = this.createEmptyCargoGrid();
      return;
    }
    this.newShip.cargoGrids.splice(index, 1);
  }

  private createEmptySalePoint(): ShipSalePointFormValue {
    return {
      location: '',
      price: null,
    };
  }

  private createEmptyCargoGrid(): ShipCargoGridFormValue {
    return {
      sizeX: null,
      sizeY: null,
      sizeZ: null,
    };
  }

  private toSalePointFormValue(salePoint: any): ShipSalePointFormValue {
    const parsedPrice = Number(salePoint?.price);
    return {
      location: salePoint?.location ?? '',
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    };
  }

  private toCargoGridFormValue(cargoGrid: any): ShipCargoGridFormValue {
    const parsedX = Number(cargoGrid?.sizeX);
    const parsedY = Number(cargoGrid?.sizeY);
    const parsedZ = Number(cargoGrid?.sizeZ);
    return {
      sizeX: Number.isFinite(parsedX) ? parsedX : null,
      sizeY: Number.isFinite(parsedY) ? parsedY : null,
      sizeZ: Number.isFinite(parsedZ) ? parsedZ : null,
    };
  }

  private mapSalePointsForPayload(): ShipSalePoint[] {
    return this.newShip.salePoints
      .map((salePoint) => {
        const location = salePoint.location?.trim();
        if (!location || salePoint.price === null || salePoint.price === undefined) {
          return null;
        }

        const parsedPrice = Number(salePoint.price);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
          return null;
        }

        return {
          location,
          price: parsedPrice,
        };
      })
      .filter((salePoint): salePoint is ShipSalePoint => salePoint !== null);
  }

  private mapCargoGridsForPayload(): ShipCargoGrid[] {
    const payload: ShipCargoGrid[] = [];
    for (const cargoGrid of this.newShip.cargoGrids) {
      const sizeX = Number(cargoGrid.sizeX);
      const sizeY = Number(cargoGrid.sizeY);
      const sizeZ = Number(cargoGrid.sizeZ);
      if (!Number.isInteger(sizeX) || sizeX <= 0 || !Number.isInteger(sizeY) || sizeY <= 0 || !Number.isInteger(sizeZ) || sizeZ <= 0) {
        continue;
      }

      payload.push({
        sizeX,
        sizeY,
        sizeZ,
      });
    }
    return payload;
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
