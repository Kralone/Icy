import {Component, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import {FullCalendarComponent, FullCalendarModule} from '@fullcalendar/angular';
import {EventService, EventCreateRequest, EventDTO} from '../../core/services/event/event.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {EventType} from '../../model/event-type.model';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './events.component.html'
})
export class EventsComponent {
  showModal = false;
  calendarEvents: any[] = [];

  messages: string[] = [];

  selectedEvent: any = null;
  showDetailsModal = false;
  types: EventType[] = [];

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  newEvent: EventCreateRequest = {
    type: '',
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: ''
  };

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
    // eventDidMount: this.decorateEventCell.bind(this),
    //todo eventDidUnmount
  };
  isLoading = false;
  editMode = false;

  isAdmin = false;

  constructor(private eventService: EventService, private wsService: WebSocketService, private authService: AuthService) {}

  ngAfterViewInit() {
    this.wsService.connectEvent();
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.isLoading = true;

    this.eventService.listenForEventUpdate().subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        if(Array.isArray(parsed.events) && parsed.events.length > 0 && parsed.action === 'INIT') {
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
        } else if(parsed.action === 'ADD' || parsed.action === 'DELETE' || parsed.action === 'UPDATE') { // update d'un élément
          if(parsed.action === 'ADD') {
            //todo add websocket broken (types in cause)
            parsed.event = parsed.events[0];
            console.log(parsed.event);
            console.log(parsed);
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
          } else if(parsed.action === 'DELETE') {
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
      }
      catch {
        this.messages.push(message);
      }
    })

    this.eventService.getAllTypes().subscribe(response => {
      this.types = response
    });

  }

  openModal() {
    this.showModal = true;
    const now = new Date().toISOString().slice(0, 16);
    this.newEvent.startDateTime = now;
    this.newEvent.endDateTime = now;
  }

  closeModal() {
    this.showModal = false;
    this.newEvent = {
      type: '',
      title: '',
      description: '',
      startDateTime: '',
      endDateTime: ''
    };
  }

  addEventToBackend() {
    console.log('edit mode : ', this.editMode);
    if (this.editMode) {
      this.eventService.updateEvent(this.newEvent).subscribe({
        next: () => {
          this.closeModal(); // Le WS s’occupe du reste
        },
        error: (err) => console.error('Erreur lors de la mise à jour de l’événement', err)
      });
    } else {
      this.eventService.createEvent(this.newEvent).subscribe({
        next: () => {
          this.closeModal(); // Le WS s’occupe du reste
        },
        error: (err) => console.error('Erreur lors de la création de l’événement', err)
      });
    }
  }


  get isFormInvalid(): boolean {
    const { type, title, description, startDateTime, endDateTime } = this.newEvent;

    if (!type || !title || !description || !startDateTime || !endDateTime) return true;

    const now = new Date();
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    return (
      start.getTime() <= now.getTime() || // doit être STRICTEMENT dans le futur
      end.getTime() <= start.getTime()    // fin doit être après début (pas égal)
    );
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

  decorateEventCell(info: any) {
    const imageUrl = info.event.extendedProps?.type?.imageUrl || 'default';

    const el = info.el; // l'élément HTML de l'event

    // remonte jusqu’à la cellule jour (td)
    const dayCell = el.closest('.fc-daygrid-day');

    if (dayCell) {
      dayCell.style.backgroundImage = `url('${imageUrl}')`;
      dayCell.style.backgroundSize = 'cover';
      dayCell.style.backgroundPosition = 'center';
    }
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
    this.editMode = false;
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

  openEditModal() {
    this.editMode = true;
    this.newEvent = { ...this.selectedEvent,
    startDateTime: this.toDatetimeLocalFormat(this.selectedEvent.startDateTime),
    endDateTime: this.toDatetimeLocalFormat(this.selectedEvent.endDateTime)
    };
    this.showDetailsModal = false;
    this.showModal = true;
  }


  deleteSelectedEvent() {
    if (!this.selectedEvent?.id) return;
    this.eventService.deleteEvent(this.selectedEvent.id).subscribe(() => {
      this.showDetailsModal = false;
    });
  }

  private toDatetimeLocalFormat(date: string): string {
    return new Date(date).toISOString().slice(0, 16);
  }

  setParticipationStatus(status: number) {
    if (!this.selectedEvent) return;

    this.eventService.setParticipationStatus(this.selectedEvent.id, status)
      .subscribe({
        next: () => {
          // Optionnel : notification ou mise à jour locale
          console.log('Participation enregistrée avec succès');
          this.initializeParticipationData()
        },
        error: (err) => {
          console.error('Erreur lors de la participation', err);
        }
      });
  }



}
