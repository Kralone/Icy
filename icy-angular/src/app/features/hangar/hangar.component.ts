import {Component, ElementRef, HostListener} from '@angular/core';
import {CommonModule, NgForOf, NgStyle} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {Ship} from '../../model/ship.model';
import {FormsModule} from '@angular/forms';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {ClickOutsideDirective} from '../../directives/click-outside.directive';
import {ShipListDTO} from '../../model/ShipListDTO.model';
import {HotToastService} from '@ngxpert/hot-toast';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-hangar',
  templateUrl: './hangar.component.html',
  imports: [
    CommonModule,
    FormsModule,
    LoadingOverlayComponent,
    ClickOutsideDirective
  ],
  styleUrls: ['./hangar.component.css']
})
export class HangarComponent {
  ships: ShipListDTO[]= [];

  isModalOpen = false;
  isLoading = true;
  hasReceivedFirstMessage = false;

  acquisitionType: 'rsi' | 'ingame' | 'loaner' = 'rsi';

  useClassicAddMode = false;
  shipSearchQuery = '';
  allShipsModal: Ship[] = [];
  filteredShipsSearch: Ship[] = [];
  private allShipsLoaded = false;

  formData = {
    name: '',
  };

  brands: { name: string, imageUrl: string }[] = [];
  filteredShips: ShipListDTO[] = [];
  filteredShipsModal: Ship[] = [];

  selectedBrand: string = '';
  selectedBrandImageUrl: string = '';
  selectedShip: Ship | null = null;
  selectedShipImageUrl: string = '';

  selectedBrands: string[] = [];
  showBrandDropdown: boolean = false;

  selectedFocusFilter: string = '';
  shipFilter: string = '';

  messages: string[] = [];
  userId: string = "";

  constructor(private shipService: ShipService, private wsService: WebSocketService,
              private eRef: ElementRef, private toast: HotToastService, private authService: AuthService) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserIdFromToken()

    console.log(this.userId);
    this.loadBrands();
    this.wsService.connectShipUpdate(this.userId);

    this.isLoading = true;
    this.hasReceivedFirstMessage = false;
    const loadingFallback = setTimeout(() => {
      if (!this.hasReceivedFirstMessage) {
        this.isLoading = false;
      }
    }, 5000);

