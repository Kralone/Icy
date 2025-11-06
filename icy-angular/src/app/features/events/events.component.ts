import { Component, HostListener, ViewChild, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { EventService, EventDTO } from '../../core/services/event/event.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { EventType } from '../../model/event-type.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, RouterLink],
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

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    locale: 'fr',
    firstDay: 1,
    initialView: 'dayGridWeek', // 🧊 desktop par défaut
    height: '100%',
    expandRows: true,
    contentHeight: '100%',
    handleWindowResize: true,
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
      // ✅ vue 3 jours valide (dayGridWeek + duration)
      threeDay: {
        type: 'dayGridWeek',
        duration: { days: 3 },
        buttonText: '3 jours'
      }
    },
    eventContent: (arg) => this.renderCustomEvent(arg),
    eventClick: (arg) => this.onEventClick(arg),
    eventDidMount: (info) => this.applyBackgroundColor(info),
  };

  constructor(
    private eventService: EventService,
    private wsService: WebSocketService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    this.wsService.connectEvent();
    this.authService.isAdmin().subscribe(isAdmin => (this.isAdmin = isAdmin));
    this.isLoading = true;
    this.loadEvents();

    // 🕓 Attendre que FullCalendar soit rendu avant d'appliquer la vue
    this.ngZone.onStable.subscribe(() => {
      this.updateCalendarView();
    });
  }

  @HostListener('window:resize', [])
  onWindowResize() {
    this.updateCalendarView();
  }

  private updateCalendarView() {
    const calendarApi = this.calendarComponent?.getApi();
    if (!calendarApi) return;

    const isMobile = window.innerWidth < 640;
    const newView = isMobile ? 'threeDay' : 'dayGridWeek';

    if (calendarApi.view.type !== newView) {
      calendarApi.changeView(newView);
      console.log(`📆 Vue changée → ${newView}`);
    }

    // Force toujours la hauteur 100%
    calendarApi.setOption('height', '100%');
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
            backgroundColor: event.type.backgroundColor,
            extendedProps: {
              type: event.type,
              description: event.description,
              finished: event.finished
            }
          }));
          this.calendarOptions.events = this.calendarEvents;
          this.isLoading = false;
        }
      } catch {
        console.warn('Erreur de parsing', message);
      }
    });

    this.eventService.getAllTypes().subscribe(res => (this.types = res));
  }

  renderCustomEvent(arg: any): { html: string } {
    const startTime = new Date(arg.event.start).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      html: `
        <div class="flex items-center gap-1 px-1 w-full overflow-hidden text-ellipsis whitespace-nowrap">
          <span class="font-mono text-[11px] sm:text-sm truncate"
                style="color: ${arg.event.extendedProps.type.textColor}">
            ${startTime} | ${arg.event.title}
          </span>
        </div>
      `
    };
  }

  applyBackgroundColor(info: any) {
    const color = info.event.extendedProps?.type?.backgroundColor;
    const isFinished = info.event.extendedProps?.finished;
    if (color) {
      const rgba = isFinished ? this.hexToRgba(color, 0.25) : color;
      info.el.style.backgroundColor = rgba;
    }
  }

  private hexToRgba(hex: string, opacity: number): string {
    const sanitizedHex = hex.replace('#', '');
    const bigint = parseInt(sanitizedHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  onEventClick(arg: any): void {
    const event = arg.event;
    this.selectedEvent = {
      id: event.id,
      title: event.title,
      type: event.extendedProps.type,
      description: event.extendedProps.description,
      startDateTime: event.startStr,
      endDateTime: event.endStr,
      finished: event.extendedProps.finished
    };
    this.showDetailsModal = true;
    this.initializeParticipationData();
  }

  private initializeParticipationData() {
    this.eventService.getParticipations(this.selectedEvent.id).subscribe((response: any) => {
      const participations = response.data;
      this.participationsByStatus = {
        confirmed: participations.filter((p: any) => p.status === 1),
        maybe: participations.filter((p: any) => p.status === 0),
        refused: participations.filter((p: any) => p.status === -1)
      };
    });
  }

  setParticipationStatus(status: number) {
    if (!this.selectedEvent) return;
    this.eventService.setParticipationStatus(this.selectedEvent.id, status).subscribe({
      next: () => this.initializeParticipationData(),
      error: (err) => console.error('Erreur lors de la participation', err)
    });
  }
}
