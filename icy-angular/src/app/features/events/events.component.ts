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

  messages: string[] = [];
  eventTypes: string[] = ['Minage', 'Salvage', 'Exploration', 'Combat', 'Event in game'];

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
    eventContent: this.renderCustomEvent.bind(this)
  };

  isLoading = false;

  constructor(private eventService: EventService, private wsService: WebSocketService) {}

  ngOnInit() {
    this.wsService.connectEvent();

    this.isLoading = true;

    this.eventService.listenForEventUpdate().subscribe((message) => {
      try {
        const parsed = JSON.parse(message);

        if(Array.isArray(parsed.events) && parsed.events.length > 0 && parsed.action === 'INIT') {
          console.log('📦 Chargement initial des events');

            this.calendarOptions.events = parsed.events.map((event: EventDTO) => ({
              title: event.title,
              start: event.startDateTime,
              end: event.endDateTime,
              extendedProps: {
                type: event.type,
                description: event.description,
                finished: event.finished
              }
            }));

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
            const existingEvent = this.calendarComponent?.getApi().getEventById(parsed.event.id);
            existingEvent?.remove();
          } else if(parsed.action === 'UPDATE') {
            const existingEvent = this.calendarComponent?.getApi().getEventById(parsed.event.id);
            existingEvent?.setProp('title', parsed.event.title);
            existingEvent?.setProp('start', parsed.event.startDateTime);
            existingEvent?.setProp('end', parsed.event.endDateTime);
            existingEvent?.setProp('extendedProps', {
              type: parsed.event.type,
              description: parsed.event.description,
              finished: parsed.event.finished
            });
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
    this.eventService.createEvent(this.newEvent).subscribe({
      next: (createdEvent) => {
        this.calendarOptions.events = [
          ...(this.calendarOptions.events as any[]),
          {
            title: createdEvent.title,
            date: createdEvent.startDateTime
          }
        ];
        this.closeModal();
      },
      error: err => console.error('Erreur lors de la création de l’événement', err)
    });
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



}
