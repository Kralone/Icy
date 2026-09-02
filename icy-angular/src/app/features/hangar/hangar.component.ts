import {Component, ElementRef, HostListener, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {Ship} from '../../model/ship.model';
import {FormsModule} from '@angular/forms';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {ClickOutsideDirective} from '../../directives/click-outside.directive';
import {ShipListDTO} from '../../model/ShipListDTO.model';
import {HotToastService} from '@ngxpert/hot-toast';
import {AuthService} from '../../core/services/auth/auth.service';
import {ShipSelectorComponent} from '../../shared/ship-selector/ship-selector.component';
import {AcquisitionType} from '../../shared/ship-selector/ship-selector.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-hangar',
  templateUrl: './hangar.component.html',
  imports: [
    CommonModule,
    FormsModule,
    LoadingOverlayComponent,
    ClickOutsideDirective,
    ShipSelectorComponent
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./hangar.component.css']
})
export class HangarComponent implements OnDestroy {
  ships: ShipListDTO[]= [];

  isModalOpen = false;
  isLoading = true;
  hasReceivedFirstMessage = false;

  brands: { name: string, imageUrl: string }[] = [];
  filteredShips: ShipListDTO[] = [];

  selectedBrands: string[] = [];
  showBrandDropdown: boolean = false;

  selectedFocusFilter: string = '';
  shipFilter: string = '';

  messages: string[] = [];
  userId: string = "";
  private shipUpdatesSubscription?: Subscription;
  private loadingFallback?: ReturnType<typeof setTimeout>;

  constructor(private shipService: ShipService, private wsService: WebSocketService,
              private eRef: ElementRef, private toast: HotToastService, private authService: AuthService) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserIdFromToken()

    console.log(this.userId);
    this.loadBrands();
    this.wsService.connectShipUpdate(this.userId);

    this.isLoading = true;
    this.hasReceivedFirstMessage = false;
    this.loadingFallback = setTimeout(() => {
      if (!this.hasReceivedFirstMessage) {
        this.isLoading = false;
      }
    }, 5000);

    this.shipUpdatesSubscription = this.shipService.listenForUserShips(this.userId).subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        // Si c’est une liste de vaisseaux
        if (Array.isArray(parsed)) {
          this.ships = this.deduplicateShips(parsed);
          console.log('📦 Chargement initial de la flotte');
          this.hasReceivedFirstMessage = true;
          this.isLoading = false;
          if (this.loadingFallback) clearTimeout(this.loadingFallback);
          this.applyFilters();
        } else {
          this.messages.push(message); // Sinon, c’est un message événement individuel
          if (parsed.type === 'ADD') {
            console.log(parsed)
            // STOMP may redeliver an update around a reconnect. Treat ADD as
            // an upsert so the UI mirrors the database's unique user/ship key.
            this.ships = [
              ...this.ships.filter(ship => ship.shipId !== parsed.ship.shipId),
              parsed.ship
            ];
            this.applyFilters();
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
          if (this.loadingFallback) clearTimeout(this.loadingFallback);
        }
      }
      this.sortShipsByName();
    });
  }

  ngOnDestroy(): void {
    this.shipUpdatesSubscription?.unsubscribe();
    if (this.loadingFallback) clearTimeout(this.loadingFallback);
    if (this.userId) this.wsService.disconnectShipUpdate(this.userId);
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  loadBrands() {
    this.shipService.getAllBrandsWithImages().subscribe(response => {
      this.brands = response.data;
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

  private deduplicateShips(ships: ShipListDTO[]): ShipListDTO[] {
    return [...new Map(ships.map(ship => [ship.shipId, ship])).values()];
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

  sortShipsByName(): void {
    this.filteredShips.sort((a, b) => a.name.localeCompare(b.name));
  }

  getBrandLogo(brandName: string): string {
    return this.brands.find(b => b.name === brandName)?.imageUrl || '';
  }

  onShipSelected(payload: { ship: Ship | null; acquisitionType?: AcquisitionType }): void {
    if (!payload.ship) return;

    const acquisitionType = payload.acquisitionType ?? 'rsi';
    const requestPayload = {
      shipId: payload.ship.id,
      inGamePurchase: acquisitionType === 'ingame',
      rewardInGame: acquisitionType === 'reward_ingame',
      loaner: acquisitionType === 'loaner'
    };

    this.shipService.addShipToUser(requestPayload).subscribe({
      next: () => {
        this.closeModal();
      },
      error: err => {
        this.toast.error('Erreur lors de l\'ajout du vaisseau', err.error.message);
      }
    });
  }
}
