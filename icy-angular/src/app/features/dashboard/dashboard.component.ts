import {Component, HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {EventService} from '../../core/services/event/event.service';
import {GoalComponent} from './goal/goal.component';
import {NewsComponent} from './news/news.component';

interface IcyEvent {
  name: string;
  date: string;
  type: string;
}

interface ShipSummary {
  name: string;
  imageUrl: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    GoalComponent,
    NewsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  isLoading = true;
  isEventsLoading = true;

  fleetSummary: { [focus: string]: ShipSummary[] } = {};
  events: IcyEvent[] = [];

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
      console.log(response);
      const rawFleet = JSON.parse(response).fleet;
      console.log(rawFleet);
      this.fleetSummary = this.groupShipsByFocus(rawFleet);
      console.log('📦 Fleet update');
      this.isLoading = false;
    });
  }

  private groupShipsByFocus(fleet: { name: string; imageUrl: string; focus: string }[]): { [focus: string]: { name: string; imageUrl: string }[] } {
    const result: { [focus: string]: { name: string; imageUrl: string; count: number }[] } = {};

    for (const ship of fleet) {
      if (!result[ship.focus]) {
        result[ship.focus] = [];
      }

      const existing = result[ship.focus].find(s => s.name === ship.name);
      if (existing) {
        existing.count++;
      } else {
        result[ship.focus].push({ name: ship.name, imageUrl: ship.imageUrl, count: 1 });
      }
    }

    // Nettoyage du format final
    const finalResult: { [focus: string]: { name: string; imageUrl: string }[] } = {};
    for (const focus of Object.keys(result)) {
      finalResult[focus] = result[focus].map(s => ({
        name: s.count > 1 ? `${s.name} (${s.count})` : s.name,
        imageUrl: s.imageUrl
      }));
    }

    return finalResult;
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


  installPromptEvent: any; // stockera l’événement PWA

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    this.installPromptEvent = e;
    console.log('📱 beforeinstallprompt détecté ✅');
  }

  installApp() {
    if (this.installPromptEvent) {
      this.installPromptEvent.prompt();
      this.installPromptEvent.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ Iceforge installée');
        } else {
          console.log('❌ Installation annulée');
        }
        this.installPromptEvent = null;
      });
    } else {
      alert('💡 Pour installer Iceforge : utilisez le menu du navigateur → “Installer l’application”');
    }
  }



}