    this.shipService.listenForUserShips(this.userId).subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        // Si c’est une liste de vaisseaux
        if (Array.isArray(parsed)) {
          this.ships = parsed;
          console.log('📦 Chargement initial de la flotte');
          this.hasReceivedFirstMessage = true;
          this.isLoading = false;
          clearTimeout(loadingFallback);
          this.filteredShips = [...this.ships]; // initialise filtrés
        } else {
          this.messages.push(message); // Sinon, c’est un message événement individuel
          if (parsed.type === 'ADD') {
            console.log(parsed)
            this.ships.push(parsed.ship);
            this.filteredShips.push(parsed.ship);
            this.sortShipsByManufacturer();
          } else if (parsed.type === 'DELETE') {
            this.ships = this.ships.filter(s => s.shipId !== parsed.ship.shipId);
            this.filteredShips = this.filteredShips.filter(s => s.shipId !== parsed.ship.shipId);
          }
        }
      } catch {
        this.messages.push(message);
        if (!this.hasReceivedFirstMessage) {
          this.isLoading = false;
          clearTimeout(loadingFallback);
        }
      }
      this.sortShipsByName();
    });
  }

  openModal() {
    this.isModalOpen = true;
    if (!this.allShipsLoaded) {
      this.loadAllShipsForModal();
    }
  }

  closeModal() {
    this.isModalOpen = false;
  }

  onSubmit() {
    console.log(this.formData);
    this.closeModal();
  }

  loadBrands() {
    this.shipService.getAllBrandsWithImages().subscribe(response => {
      this.brands = response.data;
      // Sélectionne la première marque automatiquement
      if (this.brands.length > 0) {
        this.selectedBrand = this.brands[0].name;
        this.selectedBrandImageUrl = this.brands[0].imageUrl;

        // Charge les vaisseaux de cette marque
        this.shipService.getShipsByBrand(this.selectedBrand).subscribe(shipResponse => {
          this.filteredShipsModal = shipResponse.data;
          this.selectedShip = this.filteredShipsModal.length > 0 ? this.filteredShipsModal[0] : null;
          this.updateSelectedShipPreview();
        });
      }
    });
  }

  onBrandChange(): void {
    const brand = this.brands.find(b => b.name === this.selectedBrand);
    this.selectedBrandImageUrl = brand?.imageUrl || '';

    this.shipService.getShipsByBrand(this.selectedBrand).subscribe(response => {
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


  onShipChange() {
    this.updateSelectedShipPreview();
  }

  onAddShip(): void {
    if (!this.selectedShip) return;

    console.log(this.selectedShip);

    const payload = {
      shipId: this.selectedShip.id,
      inGamePurchase: this.acquisitionType === 'ingame',
      loaner: this.acquisitionType === 'loaner'
    };

    console.log(payload.loaner);
    console.log(payload.inGamePurchase);

    this.shipService.addShipToUser(payload).subscribe({
      next: () => {
        this.closeModal();
      },
      error: err => {
        this.toast.error('Erreur lors de l\'ajout du vaisseau', err.error.message);
      }
    });
  }

  deleteShip(shipId: number) {
    this.shipService.deleteShip(shipId).subscribe({})
  }

  onAddModeToggle(): void {
    if (this.useClassicAddMode) {
      if (!this.brands.length) {
        this.loadBrands();
      }
    } else {
      if (!this.allShipsLoaded) {
        this.loadAllShipsForModal();
      } else {
        this.applyShipSearch();
      }
    }
  }

  setAddMode(useClassic: boolean): void {
    if (this.useClassicAddMode === useClassic) {
      return;
    }
    this.useClassicAddMode = useClassic;
    this.onAddModeToggle();
  }

  private sortShipsByManufacturer() {
    this.ships.sort((a, b) => {
      const brandA = String(a.brand || '').toLowerCase();
      const brandB = String(b.brand || '').toLowerCase();
      return brandA.localeCompare(brandB);
    });
  }

  toggleBrand(brand: string): void {
    const index = this.selectedBrands.indexOf(brand);
    if (index >= 0) {
      this.selectedBrands.splice(index, 1);
    } else {
      this.selectedBrands.push(brand);
    }
    this.applyFilters();
  }

  applyFilters(): void {
    const filteredBySearch = this.ships.filter(ship =>
      ship.name.toLowerCase().includes(this.shipFilter.toLowerCase())
    );

    if (this.selectedBrands.length > 0) {
      this.filteredShips = filteredBySearch.filter(ship =>
        this.selectedBrands.includes(ship.brand)
      );
    } else {
      this.filteredShips = filteredBySearch;
    }
  }

  onFilterChange(): void {
    this.applyFilters()
  }

  compareShips = (a: any, b: any): boolean => {
    return a && b && a.id === b.id;
  };

  sortShipsByName(): void {
    this.filteredShips.sort((a, b) => a.name.localeCompare(b.name));
  }

  private loadAllShipsForModal(): void {
    this.shipService.getAllShips().subscribe(response => {
      this.allShipsModal = response.data || [];
      this.allShipsLoaded = true;
      this.applyShipSearch();
    });
  }

  onShipSearchChange(): void {
    this.applyShipSearch();
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
    if (!this.selectedShip || !this.filteredShipsSearch.some(s => s.id === this.selectedShip?.id)) {
      this.selectedShip = this.filteredShipsSearch[0] ?? null;
    }
    this.updateSelectedShipPreview();
  }

  private updateSelectedShipPreview(): void {
    this.selectedShipImageUrl = this.selectedShip?.imageUrl || '';
    const brandName = this.selectedShip?.brand?.name ?? this.selectedBrand;
    const brand = this.brands.find(b => b.name === brandName);
    this.selectedBrandImageUrl = brand?.imageUrl || '';
  }

  getBrandLogo(brandName: string): string {
    return this.brands.find(b => b.name === brandName)?.imageUrl || '';
  }
}
