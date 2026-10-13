import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventManagementComponent } from './event-management.component';
import {coreTestProviders} from '@testing/test-providers';

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
});
