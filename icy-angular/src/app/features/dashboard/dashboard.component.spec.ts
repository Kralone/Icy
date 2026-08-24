import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {NEVER} from 'rxjs';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        ...coreTestProviders,
        {
          provide: WebSocketService,
          useValue: {
            connectFleetUpdate: () => undefined,
            disconnectFleetUpdate: () => undefined,
            listenForFleetUpdate: () => NEVER,
            connectGoalUpdates: () => undefined,
            disconnectGoalUpdates: () => undefined,
            listenForGoalUpdates: () => NEVER,
          },
        },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
