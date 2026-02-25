import { Component, HostListener, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions, DatesSetArg, ViewApi } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { EventService, EventDTO } from '../../core/services/event/event.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { EventType } from '../../model/event-type.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShipService } from '../../core/services/ship/ship.service';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { EventDetailsModalComponent } from './event-details-modal/event-details-modal.component';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';

type FleetMiniShip = {
  name: string;
  imageUrl?: string;
  brandName?: string;
  brandImageUrl?: string;
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, RouterLink, EventDetailsModalComponent, LoadingOverlayComponent],
  templateUrl: './events.component.html'
})
export class EventsComponent implements AfterViewInit {
  @ViewChild(FullCalendarComponent) calendarComponent?: FullCalendarComponent;

  calendarEvents: any[] = [];
  types: EventType[] = [];
  selectedEvent: any = null;
  showDetailsModal = false;
  isLoading = false;
  isAdmin = false;

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
  private desktopPreferredView: ViewApi['type'] = 'dayGridWeek';
  private mobilePreferredView: ViewApi['type'] = 'threeDay';

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    locale: 'fr',
    firstDay: 1,
    fixedWeekCount: false,
    initialView: 'dayGridWeek',
    height: '100%',
    expandRows: true,
    contentHeight: '100%',
    handleWindowResize: true,

    // ✅ Important: laisse nos cartes prendre leur place
    eventDisplay: 'block',

    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'threeDay,dayGridWeek,dayGridMonth'
    },
    buttonText: {
      today: 'Aujourd\'hui',
      month: 'Mois',
      week: 'Semaine',
      threeDay: '3 jours'
    },
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

    eventContent: (arg) => this.renderIcyEvent(arg),
    eventClick: (arg) => this.onEventClick(arg),
    datesSet: (arg) => this.onDatesSet(arg),

    // ✅ Ajoute classes + états (finished, image/no-image) + sécurité affichage
    eventDidMount: (info) => this.onEventDidMount(info),
  };

  constructor(
    private eventService: EventService,
    private wsService: WebSocketService,
    private authService: AuthService,
    private shipService: ShipService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngAfterViewInit() {
    this.wsService.connectEvent();
    this.authService.isAdmin().subscribe(isAdmin => (this.isAdmin = isAdmin));

    this.isLoading = true;
    this.loadEvents();

    this.route.queryParamMap.subscribe(params => {
      const eventId = params.get('eventId');
      if (eventId) {
        this.pendingEventId = eventId;
        this.tryOpenEventFromQuery();
      }
    });
    setTimeout(() => this.updateResponsiveCalendarLayout(true));
  }

  @HostListener('window:resize', [])
  onWindowResize() {
    this.updateResponsiveCalendarLayout();
  }

  private updateResponsiveCalendarLayout(force = false) {
    const calendarApi = this.calendarComponent?.getApi();
    if (!calendarApi) return;

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      // Mobile is intentionally locked to the 3-day view.
      this.mobilePreferredView = 'threeDay';
    }
    if (!force && this.lastIsMobile === isMobile) {
      calendarApi.updateSize();
      return;
    }

    const targetView = isMobile ? this.mobilePreferredView : this.desktopPreferredView;

    calendarApi.setOption('headerToolbar', isMobile
      ? { left: 'prev,next', center: 'title', right: 'today' }
      : { left: 'prev,next today', center: 'title', right: 'threeDay,dayGridWeek,dayGridMonth' });
    calendarApi.setOption('footerToolbar', isMobile
      ? { left: 'threeDay', center: '', right: '' }
      : false);

    if (calendarApi.view.type !== targetView) {
      calendarApi.changeView(targetView);
    }

    calendarApi.updateSize();
    this.lastIsMobile = isMobile;
  }

  private onDatesSet(arg: DatesSetArg): void {
    const type = arg.view.type as ViewApi['type'];
    if (window.innerWidth < 640 && type !== 'threeDay') {
      this.mobilePreferredView = 'threeDay';
      this.calendarComponent?.getApi().changeView('threeDay');
      return;
    }

    if (type === 'threeDay') {
      this.mobilePreferredView = type;
      return;
    }
    if (type === 'dayGridWeek' || type === 'dayGridMonth') {
      this.desktopPreferredView = type;
    }
  }

  private loadEvents() {
    this.eventService.listenForEventUpdate().subscribe((message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.action === 'INIT' && Array.isArray(parsed.events)) {
          this.calendarEvents = parsed.events.map((event: EventDTO) => ({
            id: event.id,
            title: event.title,
            start: event.startDateTime,
            end: event.endDateTime,

            // on stocke tout dans extendedProps
            extendedProps: {
              type: event.type,
              description: event.description,
              finished: this.isEventFinished(event)
            }
          }));

          this.calendarOptions.events = this.calendarEvents;
          this.isLoading = false;
          this.updateResponsiveCalendarLayout(true);
          this.tryOpenEventFromQuery();
        }
      } catch {
        console.warn('Erreur de parsing', message);
      }
    });

    this.eventService.getAllTypes().subscribe(res => (this.types = res));
  }

  private isEventFinished(event: any): boolean {
    const raw = event?.finished ?? event?.isFinished;
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'finished'].includes(normalized)) return true;
      if (['false', '0', 'no', 'ongoing'].includes(normalized)) return false;
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

