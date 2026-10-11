import { Component, HostListener, ViewChild, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CalendarOptions, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { EventService, EventDTO } from '../../core/services/event/event.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { EventType } from '../../model/event-type.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShipService } from '../../core/services/ship/ship.service';
import { catchError, finalize, forkJoin, map, of, Subscription } from 'rxjs';
import { EventDetailsModalComponent } from './event-details-modal/event-details-modal.component';
import { AsyncStateComponent } from '../../shared/async-state/async-state.component';
import { eventColor, eventImage } from './event-appearance';

type FleetMiniShip = {
  name: string;
  imageUrl?: string;
  brandName?: string;
  brandImageUrl?: string;
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [FormsModule, DatePipe, FullCalendarModule, EventDetailsModalComponent, AsyncStateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements AfterViewInit, OnDestroy {
  readonly eventColor = eventColor;
  readonly eventImage = eventImage;
  @ViewChild(FullCalendarComponent) calendarComponent?: FullCalendarComponent;

  calendarEvents: any[] = [];
  types: EventType[] = [];
  selectedEvent: any = null;
  showDetailsModal = false;
  isLoading = true;
  isAdmin = false;
  viewMode: 'upcoming' | 'calendar' = 'upcoming';
  loadError = '';
  upcomingEvents: EventDTO[] = [];
  participationLabels: Record<string, string> = {};
  participationError = '';
  isParticipationLoading = false;
  isParticipationSaving = false;
  selectedParticipationStatus: number | null = null;
  private participationSubscription?: Subscription;
  private httpSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private snapshotRevision = 0;
  private eventSnapshot: EventDTO[] = [];
  private pendingUpdates: { action: string; events: EventDTO[] }[] = [];

  participationsByStatus = {
    confirmed: [] as any[],
    maybe: [] as any[],
    refused: [] as any[]
  };

  showConfirmedFleets = false;
  isFleetLoading = false;
  fleetByBrand: Record<string, FleetMiniShip[]> = {};
  fleetBrandKeys: string[] = [];
  private userFleetCache: Record<string, FleetMiniShip[]> = {};
  private lastIsMobile: boolean | null = null;
  calendarTitle = '';
  calendarView = 'dayGridMonth';
  private eventUpdatesSubscription?: Subscription;
  private destroyed = false;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    locale: 'fr',
    firstDay: 1,
    fixedWeekCount: false,
    initialView: 'dayGridMonth',
    height: 'auto',
    expandRows: false,
    contentHeight: 'auto',
    handleWindowResize: true,

    eventDisplay: 'block',
    headerToolbar: false,
    dayMaxEvents: 3,
    moreLinkText: count => '+' + count + ' autres',
    dayHeaderFormat: { weekday: 'short' },
    eventOrder: 'start,title',
    views: {
      dayGridWeek: {
        type: 'dayGrid',
        duration: { days: 7 },
        buttonText: 'Semaine'
      },
      threeDay: {
        type: 'dayGrid',
        duration: { days: 3 },
        buttonText: '3 jours'
      }
    },

    eventClick: (arg) => this.onEventClick(arg),
    datesSet: (arg) => this.onDatesSet(arg),
    eventDidMount: ({el}) => {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
      };
    },
  };

  constructor(
    private eventService: EventService,
    private wsService: WebSocketService,
    private authService: AuthService,
    private shipService: ShipService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngAfterViewInit() {
    this.authService.isAdmin().subscribe(isAdmin => (this.isAdmin = isAdmin));

    this.listenForUpdates();
    this.wsService.connectEvent();
    this.reloadEvents();

    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      const eventId = params.get('eventId');
      if (eventId) {
        this.pendingEventId = eventId;
        this.tryOpenEventFromQuery();
      }
    });
    setTimeout(() => this.updateResponsiveCalendarLayout(true));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.eventUpdatesSubscription?.unsubscribe();
    this.httpSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.participationSubscription?.unsubscribe();
    this.wsService.disconnectEvent();
  }

  @HostListener('window:resize', [])
  onWindowResize() {
    this.updateResponsiveCalendarLayout();
  }

  private updateResponsiveCalendarLayout(force = false) {
    const api = this.calendarComponent?.getApi();
    if (!api) return;
    const mobile = window.innerWidth < 640;
    if (this.lastIsMobile !== mobile) {
      this.changeCalendarView(mobile ? 'threeDay' : 'dayGridMonth');
      this.lastIsMobile = mobile;
    }
    api.updateSize();
  }

  private onDatesSet(arg: DatesSetArg): void {
    const { title, type } = arg.view;
    // FullCalendar emits synchronously while Angular creates/checks its child view.
    // Publish the heading after that pass and notify zoneless change detection too.
    queueMicrotask(() => {
      if (this.destroyed) return;
      this.calendarTitle = title;
      this.calendarView = type;
      this.changeDetector.markForCheck();
    });
  }

  changeCalendarView(view: string): void {
    this.calendarComponent?.getApi().changeView(view);
  }

  moveCalendar(direction: 'prev' | 'next' | 'today'): void {
    this.calendarComponent?.getApi()[direction]();
  }

  setView(mode: 'upcoming' | 'calendar'): void {
    this.viewMode = mode;
    if (mode === 'calendar') setTimeout(() => this.updateResponsiveCalendarLayout(true));
  }

  reloadEvents(): void {
    this.httpSubscription?.unsubscribe();
    this.isLoading = true;
    this.loadError = '';
    this.pendingUpdates = [];
    const revision = this.snapshotRevision;
    this.httpSubscription = this.eventService.getAll().subscribe({
      next: events => {
        // A live snapshot received during HTTP loading is more recent.
        if (revision === this.snapshotRevision) {
          const merged = this.pendingUpdates.reduce((snapshot, update) => this.mergeUpdate(snapshot, update), events);
          this.applyEvents(merged);
        }
        this.pendingUpdates = [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        if (revision === this.snapshotRevision) {
          this.loadError = 'Impossible de charger les événements. Veuillez réessayer.';
        }
      }
    });
  }

  private applyEvents(events: EventDTO[]): void {
    this.eventSnapshot = events;
    this.calendarEvents = events.map(event => ({
      id: event.id, title: event.title, start: event.startDateTime, end: event.endDateTime,
      extendedProps: { type: event.type, description: event.description, finished: this.isEventFinished(event), activityType: event.activityType }
    }));
    this.upcomingEvents = events.filter(event => !this.isEventFinished(event))
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
    this.calendarOptions = { ...this.calendarOptions, events: this.calendarEvents };
    this.isLoading = false;
    this.loadError = '';
    this.tryOpenEventFromQuery();
    if (this.viewMode === 'calendar') setTimeout(() => this.updateResponsiveCalendarLayout());
  }

  private listenForUpdates() {
    this.eventUpdatesSubscription = this.eventService.listenForEventUpdate().subscribe((message) => {
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : message;
        if (parsed.action === 'INIT' && Array.isArray(parsed.events)) {
          this.snapshotRevision++;
          this.applyEvents(parsed.events);
        } else if (['ADD', 'UPDATE', 'DELETE'].includes(parsed.action) && Array.isArray(parsed.events)) {
          if (this.isLoading) {
            this.pendingUpdates.push(parsed);
          } else {
            this.applyEvents(this.mergeUpdate(this.eventSnapshot, parsed));
          }
        }
      } catch {
        // Ignore malformed realtime messages; the HTTP snapshot stays usable.
      }
    });

  }

  private mergeUpdate(snapshot: EventDTO[], update: { action: string; events: EventDTO[] }): EventDTO[] {
    const affected = new Set(update.events.map(event => String(event.id)));
    const remaining = snapshot.filter(event => !affected.has(String(event.id)));
    return update.action === 'DELETE' ? remaining : [...remaining, ...update.events];
  }

  private isEventFinished(event: any): boolean {
    const raw = event?.finished ?? event?.isFinished;
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'finished'].includes(normalized)) return true;
    }

    const endValue = event?.endDateTime ?? event?.end;
    if (endValue) {
      const endDate = new Date(endValue);
      if (!Number.isNaN(endDate.getTime())) {
        return endDate.getTime() < Date.now();
      }
    }
    return false;
  }

  private escapeHtml(input: string): string {
    return (input || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  formatEventDescription(description?: string | null): SafeHtml {
    if (!description) {
      return '';
    }
    const escaped = this.escapeHtml(description);
    const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const withLineBreaks = withBold.replace(/\r?\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(withLineBreaks);
  }

  onEventClick(arg: any): void {
    const event = arg.event;
    if (event.extendedProps.activityType === 'OPERATION') {
      this.router.navigate(['/icy/operations', event.id]);
      return;
    }
    this.openEventModal({
      id: event.id,
      title: event.title,
      type: event.extendedProps.type,
      description: event.extendedProps.description,
      startDateTime: event.startStr,
      endDateTime: event.endStr,
      finished: event.extendedProps.finished
    });
  }

  openEventOrOperation(event: any): void {
    if (event.activityType === 'OPERATION') {
      this.router.navigate(['/icy/operations', event.id]);
      return;
    }
    this.openEventModal(event);
  }

  initializeParticipationData() {
    this.participationSubscription?.unsubscribe();
    const eventId = this.selectedEvent.id;
    this.isParticipationLoading = true;
    this.participationError = '';
    this.participationSubscription = this.eventService.getParticipations(eventId).subscribe({next: (response: any) => {
      if (this.selectedEvent?.id !== eventId) return;
      this.isParticipationLoading = false;
      const participations = response.data || [];
      try {
        const userId = this.authService.getUserIdFromToken();
        const own = participations.find((p: any) => String(p.user?.id) === userId);
        this.selectedParticipationStatus = own?.status ?? null;
        this.participationLabels[eventId] = own?.status === 1 ? 'Participation confirmée'
          : own?.status === 0 ? 'Peut-être' : own?.status === -1 ? 'Indisponible' : 'Sans réponse';
      } catch { /* No participation label without an identified user. */ }
      this.participationsByStatus = {
        confirmed: participations.filter((p: any) => p.status === 1),
        maybe: participations.filter((p: any) => p.status === 0),
        refused: participations.filter((p: any) => p.status === -1)
      };

      if (this.showConfirmedFleets) {
        this.loadConfirmedFleets();
      }
    }, error: () => {
      if (this.selectedEvent?.id !== eventId) return;
      this.isParticipationLoading = false;
      this.participationError = 'Impossible de charger les participations.';
    }});
  }

  setParticipationStatus(status: number) {
    if (!this.selectedEvent || this.isParticipationSaving || this.isEventFinished(this.selectedEvent)) return;
    const eventId = this.selectedEvent.id;
    this.isParticipationSaving = true;
    this.participationError = '';
    this.eventService.setParticipationStatus(eventId, status).subscribe({
      next: () => {
        if (this.selectedEvent?.id !== eventId) return;
        this.isParticipationSaving = false;
        this.selectedParticipationStatus = status;
        this.initializeParticipationData();
      },
      error: () => {
        if (this.selectedEvent?.id !== eventId) return;
        this.isParticipationSaving = false;
        this.participationError = 'Votre réponse n’a pas été enregistrée. Veuillez réessayer.';
      }
    });
  }

  private pendingEventId: string | null = null;

  private tryOpenEventFromQuery(): void {
    if (!this.pendingEventId || !this.calendarEvents.length) return;

    const match = this.calendarEvents.find(evt => String(evt.id) === String(this.pendingEventId));
    if (!match) {
      this.pendingEventId = null;
      return;
    }

    if (match.extendedProps?.activityType === 'OPERATION') {
      const operationId = match.id;
      this.pendingEventId = null;
      this.router.navigate(['/icy/operations', operationId]);
      return;
    }

    this.openEventModal({
      id: match.id,
      title: match.title,
      type: match.extendedProps?.type,
      description: match.extendedProps?.description,
      startDateTime: match.start,
      endDateTime: match.end,
      finished: match.extendedProps?.finished
    });

    this.pendingEventId = null;
    this.router.navigate([], { queryParams: { eventId: null }, queryParamsHandling: 'merge' });
  }

  openEventModal(payload: any): void {
    this.selectedEvent = { ...payload, finished: this.isEventFinished(payload) };
    this.showDetailsModal = true;
    this.showConfirmedFleets = false;
    this.isFleetLoading = false;
    this.fleetByBrand = {};
    this.fleetBrandKeys = [];
    this.participationsByStatus = { confirmed: [], maybe: [], refused: [] };
    this.selectedParticipationStatus = null;
    this.isParticipationSaving = false;
    this.initializeParticipationData();
  }

  toggleConfirmedFleets(): void {
    this.showConfirmedFleets = !this.showConfirmedFleets;
    if (this.showConfirmedFleets) {
      this.loadConfirmedFleets();
    }
  }

  private loadConfirmedFleets(): void {
    const confirmedUsers = this.participationsByStatus.confirmed
      .map((p: any) => p.user)
      .filter((user: any) => user?.id);
    const uniqueUserIds = Array.from(new Set(confirmedUsers.map((user: any) => user.id))) as string[];

    if (!uniqueUserIds.length || !this.selectedEvent?.id) {
      this.fleetByBrand = {};
      this.fleetBrandKeys = [];
      return;
    }

    this.isFleetLoading = true;
    const requests = uniqueUserIds.map((userId: string) => {
      const cacheKey = `${this.selectedEvent.id}:${userId}`;
      if (this.userFleetCache[cacheKey]) {
        return of(this.userFleetCache[cacheKey]);
      }

      return this.shipService.getConfirmedParticipantShips(this.selectedEvent.id, userId).pipe(
        map((res: any) => {
          const mapped = (res?.data || []).map((ship: any) => ({
            name: ship.name,
            imageUrl: ship.imageUrl,
            brandName: ship.brand,
            brandImageUrl: ship.brandImageUrl
          })) as FleetMiniShip[];
          this.userFleetCache[cacheKey] = mapped;
          return mapped;
        }),
        catchError((err) => {
          console.error('Erreur récupération flotte participant', userId, err);
          return of([] as FleetMiniShip[]);
        })
      );
    });

    forkJoin(requests)
      .pipe(finalize(() => (this.isFleetLoading = false)))
      .subscribe((fleets: FleetMiniShip[][]) => {
        const allShips = fleets.flat();
        this.fleetByBrand = this.groupShipsByBrand(allShips);
        this.fleetBrandKeys = Object.keys(this.fleetByBrand).sort((a, b) => a.localeCompare(b));
      });
  }

  private groupShipsByBrand(ships: FleetMiniShip[]): Record<string, FleetMiniShip[]> {
    const grouped: Record<string, { name: string; imageUrl?: string; brandImageUrl?: string; count: number }[]> = {};

    for (const ship of ships) {
      const brandName = ship.brandName || 'Marque inconnue';
      if (!grouped[brandName]) {
        grouped[brandName] = [];
      }

      const existing = grouped[brandName].find((item) => item.name === ship.name);
      if (existing) {
        existing.count += 1;
      } else {
        grouped[brandName].push({
          name: ship.name,
          imageUrl: ship.imageUrl,
          brandImageUrl: ship.brandImageUrl,
          count: 1
        });
      }
    }

    const finalGrouped: Record<string, FleetMiniShip[]> = {};
    for (const brand of Object.keys(grouped)) {
      finalGrouped[brand] = grouped[brand].map((item) => ({
        name: item.count > 1 ? `${item.name} (${item.count})` : item.name,
        imageUrl: item.imageUrl,
        brandImageUrl: item.brandImageUrl
      }));
    }

    return finalGrouped;
  }
}
