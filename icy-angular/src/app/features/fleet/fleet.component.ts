import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShipService } from '../../core/services/ship/ship.service';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';
import {WebSocketService} from '../../core/services/websocket/websocket.service';

@Component({
  standalone: true,
  selector: 'app-fleet',
  templateUrl: './fleet.component.html',
  imports: [CommonModule, LoadingOverlayComponent]
})
export class FleetComponent implements OnInit {
  private shipService: ShipService;
  private wsService: WebSocketService;

  isLoading = true;
  fleetSummary: { [focus: string]: { name: string; imageUrl: string; brandImageUrl?: string }[] } = {};

  objectKeys = Object.keys;

  constructor(shipService: ShipService, wsService: WebSocketService) {
    this.shipService = shipService;
    this.wsService = wsService;
  }

  ngOnInit(): void {
    this.wsService.connectFleetUpdate();
    this.loadFleetSummary();
  }

  private loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe(response => {
      const rawFleet = JSON.parse(response).fleet;
      this.fleetSummary = this.groupShipsByFocus(rawFleet);
      this.isLoading = false;
    });
  }

  private groupShipsByFocus(fleet: { name: string; imageUrl: string; focus: string; brandImageUrl?: string }[]): { [focus: string]: { name: string; imageUrl: string; brandImageUrl?: string }[] } {
    const result: { [focus: string]: { name: string; imageUrl: string; brandImageUrl?: string; count: number }[] } = {};

    for (const ship of fleet) {
      if (!result[ship.focus]) {
        result[ship.focus] = [];
      }

      const existing = result[ship.focus].find(s => s.name === ship.name);
      if (existing) {
        existing.count++;
      } else {
        result[ship.focus].push({ name: ship.name, imageUrl: ship.imageUrl, brandImageUrl: ship.brandImageUrl, count: 1 });
      }
    }

    const finalResult: { [focus: string]: { name: string; imageUrl: string; brandImageUrl?: string }[] } = {};
    for (const focus of Object.keys(result)) {
      finalResult[focus] = result[focus].map(s => ({
        name: s.count > 1 ? `${s.name} (${s.count})` : s.name,
        imageUrl: s.imageUrl,
        brandImageUrl: s.brandImageUrl
      }));
    }

    return finalResult;
  }
}