// ✅ Rendu “carte” ICY : image en haut + pill en bas
  renderIcyEvent(arg: any): { html: string } {
    const type = arg.event.extendedProps?.type as EventType | undefined;

    const img = type?.imageUrl?.trim();
    const hasImg = !!img;

    const pillBg = type?.backgroundColor?.trim() || '#0ea5e9';
    const pillText = type?.textColor?.trim() || '#e0f2ff';

    const finished = this.isEventFinished({
      finished: arg.event.extendedProps?.finished,
      end: arg.event.end
    });

    // ✅ startTime défini
    const startTime = arg.event.start
      ? new Date(arg.event.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';

    // (optionnel) sécurité HTML si tu veux éviter les titres “bizarres”
    const safeTitle = this.escapeHtml(arg.event.title || '');
    const safeTime = this.escapeHtml(startTime);

    const typeName = (type?.name || '').trim();
    const safeType = this.escapeHtml(typeName || '');

// si tu veux que le spacer existe même sans image (layout stable)
    const spacerStyle = hasImg ? `background-image: url('${img}')` : `background-image: none`;

    return {
      html: `
    <div class="icy-event-host ${finished ? 'icy-event-host--finished' : ''}">
      <div class="icy-event__inner">

        ${typeName ? `
          <div class="icy-event__type"
               style="
                 background: ${pillBg};
                 color: ${pillText};
                 border-color: ${pillBg};
               ">
            ${safeType}
          </div>
        ` : ''}

        <div class="icy-event__spacer" style="${spacerStyle}"></div>

        <div class="icy-pill"
             style="
               background: ${pillBg};
               border-color: ${pillBg};
               color: ${pillText};
             ">
          <span class="icy-pill__time">${safeTime}</span>
          <span class="icy-pill__sep">|</span>
          <span class="icy-pill__title">${safeTitle}</span>
        </div>

      </div>
    </div>
  `
    };


  }


  private onEventDidMount(info: any) {
    const type = info.event.extendedProps?.type as EventType | undefined;
    const finished = this.isEventFinished({
      finished: info.event.extendedProps?.finished,
      end: info.event.end
    });
    const hasImg = !!type?.imageUrl?.trim();

    info.el.classList.add('icy-event'); // hook global
    info.el.classList.add('icy-event--enter');
    if (finished) info.el.classList.add('icy-event--finished');
    if (hasImg) info.el.classList.add('icy-event--has-image');
    else info.el.classList.add('icy-event--no-image');

    // le <a> FullCalendar a parfois des styles, on neutralise un peu
    info.el.style.background = 'transparent';
    info.el.style.border = 'none';

    requestAnimationFrame(() => {
      info.el.classList.add('icy-event--enter-visible');
    });
  }

  onEventClick(arg: any): void {
    const event = arg.event;
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

  private initializeParticipationData() {
    this.eventService.getParticipations(this.selectedEvent.id).subscribe((response: any) => {
      const participations = response.data;
      this.participationsByStatus = {
        confirmed: participations.filter((p: any) => p.status === 1),
        maybe: participations.filter((p: any) => p.status === 0),
        refused: participations.filter((p: any) => p.status === -1)
      };

      if (this.showConfirmedFleets) {
        this.loadConfirmedFleets();
      }
    });
  }

  setParticipationStatus(status: number) {
    if (!this.selectedEvent) return;
    this.eventService.setParticipationStatus(this.selectedEvent.id, status).subscribe({
      next: () => this.initializeParticipationData(),
      error: (err) => console.error('Erreur lors de la participation', err)
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

  private openEventModal(payload: any): void {
    this.selectedEvent = payload;
    this.showDetailsModal = true;
    this.showConfirmedFleets = false;
    this.isFleetLoading = false;
    this.fleetByBrand = {};
    this.fleetBrandKeys = [];
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
      .filter((user: any) => user?.discordId);
    const uniqueDiscordIds = Array.from(new Set(confirmedUsers.map((user: any) => user.discordId)));

    if (!uniqueDiscordIds.length) {
      this.fleetByBrand = {};
      this.fleetBrandKeys = [];
      return;
    }

    this.isFleetLoading = true;
    const requests = uniqueDiscordIds.map((discordId: string) => {
      if (this.userFleetCache[discordId]) {
        return of(this.userFleetCache[discordId]);
      }

      return this.shipService.getUserShipsByDiscordId(discordId).pipe(
        map((res: any) => {
          const ships = (res?.data || []).map((item: any) => item.ship).filter(Boolean);
          const mapped = ships.map((ship: any) => ({
            name: ship.name,
            imageUrl: ship.imageUrl,
            brandName: ship.brand?.name,
            brandImageUrl: ship.brand?.imageUrl
          })) as FleetMiniShip[];
          this.userFleetCache[discordId] = mapped;
          return mapped;
        }),
        catchError((err) => {
          console.error('Erreur récupération flotte', discordId, err);
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
