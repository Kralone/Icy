import {Component, ElementRef, HostListener} from '@angular/core';
import {CommonModule, NgForOf, NgStyle} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {Ship} from '../../model/ship.model';
import {FormsModule} from '@angular/forms';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {ClickOutsideDirective} from '../../directives/click-outside.directive';

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
  ships: Ship[]= [];

  isModalOpen = false;
  isLoading = true;
  hasReceivedFirstMessage = false;


  formData = {
    name: '',
  };

  brands: { name: string, imageUrl: string }[] = [];
  filteredShips: Ship[] = [];
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
  userId: string = '3aba7720-d850-4557-b8d2-1fb5f1e222f5'; // ID temporaire
  discordId = "190174996235026433"

  constructor(private shipService: ShipService, private wsService: WebSocketService,
              private eRef: ElementRef) {}

  ngOnInit(): void {
    this.loadBrands();
    this.wsService.connectShipUpdate(this.userId);

    this.isLoading = true;
    this.hasReceivedFirstMessage = false;

    this.shipService.listenForUserShips(this.userId).subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        // Si c’est une vraie liste de vaisseaux
        if (Array.isArray(parsed)) {
          this.ships = parsed;
          console.log('📦 Chargement initial de la flotte');
          this.hasReceivedFirstMessage = true;
          this.isLoading = false;
          this.filteredShips = [...this.ships]; // initialise filtrés
        } else {
          this.messages.push(message); // Sinon, c’est un message événement individuel
          if (parsed.type === 'ADD') {
            this.ships.push(parsed.ship);
            this.filteredShips.push(parsed.ship);
            this.sortShipsByManufacturer();
          } else if (parsed.type === 'DELETE') {
            this.ships = this.ships.filter(s => s.id !== parsed.ship.id);
            this.filteredShips = this.filteredShips.filter(s => s.id !== parsed.ship.id);
          }
        }
      } catch {
        // Si ce n’est pas du JSON (ex: "Vaisseau ajouté : Gladius")
        this.messages.push(message);
      }
    });
  }

  openModal() {
    this.isModalOpen = true;
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
          this.selectedShipImageUrl = this.selectedShip?.imageUrl || '';
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
        this.selectedShipImageUrl = this.filteredShipsModal[0].imageUrl;
      } else {
        this.selectedShip = null;
        this.selectedShipImageUrl = '';
      }
    });
  }


  onShipChange() {
    const ship = this.filteredShips.find(s => s.name === this.selectedShip?.name);
    this.selectedShipImageUrl = ship?.imageUrl || '';
  }

  onAddShip(): void {
    if (!this.selectedShip) return;

    const payload = {
      discordId: this.discordId,
      shipId: this.selectedShip.id
    };

    this.shipService.addShipToUser(payload).subscribe({
      next: () => {
        this.closeModal();
      },
      error: err => {
        console.error('Erreur lors de l\'ajout du vaisseau', err);
      }
    });
  }

  deleteShip(shipId: number) {
    this.shipService.deleteShip(shipId).subscribe({})
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
        this.selectedBrands.includes(ship.brand.name)
      );
    } else {
      this.filteredShips = filteredBySearch;
    }
  }

  onFilterChange(): void {
    this.applyFilters()
  }

}
