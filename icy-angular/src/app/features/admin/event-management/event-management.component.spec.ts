import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventManagementComponent } from './event-management.component';
import {coreTestProviders} from '@testing/test-providers';
import { HttpTestingController } from '@angular/common/http/testing';

describe('EventManagementComponent', () => {
  let component: EventManagementComponent;
  let fixture: ComponentFixture<EventManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventManagementComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels a draft operation as a draft, not as an upcoming event', () => {
    const type = { id: 1, name: 'Escorte' } as any;
    const base = { type, description: '', startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', createdAt: '2099-10-01T10:00:00' };
    component.events = [
      { ...base, id: 'a', title: 'Brouillon', finished: false, activityType: 'OPERATION', draft: true },
      { ...base, id: 'b', title: 'Publiée', finished: false, activityType: 'OPERATION', draft: false },
      { ...base, id: 'c', title: 'Passé', finished: true, activityType: 'EVENT' }
    ];
    component.paginatedEvents = component.events;
    component.isLoadingEvents = false;
    fixture.detectChanges();

    const statuses = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')).map(row => (row as HTMLElement).querySelector('td:nth-child(5)')!.textContent!.trim());
    expect(statuses).toEqual(['Brouillon', 'À venir', 'Terminé']);
  });

  it('sends the chosen poles when creating and when updating an event', () => {
    const http = TestBed.inject(HttpTestingController);
    const choice = (key: string) => fixture.nativeElement.querySelector(`[data-testid="new-event-pole-${key}"]`) as HTMLButtonElement;
    choice('INDUSTRIE').click();
    fixture.detectChanges();
    choice('LOGISTIQUE').click();
    fixture.detectChanges();
    expect(component.newEvent.poles).toEqual(['LOGISTIQUE', 'INDUSTRIE']);
    expect(choice('MILITAIRE').getAttribute('aria-pressed')).toBe('false');

    component.newEvent = { ...component.newEvent, title: 'Sortie', type: 'Minage', startDateTime: '2099-10-20T20:00', endDateTime: '2099-10-20T23:00' };
    component.createEvent();
    const created = http.expectOne({ method: 'POST', url: '/api/events/create' });
    expect(created.request.body.poles).toEqual(['LOGISTIQUE', 'INDUSTRIE']);
    created.flush({ data: {} });

    // Une réponse à l'ancien format (un seul pôle) est reprise telle quelle.
    component.editingEvent = { id: 'a', title: 'Sortie', description: '', startDateTime: '2099-10-20T20:00', endDateTime: '2099-10-20T23:00', finished: false, type: { name: 'Minage' }, pole: 'MILITAIRE' } as any;
    component.isViewMode = false;
    component.updateEvent();
    const updated = http.expectOne({ method: 'PUT', url: '/api/events/update' });
    expect(updated.request.body.poles).toEqual(['MILITAIRE']);
    updated.flush({ data: {} });

    component.editingEvent = { id: 'a', title: 'Sortie', description: '', startDateTime: '2099-10-20T20:00', endDateTime: '2099-10-20T23:00', finished: false, type: { name: 'Minage' }, poles: [] } as any;
    component.updateEvent();
    const cleared = http.expectOne({ method: 'PUT', url: '/api/events/update' });
    expect(cleared.request.body.poles).toEqual([]);
    cleared.flush({ data: {} });
  });
});
