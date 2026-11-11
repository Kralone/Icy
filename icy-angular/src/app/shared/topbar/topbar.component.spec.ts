import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopbarComponent } from './topbar.component';
import {coreTestProviders} from '@testing/test-providers';
import {WebSocketService} from '../../core/services/websocket/websocket.service';
import {NEVER} from 'rxjs';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        ...coreTestProviders,
        {
          provide: WebSocketService,
          useValue: {
            connectNotifications: () => undefined,
            disconnectNotifications: () => undefined,
            listenForNotifications: () => NEVER,
          },
        },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes the notifications on a click outside, even one that stops propagating', () => {
    const outside = document.createElement('button');
    outside.addEventListener('click', event => event.stopPropagation());
    document.body.appendChild(outside);
    const markAllRead = vi.spyOn(component, 'markAllRead').mockImplementation(() => undefined);
    component.showNotifications = true;

    (fixture.nativeElement as HTMLElement).click();
    expect(component.showNotifications).toBe(true);

    outside.click();
    expect(component.showNotifications).toBe(false);
    expect(markAllRead).toHaveBeenCalled();
    outside.remove();
  });
});
