import {Component, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import {FullCalendarComponent, FullCalendarModule} from '@fullcalendar/angular';
import {EventService, EventCreateRequest, EventDTO} from '../../core/services/event/event.service';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import * as events from 'node:events';

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
  eventTypes: string[] = ['Minage', 'Salvage', 'Exploration', 'Combat', 'Event in game'];

  selectedEvent: any = null;
  showDetailsModal = false;

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  newEvent: EventCreateRequest = {
    type: '',
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: ''
  };

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    locale: 'fr',
    firstDay: 1,
    events: [],
    height: '95%',
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
    eventDidMount: this.decorateEventCell.bind(this)
  };
  isLoading = false;
  editMode = false;

  constructor(private eventService: EventService, private wsService: WebSocketService) {}

  ngAfterViewInit() {
    this.wsService.connectEvent();

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
            this.calendarComponent?.getApi().addEvent({
              id: parsed.event.id,
              title: parsed.event.title,
              start: parsed.event.startDateTime,
              end: parsed.event.endDateTime,
              extendedProps: {
                type: parsed.event.type,
                description: parsed.event.description,
                finished: parsed.event.finished
              }
            });
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
      html: `<span class="font-mono text-sm">${startTime} | ${arg.event.title}</span>`
    };
  }

  decorateEventCell(info: any) {
    const type = info.event.extendedProps?.type?.toLowerCase() || 'default';
    const imageUrl = `https://i.ytimg.com/vi/R9VbhY3ZVCw/maxresdefault.jpg`;

    const el = info.el; // l'élément HTML de l'event

    // remonte jusqu’à la cellule jour (td)
    const dayCell = el.closest('.fc-daygrid-day');

    if (dayCell) {
      dayCell.style.backgroundImage = `url('${imageUrl}')`;
      dayCell.style.backgroundSize = 'cover';
      dayCell.style.backgroundPosition = 'center';
    }
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


}
