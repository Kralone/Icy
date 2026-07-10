import {Component, HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ShipService} from '../../core/services/ship/ship.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';
import {EventService} from '../../core/services/event/event.service';
import {GoalComponent} from './goal/goal.component';
import {NewsComponent} from './news/news.component';
import { Router } from '@angular/router';
import { ScweWidgetComponent } from './scwe-widget/scwe-widget.component';
import { UserService } from '../../core/services/user/user.service';
import { UserOnline } from '../../model/user-online.model';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  displayName: string;
  imageUrl: string | null;
  focus: string;
  brandName: string;
  count: number;
}

interface FleetSummaryEntry {
  name: string;
  imageUrl: string | null;
  focus: string | null;
  brandName?: string | null;
  brandImageUrl?: string | null;
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
    FormsModule,
    GoalComponent,
    NewsComponent,
    ScweWidgetComponent,
    LoadingOverlayComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  isLoading = true;
  isEventsLoading = true;
  isOnlineLoading = true;

  fleetSummary: { [focus: string]: ShipSummary[] } = {};
  fleetCategoryFilter = '';
  fleetBrandFilter = '';
  fleetSearchFilter = '';
  events: IcyEvent[] = [];
  onlineUsers: UserOnline[] = [];
  currentPage = 1;
  readonly pageSize = 5;
  private readonly destroy$ = new Subject<void>();

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

    interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadOnlineUsers();
    });
  }

  loadFleetSummary() {
    this.shipService.getFleetSummary().subscribe(response => {
      const payload = typeof response === 'string' ? JSON.parse(response) : response;
      const rawFleet = (payload?.fleet ?? []) as FleetSummaryEntry[];
      this.fleetSummary = this.groupShipsByFocus(rawFleet);
      this.isLoading = false;
    }, () => {
      this.isLoading = false;
    });
  }

  get fleetCategories(): string[] {
    return this.objectKeys(this.fleetSummary)
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  get fleetBrands(): string[] {
    const brands = new Set<string>();
    for (const ships of Object.values(this.fleetSummary)) {
      for (const ship of ships) {
        if (ship.brandName) {
          brands.add(ship.brandName);
        }
      }
    }

    return [...brands]
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  get filteredFleetSummary(): { [focus: string]: ShipSummary[] } {
    const categoryFilter = this.normalize(this.fleetCategoryFilter);
    const brandFilter = this.normalize(this.fleetBrandFilter);
    const searchFilter = this.normalize(this.fleetSearchFilter);
    const filtered: { [focus: string]: ShipSummary[] } = {};

    for (const focus of this.objectKeys(this.fleetSummary)) {
      if (categoryFilter && this.normalize(focus) !== categoryFilter) {
        continue;
      }

      const ships = this.fleetSummary[focus].filter((ship) => {
        if (brandFilter && this.normalize(ship.brandName) !== brandFilter) {
          return false;
        }
        if (!searchFilter) {
          return true;
        }

        const searchableFields = [
          ship.name,
          ship.displayName,
          ship.brandName,
          ship.focus
        ].map(value => this.normalize(value));

        return searchableFields.some(value => value.includes(searchFilter));
      });

      if (ships.length > 0) {
        filtered[focus] = ships;
      }
    }

    return filtered;
  }

  get hasFleetSummary(): boolean {
    return this.objectKeys(this.fleetSummary).length > 0;
  }

  get hasActiveFleetFilters(): boolean {
    return !!(this.fleetCategoryFilter || this.fleetBrandFilter || this.fleetSearchFilter.trim());
  }

  resetFleetFilters(): void {
    this.fleetCategoryFilter = '';
    this.fleetBrandFilter = '';
    this.fleetSearchFilter = '';
  }

  private groupShipsByFocus(fleet: FleetSummaryEntry[]): { [focus: string]: ShipSummary[] } {
    const shipsByKey = new Map<string, ShipSummary>();

    for (const ship of fleet ?? []) {
      const focus = this.safeLabel(ship.focus, 'Sans catégorie');
      const name = this.safeLabel(ship.name, 'Vaisseau inconnu');
      const brandName = this.safeLabel(ship.brandName, 'Marque inconnue');
      const key = `${focus}::${brandName}::${name}`;

      const existing = shipsByKey.get(key);
      if (existing) {
        existing.count++;
        continue;
      }

      shipsByKey.set(key, {
        name,
        displayName: name,
        imageUrl: ship.imageUrl ?? null,
        focus,
        brandName,
        count: 1
      });
    }

    const result: { [focus: string]: ShipSummary[] } = {};
    for (const ship of shipsByKey.values()) {
      ship.displayName = ship.count > 1 ? `${ship.name} (${ship.count})` : ship.name;
      if (!result[ship.focus]) {
        result[ship.focus] = [];
      }
      result[ship.focus].push(ship);
    }

    for (const focus of this.objectKeys(result)) {
      result[focus] = result[focus]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    }

    return result;
  }

  private safeLabel(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed || fallback;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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
    }, () => {
      this.isEventsLoading = false;
    });
  }

  loadOnlineUsers(): void {
    this.isOnlineLoading = true;
    this.userService.getOnlineUsers().subscribe((response) => {
      this.onlineUsers = response.data ?? [];
      this.currentPage = 1;
      this.isOnlineLoading = false;
    }, () => {
      this.isOnlineLoading = false;
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
    this.destroy$.next();
    this.destroy$.complete();
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
