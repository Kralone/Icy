import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
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
      const rawFleet = JSON.parse(response).fleet;
      this.fleetSummary = this.groupShipsByFocus(rawFleet);
      console.log('📦 Fleet update');
      this.isLoading = false;
    });
  }

  private groupShipsByFocus(fleet: { [focus: string]: string[] }): { [focus: string]: string[] } {
    const result: { [focus: string]: string[] } = {};

    for (const focus in fleet) {
      const nameCounts: { [name: string]: number } = {};

      for (const name of fleet[focus]) {
        nameCounts[name] = (nameCounts[name] || 0) + 1;
      }

      result[focus] = Object.entries(nameCounts).map(([name, count]) =>
        count > 1 ? `${name} (${count})` : name
      );
    }

    return result;
  }

  loadEvents() {
    this.eventService.getUpcomingEvents().subscribe(response => {
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
