import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsComponent } from './events.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {Subject} from 'rxjs';
import {HttpTestingController} from '@angular/common/http/testing';
import {registerLocaleData} from '@angular/common';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;
  let updates: Subject<string>;

  beforeEach(async () => {
    updates = new Subject<string>();
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [
        ...coreTestProviders,
        {
          provide: WebSocketService,
          useValue: {connectEvent: () => undefined, disconnectEvent: () => undefined, listenForEvent: () => updates},
        },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates the calendar heading after rendering and when changing the period', async () => {
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.calendarTitle).toBe(component.calendarComponent?.getApi().view.title);
    component.changeCalendarView('dayGridWeek');
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.calendarView).toBe('dayGridWeek');
    expect(component.calendarTitle).toBe(component.calendarComponent?.getApi().view.title);
  });

  it('loads from HTTP without waiting for WebSocket and sorts future events', () => {
    TestBed.inject(HttpTestingController).expectOne('/api/events/all').flush({data: [
      {id: 'later', title: 'Later', type: {name: 'Minage'}, startDateTime: '2099-06-10T20:00:00', finished: false},
      {id: 'past', title: 'Past', type: {name: 'Minage'}, startDateTime: '2020-06-01T20:00:00', finished: true},
      {id: 'first', title: 'First', type: {name: 'Minage'}, startDateTime: '2099-06-01T20:00:00', finished: false}
    ]});
    fixture.detectChanges();
    expect(component.isLoading).toBe(false);
    expect(component.upcomingEvents.map(event => event.id)).toEqual(['first', 'later']);
    expect(component.calendarEvents.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.agenda-event').length).toBe(2);
  });

  it('marks an operation in the agenda and leaves a classic event as it was', () => {
    TestBed.inject(HttpTestingController).expectOne('/api/events/all').flush({data: [
      {id: 'classic', title: 'Soirée minage', type: {name: 'Minage'}, startDateTime: '2099-06-01T20:00:00', finished: false, activityType: 'EVENT'},
      {id: 'op', title: 'Carinite pure', type: {name: 'Minage'}, startDateTime: '2099-06-02T20:00:00', finished: false, activityType: 'OPERATION'}
    ]});
    fixture.detectChanges();
    const [classic, operation] = Array.from(fixture.nativeElement.querySelectorAll('.agenda-event')) as HTMLElement[];
    expect(classic.classList).not.toContain('agenda-event--operation');
    expect(classic.querySelector('.operation-badge')).toBeNull();
    expect(classic.querySelector('.agenda-open')!.textContent).toContain('Détails');
    expect(operation.classList).toContain('agenda-event--operation');
    expect(operation.querySelector('.operation-badge')!.textContent!.trim()).toBe('◆ Opération');
    // Le type garde son libellé et son encadré habituels ; l'emblème est à droite du texte.
    expect(operation.querySelector('.agenda-type')!.textContent!.trim()).toBe('Minage');
    expect(operation.querySelector('.operation-emblem')).not.toBeNull();
    expect(classic.querySelector('.operation-emblem')).toBeNull();
    expect(operation.querySelector('.agenda-open')!.textContent).toContain('Voir l’opération');
  });

  it('offers retry after failure and distinguishes an empty agenda', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/events/all').flush({}, {status: 503, statusText: 'Unavailable'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Réessayer');
    component.reloadEvents();
    http.expectOne('/api/events/all').flush({data: []});
    fixture.detectChanges();
    expect(component.loadError).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Aucun événement à venir');
  });

  it('retains a newer live snapshot when the HTTP response arrives afterwards', () => {
    updates.next(JSON.stringify({action: 'INIT', events: [
      {id: 'live', title: 'Live', type: {name: 'Minage'}, startDateTime: '2099-06-01T20:00:00'}
    ]}));
    TestBed.inject(HttpTestingController).expectOne('/api/events/all').flush({data: []});
    expect(component.calendarEvents.map(event => event.id)).toEqual(['live']);
  });

  it('merges updates during loading and removes deleted events', () => {
    updates.next(JSON.stringify({action: 'ADD', events: [
      {id: 'new', title: 'New', type: {name: 'Minage'}, startDateTime: '2099-06-01T20:00:00'}
    ]}));
    TestBed.inject(HttpTestingController).expectOne('/api/events/all').flush({data: [
      {id: 'old', title: 'Old', type: {name: 'Minage'}, startDateTime: '2099-06-02T20:00:00'}
    ]});
    expect(component.calendarEvents.length).toBe(2);
    updates.next(JSON.stringify({action: 'DELETE', events: [{id: 'old'}]}));
    expect(component.calendarEvents.map(event => event.id)).toEqual(['new']);
  });

  it('shows a recoverable error when saving participation fails', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/events/all').flush({data: []});
    component.openEventModal({id: 'event', title: 'Sortie', startDateTime: '2099-06-01T20:00:00'});
    http.expectOne('/api/events/participation?eventId=event').flush({data: []});
    component.setParticipationStatus(1);
    expect(component.isParticipationSaving).toBe(true);
    http.expectOne('/api/events/participation').flush({}, {status: 500, statusText: 'Error'});
    expect(component.isParticipationSaving).toBe(false);
    expect(component.participationError).toContain('n’a pas été enregistrée');
  });
});
