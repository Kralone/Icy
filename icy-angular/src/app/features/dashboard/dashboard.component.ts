import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
// (Optionnel) Remplace EventService par ton vrai service d’événements
import {EventService} from '../../core/services/event/event.service';

interface Event {
  name: string;
  date: string;
  type: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LoadingOverlayComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  isLoading = true;
  isEventsLoading = true;

  fleetSummary: { [focus: string]: string[] } = {};
  events: Event[] = [];

  objectKeys = Object.keys;

  constructor(
    private shipService: ShipService,
    private wsService: WebSocketService,
    private eventService: EventService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.isEventsLoading = true;

    this.wsService.connectFleetUpdate();
    this.loadFleetSummary();
    this.loadEvents();
  }

  loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe(response => {
      this.fleetSummary = JSON.parse(response).fleet;
      console.log('📦 Fleet update');
      this.isLoading = false;
    });
  }

  loadEvents() {
    this.eventService.getUpcomingEvents().subscribe(response => {
      console.log(response.data);
      this.events = response.data.map(evt => ({
        name: evt.title,
        date: evt.startDateTime,
        type: evt.type.name
      }));
      console.log('📅 Events loaded');
      this.isEventsLoading = false;
    });
  }

  ngOnDestroy() {
    this.wsService.disconnectFleetUpdate();
  }
}
