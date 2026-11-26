import {ManufacturerBadgeComponent} from '../../shared/manufacturer-badge/manufacturer-badge.component';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ShipService } from '../../core/services/ship/ship.service';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {ShipDetailModalComponent} from '../../shared/ship-detail-modal/ship-detail-modal.component';
import {nameInitials, shipRoleTone} from '../../shared/ship-role/ship-role-tone';

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface FleetShipGroup {
  name: string;
  imageUrl: string;
  brandImageUrl?: string;
  count: number;
  owners?: string[];
}

@Component({
  standalone: true,
  selector: 'app-fleet',
  templateUrl: './fleet.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ManufacturerBadgeComponent,LoadingOverlayComponent, ShipDetailModalComponent],
  styleUrl: './fleet.component.css'
})
export class FleetComponent implements OnInit, OnDestroy {
  private shipService: ShipService;
  private wsService: WebSocketService;

  isLoading = true;
  fleetSummary: Record<string, FleetShipGroup[]> = {};
  /** Flotte affichée : fleetSummary restreint à la recherche en cours. */
  visibleFleet: Record<string, FleetShipGroup[]> = {};
  query = '';
  private loadingFallback?: ReturnType<typeof setTimeout>;

  objectKeys = Object.keys;
  selectedShip: FleetShipGroup | null = null;
  /** Pastilles de propriétaires affichées avant le « +n ». */
  readonly maxAvatars = 5;
  readonly roleTone = shipRoleTone;
  readonly initials = nameInitials;

  /** Teinte stable d'un propriétaire, pour reconnaître ses pastilles d'une carte à l'autre. */
  ownerHue(owner: string): number {
    let hash = 0;
    for (const char of owner) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }
  openShip(ship: FleetShipGroup){ this.selectedShip = ship; }
  closeShip(){ this.selectedShip = null; }

  constructor(shipService: ShipService, wsService: WebSocketService) {
    this.shipService = shipService;
    this.wsService = wsService;
  }

  ngOnInit(): void {
    this.wsService.connectFleetUpdate();
    this.loadingFallback = setTimeout(() => {
      this.isLoading = false;
    }, 5000);
    this.loadFleetSummary();
  }

  ngOnDestroy(): void {
    this.wsService.disconnectFleetUpdate();
    if (this.loadingFallback) {
      clearTimeout(this.loadingFallback);
    }
  }

  private loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe({
      next: (response) => {
        try {
          const payload = typeof response === 'string' ? JSON.parse(response) : response;
          const rawFleet = payload?.fleet ?? payload?.data ?? [];
          this.fleetSummary = this.groupShipsByFocus(Array.isArray(rawFleet) ? rawFleet : []);
        } catch (error) {
          console.error('Erreur de lecture du résumé de flotte', error);
          this.fleetSummary = {};
        } finally {
          this.applyFilter();
          this.finishLoading();
        }
      },
      error: (error) => {
        console.error('Erreur de chargement du résumé de flotte', error);
        this.finishLoading();
      },
    });
  }

  private finishLoading(): void {
    if (this.loadingFallback) {
      clearTimeout(this.loadingFallback);
      this.loadingFallback = undefined;
    }
    this.isLoading = false;
  }

  shipCount(focus: string): number {
    return (this.visibleFleet[focus] ?? []).reduce((total, ship) => total + ship.count, 0);
  }

  totalShips(): number {
    return Object.values(this.fleetSummary).reduce((total, ships) => total + ships.reduce((count, ship) => count + ship.count, 0), 0);
  }

  /** Filtre au fil de la frappe, sans tenir compte de la casse ni des accents. */
  onSearch(value: string): void {
    this.query = value;
    this.applyFilter();
  }

  private applyFilter(): void {
    const needle = normalize(this.query.trim());
    if (!needle) {
      this.visibleFleet = this.fleetSummary;
      return;
    }
    const result: Record<string, FleetShipGroup[]> = {};
    for (const [focus, ships] of Object.entries(this.fleetSummary)) {
      const matches = ships.filter(ship =>
        normalize(ship.name).includes(needle) || (ship.owners ?? []).some(owner => normalize(owner).includes(needle)));
      if (matches.length) result[focus] = matches;
    }
    this.visibleFleet = result;
  }
  private groupShipsByFocus(fleet: { name: string; imageUrl: string; focus: string; brandImageUrl?: string }[]): Record<string, FleetShipGroup[]> {
    const result: Record<string, FleetShipGroup[]> = {};

    for (const ship of fleet) {
      const focus = ship.focus?.trim() || 'Non classé';
      if (!result[focus]) {
        result[focus] = [];
      }

      const existing = result[focus].find(s => s.name === ship.name);
      if (existing) {
        existing.count++;
        for (const owner of ((ship as any).owners ?? [])) {
          if (!existing.owners?.includes(owner)) existing.owners?.push(owner);
        }
      } else {
        result[focus].push({ name: ship.name, imageUrl: ship.imageUrl, brandImageUrl: ship.brandImageUrl, count: 1, owners: (ship as any).owners ?? [] });
      }
    }

    return result;
  }
}
