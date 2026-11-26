import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { PushNotificationService } from './push-notification.service';
import { NotificationService } from './notification.service';

describe('PushNotificationService sans API Notification (Safari iOS)', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
    delete (globalThis as any).Notification;

    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: { isEnabled: true, messages: EMPTY, notificationClicks: EMPTY, subscription: of(null) } },
        { provide: HttpClient, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: NotificationService, useValue: { add: () => undefined } },
      ],
    });
  });

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'Notification', original);
  });

  it('se crée sans lever d’erreur et se déclare non pris en charge', async () => {
    const service = TestBed.inject(PushNotificationService);

    expect(service.permission).toBe('default');
    expect(service.isSupported()).toBe(false);
    expect(service.isEnabled()).toBe(false);
    await expect(service.enable()).rejects.toThrow('PUSH_UNSUPPORTED');
  });
});
