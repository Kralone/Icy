import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import dayGridPlugin from '@fullcalendar/daygrid';
import {FullCalendarModule} from '@fullcalendar/angular';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FullCalendarModule],
  templateUrl: './events.component.html',
})
export class EventsComponent {
  calendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    locale: 'fr',
    firstDay: 1,
    events: [
      { title: 'Réunion équipe', date: '2025-04-10' },
      { title: 'Test technique', date: '2025-04-15' },
      { title: 'Maintenance serveur', date: '2025-04-21' }
    ],
    height: 'auto',
    buttonText: {
      today:    'Aujourd\'hui',
      month:    'Mois',
      week:     'Semaine',
      day:      'Jour',
      list:     'Liste'
    }
  };
}
