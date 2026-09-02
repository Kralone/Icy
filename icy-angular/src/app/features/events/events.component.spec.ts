import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsComponent } from './events.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {NEVER} from 'rxjs';

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [
        ...coreTestProviders,
        {
          provide: WebSocketService,
          useValue: {connectEvent: () => undefined, disconnectEvent: () => undefined, listenForEvent: () => NEVER},
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
});
