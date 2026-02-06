import {Component, HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {EventService} from '../../core/services/event/event.service';
import {GoalComponent} from './goal/goal.component';
import {NewsComponent} from './news/news.component';
import { Router } from '@angular/router';
import { ScweWidgetComponent } from './scwe-widget/scwe-widget.component';

interface IcyEvent {
  id: string;
  name: string;
  date: string;
  type: string;
  typeTextColor?: string;
  typeBackgroundColor?: string;
  typeImageUrl?: string;
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
    NewsComponent,
    ScweWidgetComponent
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
    private eventService: EventService,
    private router: Router
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
        id: evt.id,
        name: evt.title,
        date: evt.startDateTime,
        type: evt.type.name,
        typeTextColor: evt.type.textColor,
        typeBackgroundColor: evt.type.backgroundColor,
        typeImageUrl: evt.type.imageUrl
      }));
      console.log('📅 Events loaded');
      this.isEventsLoading = false;
    });
  }

  capitalizeFirst(value: string | null | undefined): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  openEvent(event: any): void {
    if (!event?.id) return;
    this.router.navigate(['/icy/events'], {
      queryParams: { eventId: event.id }
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
