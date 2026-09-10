import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShipService } from '../../core/services/ship/ship.service';
import { Ship, ShipCatalogGroup } from '../../model/ship.model';

export type AcquisitionType = 'rsi' | 'ingame' | 'reward_ingame' | 'loaner';

@Component({
  selector: 'app-ship-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ship-selector.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./ship-selector.component.css']
})
export class ShipSelectorComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() showAcquisition = true;
  @Input() showCatalogGroups = false;
  @Input() confirmLabel = 'Ajouter';
  @Output() close = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<{ ship: Ship | null; acquisitionType?: AcquisitionType }>();

  acquisitionType: AcquisitionType = 'rsi';
  useClassicAddMode = false;
  shipSearchQuery = '';
  allShipsModal: Ship[] = [];
  filteredShipsSearch: Ship[] = [];
  private allShipsLoaded = false;
  isShipCatalogLoading = false;
  shipCatalogLoadError = false;

  brands: { name: string; imageUrl: string }[] = [];
  brandShipsModal: Ship[] = [];
  filteredShipsModal: Ship[] = [];

  readonly catalogGroups: ReadonlyArray<{ value: ShipCatalogGroup; label: string }> = [
    { value: 'STANDARD', label: 'Standard' },
    { value: 'WIKELO', label: 'Wikelo' },
    { value: 'PYAM_EXEC', label: 'PYAM' },
    { value: 'BATTAGLIA', label: 'Alliance' }
  ];
  selectedCatalogGroup: ShipCatalogGroup = 'STANDARD';

  selectedBrand = '';
  selectedBrandImageUrl = '';
  selectedShip: Ship | null = null;
  selectedShipImageUrl = '';

  constructor(private shipService: ShipService) {}

  ngOnInit(): void {
    this.loadBrands();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue) {
      this.resetForm();
      this.ensureShipsLoaded();
    }
  }

  private resetForm(): void {
    this.acquisitionType = 'rsi';
    this.useClassicAddMode = false;
    this.shipSearchQuery = '';
    this.selectedCatalogGroup = 'STANDARD';
    this.selectedShip = null;
    this.selectedShipImageUrl = '';

    const firstBrand = this.brands[0];
    this.selectedBrand = firstBrand?.name ?? '';
    this.selectedBrandImageUrl = firstBrand?.imageUrl ?? '';
  }

  private ensureShipsLoaded(): void {
    if (this.useClassicAddMode) return;
    if (this.allShipsLoaded) {
      this.applyShipSearch();
      return;
    }
    if (this.isShipCatalogLoading) return;
    this.loadAllShipsForModal();
  }

  retryLoadShips(): void {
    this.ensureShipsLoaded();
  }

  closeModal(): void {
    this.close.emit();
  }

  confirm(): void {
    this.confirmSelection.emit({
      ship: this.selectedShip,
      acquisitionType: this.showAcquisition ? this.acquisitionType : undefined
    });
  }

  setAddMode(useClassic: boolean): void {
    if (this.useClassicAddMode === useClassic) return;
    this.useClassicAddMode = useClassic;
    this.onAddModeToggle();
  }

  onAddModeToggle(): void {
    if (this.useClassicAddMode) {
      if (!this.brands.length) {
        this.loadBrands();
      }
    } else {
      this.ensureShipsLoaded();
    }
  }

  onShipSearchChange(): void {
    this.applyShipSearch();
  }

  selectCatalogGroup(group: ShipCatalogGroup): void {
    if (this.selectedCatalogGroup === group) return;
    this.selectedCatalogGroup = group;
    if (this.useClassicAddMode) {
      this.applyBrandShipFilter();
    } else {
      this.applyShipSearch();
    }
  }

  get selectedCatalogGroupIndex(): number {
    return this.catalogGroups.findIndex((group) => group.value === this.selectedCatalogGroup);
  }

  onBrandChange(): void {
    const brand = this.brands.find((b) => b.name === this.selectedBrand);
    this.selectedBrandImageUrl = brand?.imageUrl || '';

    this.shipService.getShipsByBrand(this.selectedBrand).subscribe((response) => {
      this.brandShipsModal = response.data || [];
      this.applyBrandShipFilter();
    });
  }

  onShipChange(): void {
    this.updateSelectedShipPreview();
  }

  compareShips = (a: any, b: any): boolean => {
    return a && b && a.id === b.id;
  };

  private loadBrands(): void {
    this.shipService.getAllBrandsWithImages().subscribe((response) => {
      this.brands = response.data;
      if (!this.brands.length) return;

      if (!this.selectedBrand) {
        this.selectedBrand = this.brands[0].name;
        this.selectedBrandImageUrl = this.brands[0].imageUrl;
      }

      this.shipService.getShipsByBrand(this.selectedBrand).subscribe((shipResponse) => {
        this.brandShipsModal = shipResponse.data || [];
        this.applyBrandShipFilter();
      });
    });
  }

  private loadAllShipsForModal(): void {
    this.isShipCatalogLoading = true;
    this.shipCatalogLoadError = false;
    this.shipService.getAllShips().subscribe({
      next: (response) => {
        this.allShipsModal = response.data || [];
        this.allShipsLoaded = true;
        this.applyShipSearch();
        this.isShipCatalogLoading = false;
      },
      error: () => {
        this.isShipCatalogLoading = false;
        this.shipCatalogLoadError = true;
      }
    });
  }

  private applyShipSearch(): void {
    const query = this.shipSearchQuery.trim().toLowerCase();
    const filtered = this.allShipsModal.filter((ship) => {
      const name = ship.name?.toLowerCase() ?? '';
      const brand = ship.brand?.name?.toLowerCase() ?? '';
      const focus = ship.focus?.toLowerCase() ?? '';
      const matchesSearch = name.includes(query) || brand.includes(query) || focus.includes(query);
      return matchesSearch && this.matchesSelectedCatalogGroup(ship);
    });
    this.filteredShipsSearch = filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (!this.selectedShip || !this.filteredShipsSearch.some((s) => s.id === this.selectedShip?.id)) {
      this.selectedShip = this.filteredShipsSearch[0] ?? null;
    }
    this.updateSelectedShipPreview();
  }

  private applyBrandShipFilter(): void {
    this.filteredShipsModal = this.brandShipsModal
      .filter((ship) => this.matchesSelectedCatalogGroup(ship))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!this.selectedShip || !this.filteredShipsModal.some((ship) => ship.id === this.selectedShip?.id)) {
      this.selectedShip = this.filteredShipsModal[0] ?? null;
    }
    this.updateSelectedShipPreview();
  }

  private matchesSelectedCatalogGroup(ship: Ship): boolean {
    return !this.showCatalogGroups || this.shipCatalogGroup(ship) === this.selectedCatalogGroup;
  }

  private shipCatalogGroup(ship: Ship): ShipCatalogGroup {
    if (ship.catalogGroup) return ship.catalogGroup;

    const normalizedName = ship.name?.trim().toLowerCase() ?? '';
    if (/\bwikelo\b/.test(normalizedName)) return 'WIKELO';
    if (/\bpyam\s+exec$/.test(normalizedName)) return 'PYAM_EXEC';
    if (/\salliance$/.test(normalizedName)) return 'BATTAGLIA';
    return 'STANDARD';
  }

  private updateSelectedShipPreview(): void {
    this.selectedShipImageUrl = this.selectedShip?.imageUrl || '';
    const brandName = this.selectedShip?.brand?.name ?? this.selectedBrand;
    const brand = this.brands.find((b) => b.name === brandName);
    this.selectedBrandImageUrl = brand?.imageUrl || '';
  }
}
