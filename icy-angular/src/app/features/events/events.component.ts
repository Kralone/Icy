import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarModule } from '@fullcalendar/angular';
import { EventService, EventCreateRequest } from '../../core/services/event/event.service'; // adapter le chemin si besoin

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './events.component.html'
})
export class EventsComponent {
  showModal = false;

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
    }
  };

  constructor(private eventService: EventService) {}

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
}
