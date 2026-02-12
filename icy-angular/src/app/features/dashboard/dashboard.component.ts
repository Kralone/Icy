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
import { UserService } from '../../core/services/user/user.service';
import { UserOnline } from '../../model/user-online.model';

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

type OnlineStatus = 'connecte' | 'enjeu' | 'absent' | 'indisponible' | 'horsligne';

interface StatusStyle {
  label: string;
  badgeClass: string;
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
  onlineUsers: UserOnline[] = [];
  currentPage = 1;
  readonly pageSize = 5;

  statusStyles: Record<OnlineStatus, StatusStyle> = {
    connecte: { label: 'Connecté', badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
    enjeu: { label: 'En jeu', badgeClass: 'border-violet-400/30 bg-violet-400/10 text-violet-200' },
    absent: { label: 'Absent', badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
    indisponible: { label: 'Indisponible', badgeClass: 'border-rose-400/30 bg-rose-400/10 text-rose-200' },
    horsligne: { label: 'Hors ligne', badgeClass: 'border-slate-400/30 bg-slate-400/10 text-slate-200' }
  };

  objectKeys = Object.keys;

  constructor(
    private shipService: ShipService,
    private wsService: WebSocketService,
    private eventService: EventService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.isEventsLoading = true;

    this.wsService.connectFleetUpdate();
    this.loadFleetSummary();
    this.loadEvents();
    this.loadOnlineUsers();
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

  loadOnlineUsers(): void {
    this.userService.getOnlineUsers().subscribe((response) => {
      this.onlineUsers = response.data ?? [];
      this.currentPage = 1;
    });
  }

  get sortedOnlineUsers(): UserOnline[] {
    const priority: Record<OnlineStatus, number> = {
      enjeu: 0,
      connecte: 1,
      indisponible: 2,
      absent: 3,
      horsligne: 4
    };
    return [...this.onlineUsers].sort((a, b) => {
      const statusA = (a.status ?? 'connecte') as OnlineStatus;
      const statusB = (b.status ?? 'connecte') as OnlineStatus;
      const diff = priority[statusA] - priority[statusB];
      if (diff !== 0) return diff;
      return a.username.localeCompare(b.username);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedOnlineUsers.length / this.pageSize));
  }

  get paginatedOnlineUsers(): UserOnline[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedOnlineUsers.slice(start, start + this.pageSize);
  }

  changePage(delta: number): void {
    const nextPage = this.currentPage + delta;
    this.currentPage = Math.min(this.totalPages, Math.max(1, nextPage));
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

  get hasUpcomingEvents(): boolean {
    return !!this.events && this.events.length > 0;
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
