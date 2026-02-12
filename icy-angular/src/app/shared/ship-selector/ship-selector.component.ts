import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShipService } from '../../core/services/ship/ship.service';
import { Ship } from '../../model/ship.model';

export type AcquisitionType = 'rsi' | 'ingame' | 'loaner';

@Component({
  selector: 'app-ship-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ship-selector.component.html',
  styleUrls: ['./ship-selector.component.css']
})
export class ShipSelectorComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() showAcquisition = true;
  @Input() confirmLabel = 'Ajouter';
  @Output() close = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<{ ship: Ship | null; acquisitionType?: AcquisitionType }>();

  acquisitionType: AcquisitionType = 'rsi';
  useClassicAddMode = false;
  shipSearchQuery = '';
  allShipsModal: Ship[] = [];
  filteredShipsSearch: Ship[] = [];
  private allShipsLoaded = false;

  brands: { name: string; imageUrl: string }[] = [];
  filteredShipsModal: Ship[] = [];

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
      this.ensureShipsLoaded();
    }
  }

  private ensureShipsLoaded(): void {
    if (this.useClassicAddMode) return;
    if (this.allShipsLoaded) {
      this.applyShipSearch();
      return;
    }
    this.loadAllShipsForModal();
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

  onBrandChange(): void {
    const brand = this.brands.find((b) => b.name === this.selectedBrand);
    this.selectedBrandImageUrl = brand?.imageUrl || '';

    this.shipService.getShipsByBrand(this.selectedBrand).subscribe((response) => {
      this.filteredShipsModal = response.data;

      if (this.filteredShipsModal.length > 0) {
        this.selectedShip = this.filteredShipsModal[0];
        this.updateSelectedShipPreview();
      } else {
        this.selectedShip = null;
        this.selectedShipImageUrl = '';
      }
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
        this.filteredShipsModal = shipResponse.data;
        this.selectedShip = this.filteredShipsModal.length > 0 ? this.filteredShipsModal[0] : null;
        this.updateSelectedShipPreview();
      });
    });
  }

  private loadAllShipsForModal(): void {
    this.shipService.getAllShips().subscribe((response) => {
      this.allShipsModal = response.data || [];
      this.allShipsLoaded = true;
      this.applyShipSearch();
    });
  }

  private applyShipSearch(): void {
    const query = this.shipSearchQuery.trim().toLowerCase();
    const filtered = this.allShipsModal.filter((ship) => {
      const name = ship.name?.toLowerCase() ?? '';
      const brand = ship.brand?.name?.toLowerCase() ?? '';
      const focus = ship.focus?.toLowerCase() ?? '';
      return name.includes(query) || brand.includes(query) || focus.includes(query);
    });
    this.filteredShipsSearch = filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (!this.selectedShip || !this.filteredShipsSearch.some((s) => s.id === this.selectedShip?.id)) {
      this.selectedShip = this.filteredShipsSearch[0] ?? null;
    }
    this.updateSelectedShipPreview();
  }

  private updateSelectedShipPreview(): void {
    this.selectedShipImageUrl = this.selectedShip?.imageUrl || '';
    const brandName = this.selectedShip?.brand?.name ?? this.selectedBrand;
    const brand = this.brands.find((b) => b.name === brandName);
    this.selectedBrandImageUrl = brand?.imageUrl || '';
  }
}
