import {Component, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import {FullCalendarComponent, FullCalendarModule} from '@fullcalendar/angular';
import {EventService, EventDTO} from '../../core/services/event/event.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {EventType} from '../../model/event-type.model';
import {AuthService} from '../../core/services/auth/auth.service';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, RouterLink],
  templateUrl: './events.component.html'
})
export class EventsComponent {
  calendarEvents: any[] = [];
  messages: string[] = [];
  selectedEvent: any = null;
  showDetailsModal = false;
  types: EventType[] = [];

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  participationsByStatus = {
    confirmed: [] as any[],
    maybe: [] as any[],
    refused: [] as any[]
  };

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    locale: 'fr',
    firstDay: 1,
    events: [],
    height: 'auto',
    contentHeight: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek'
    },
    buttonText: {
      today:    'Aujourd\'hui',
      month:    'Mois',
      week:     'Semaine',
      day:      'Jour',
      list:     'Liste'
    },
    eventContent: this.renderCustomEvent.bind(this),
    eventClick: this.onEventClick.bind(this),
    eventDidMount: this.applyBackgroundColor.bind(this),
  };

  isLoading = false;
  isAdmin = false;

  constructor(
    private eventService: EventService,
    private wsService: WebSocketService,
    private authService: AuthService
  ) {}

  ngAfterViewInit() {
    this.wsService.connectEvent();
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.isLoading = true;

    this.eventService.listenForEventUpdate().subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        if (Array.isArray(parsed.events) && parsed.events.length > 0 && parsed.action === 'INIT') {
          console.log('📦 Chargement initial des events');

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
        } else if (parsed.action === 'ADD' || parsed.action === 'DELETE' || parsed.action === 'UPDATE') {
          if (parsed.action === 'ADD') {
            parsed.event = parsed.events[0];
            this.calendarEvents.push({
              id: parsed.event.id,
              title: parsed.event.title,
              start: parsed.event.startDateTime,
              end: parsed.event.endDateTime,
              backgroundColor: parsed.event.type.backgroundColor,
              extendedProps: {
                type: parsed.event.type,
                description: parsed.event.description,
                finished: parsed.event.finished
              }
            });
            this.calendarOptions.events = [...this.calendarEvents];
          } else if (parsed.action === 'DELETE') {
            this.calendarEvents = this.calendarEvents.filter(e => e.id !== parsed.events[0].id);
            this.calendarOptions.events = [...this.calendarEvents];
          } else if (parsed.action === 'UPDATE') {
            const updated = parsed.events[0];
            this.calendarEvents = this.calendarEvents.map(ev =>
              ev.id === updated.id
                ? {
                  ...ev,
                  title: updated.title,
                  start: updated.startDateTime,
                  end: updated.endDateTime,
                  extendedProps: {
                    type: updated.type,
                    description: updated.description,
                    finished: updated.finished
                  }
                }
                : ev
            );
            this.calendarOptions.events = [...this.calendarEvents];
          }
        }
      } catch {
        this.messages.push(message);
      }
    });

    this.eventService.getAllTypes().subscribe(response => {
      this.types = response;
    });
  }

  renderCustomEvent(arg: any): { html: string } {
    const startTime = new Date(arg.event.start).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      html: `<span class="font-mono text-sm" style="color: ${arg.event.extendedProps.type.textColor}">${startTime} | ${arg.event.title}</span>`
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
      next: () => {
        console.log('Participation enregistrée avec succès');
        this.initializeParticipationData();
      },
      error: (err) => {
        console.error('Erreur lors de la participation', err);
      }
    });
  }
}
