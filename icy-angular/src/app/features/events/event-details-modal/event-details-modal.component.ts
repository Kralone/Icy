import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { eventColor, eventImage } from '../event-appearance';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';
import { FleetMiniCardComponent } from '../../../shared/fleet-mini-card/fleet-mini-card.component';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';
import { ParticipationPanelComponent } from '../../../shared/participation-panel/participation-panel.component';

type FleetMiniShip = {
  name: string;
  imageUrl?: string;
  brandImageUrl?: string;
};

@Component({
  selector: 'app-event-details-modal',
  standalone: true,
  imports: [CommonModule, A11yModule, FleetMiniCardComponent, AsyncStateComponent, ParticipationPanelComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './event-details-modal.component.html',
  styleUrl: './event-details-modal.component.css'
})
export class EventDetailsModalComponent {
  readonly eventColor = eventColor;
  readonly eventImage = eventImage;
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
  @Input() participationError = '';
  @Input() isParticipationLoading = false;
  @Input() isParticipationSaving = false;
  @Input() selectedParticipationStatus: number | null = null;

  @Output() retryParticipations = new EventEmitter<void>();

  @Output() requestClose = new EventEmitter<void>();
  @Output() participationChange = new EventEmitter<number>();
  @Output() toggleFleets = new EventEmitter<void>();

  @HostListener('document:keydown.escape', ['$event'])
  closeOnEscape(event: Event): void {
    event.preventDefault();
    this.requestClose.emit();
  }
}
