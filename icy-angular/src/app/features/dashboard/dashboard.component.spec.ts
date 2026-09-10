import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {NEVER, Subject} from 'rxjs';
import {UserService} from '../../core/services/user/user.service';

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

  it('keeps the visible members and page during a silent refresh, including failures', () => {
    const response$ = new Subject<any>();
    const userService = TestBed.inject(UserService);
    const request = vi.spyOn(userService, 'getOnlineUsers').mockReturnValue(response$);
    const dashboard = new DashboardComponent({} as any, {} as any, {} as any, userService, {} as any);
    const members = Array.from({length: 6}, (_, index) => ({id: String(index), username: `member${index}`, status: 'connecte' as const}));
    dashboard.onlineUsers = members;
    dashboard.isOnlineLoading = false;
    dashboard.currentPage = 2;
    dashboard.loadOnlineUsers();
    dashboard.loadOnlineUsers();
    expect(request).toHaveBeenCalledTimes(1);
    expect(dashboard.onlineUsers).toBe(members);
    expect(dashboard.isOnlineLoading).toBe(false);
    response$.next({data: members});
    expect(dashboard.currentPage).toBe(2);
    response$.error(new Error('offline'));
    expect(dashboard.onlineUsers).toBe(members);
  });
});
