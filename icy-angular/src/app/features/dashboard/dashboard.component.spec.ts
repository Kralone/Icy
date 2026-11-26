import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardComponent } from './dashboard.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {NEVER, Subject} from 'rxjs';
import {UserService} from '../../core/services/user/user.service';
import {registerLocaleData} from '@angular/common';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr, 'fr-FR');

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
            watchScWorldEvents: () => NEVER,
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

  it('keeps event titles light: the label color only applies on the type accent', () => {
    component.events = [{ id: 'e1', name: 'Quantumania', date: '2099-11-26T21:00:00', type: 'Minage',
      typeTextColor: '#0b1220', typeBackgroundColor: '#dad416', typeImageUrl: undefined, isOperation: true } as any];
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.dashboard-event') as HTMLElement;
    const title = Array.from(card.querySelectorAll('p')).find(p => p.textContent!.includes('Quantumania')) as HTMLElement;
    expect(title.style.color).toBe('');
    expect(title.classList).toContain('text-white');
    expect(card.style.getPropertyValue('--event-color')).toBe('#dad416');
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
