import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';
import { FleetMiniCardComponent } from '../../../shared/fleet-mini-card/fleet-mini-card.component';

type FleetMiniShip = {
  name: string;
  imageUrl?: string;
  brandImageUrl?: string;
};

@Component({
  selector: 'app-event-details-modal',
  standalone: true,
  imports: [CommonModule, FleetMiniCardComponent],
  templateUrl: './event-details-modal.component.html'
})
export class EventDetailsModalComponent {
  @Input() selectedEvent: any;
  @Input() descriptionHtml?: SafeHtml;
  @Input() participationsByStatus: {
    confirmed: any[];
    maybe: any[];
    refused: any[];
  } = {
    confirmed: [],
    maybe: [],
    refused: []
  };
  @Input() showConfirmedFleets = false;
  @Input() isFleetLoading = false;
  @Input() fleetByBrand: Record<string, FleetMiniShip[]> = {};
  @Input() fleetBrandKeys: string[] = [];

  @Output() requestClose = new EventEmitter<void>();
  @Output() participationChange = new EventEmitter<number>();
  @Output() toggleFleets = new EventEmitter<void>();
}
