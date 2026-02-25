import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService } from './notification.service';

type PushSubscriptionRequest = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
};

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly baseUrl = '/api/notifications/push';
  permission: NotificationPermission = Notification.permission;
  private hasSubscription = false;
  private localFallbackEnabled = false;

  constructor(
    private swPush: SwPush,
    private http: HttpClient,
    private router: Router,
    private notifications: NotificationService
  ) {
    this.swPush.messages.subscribe((payload) => this.handleMessage(payload));
    this.swPush.notificationClicks.subscribe((event) => this.handleClick(event));
    this.swPush.subscription.subscribe((sub) => {
      this.hasSubscription = !!sub;
    });
  }

  isSupported(): boolean {
    return this.swPush.isEnabled;
  }

  isEnabled(): boolean {
    return this.swPush.isEnabled && this.permission === 'granted' && this.hasSubscription;
  }

  isLocalFallbackEnabled(): boolean {
    return this.localFallbackEnabled;
  }

  enableLocalFallback(): void {
    this.localFallbackEnabled = true;
  }

  disableLocalFallback(): void {
    this.localFallbackEnabled = false;
  }

  playInAppSound(): void {
    this.playNotificationSound();
  }

  async enable(): Promise<void> {
    if (!this.swPush.isEnabled) {
      throw new Error('PUSH_UNSUPPORTED');
    }

    this.disableLocalFallback();

    const registration = await navigator.serviceWorker?.ready;
    if (!registration) {
      throw new Error('SW_NOT_READY');
    }

    if (Notification.permission !== 'granted') {
      const permission = await this.requestPermissionWithTimeout(6000);
      this.permission = permission;
      if (permission !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }
    }

    const publicKey = await firstValueFrom(
      this.http.get(`${this.baseUrl}/public-key`, { responseType: 'text' })
    );
    const normalizedPublicKey = publicKey?.trim();
    if (!normalizedPublicKey || normalizedPublicKey.length < 10) {
      throw new Error('VAPID_PUBLIC_KEY manquante');
    }

    // no-op

    const applicationServerKey = this.urlBase64ToUint8Array(normalizedPublicKey);
    const permissionState = await this.getPermissionStateWithTimeout(registration, applicationServerKey, 2000);
    if (permissionState === 'denied') {
      throw new Error('PERMISSION_DENIED');
    }
    const existingSubscription = await this.getSubscriptionWithTimeout(registration, 2000);
    let subscription: PushSubscription | null = null;

    if (existingSubscription) {
      await this.deleteBackendSubscription(existingSubscription.endpoint);
      await existingSubscription.unsubscribe();
      this.hasSubscription = false;
    } else {
      // no-op
    }

    if (!subscription) {
      try {
        subscription = await Promise.race([
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }),
          new Promise<PushSubscription>((_, reject) =>
            setTimeout(() => reject(new Error('SUBSCRIBE_TIMEOUT')), 8000)
          ),
        ]);
      } catch (error) {
        if (error instanceof Error && error.message === 'SUBSCRIBE_TIMEOUT') {
          const fallbackSubscription = await this.getSubscriptionWithTimeout(registration, 3000);
          if (fallbackSubscription) {
            subscription = fallbackSubscription;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    if (!subscription) {
      throw new Error('SUBSCRIBE_FAILED');
    }

    // no-op
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/subscribe`, this.mapSubscription(subscription))
      );
    } catch (error) {
      throw error;
    }
    this.permission = Notification.permission;
    this.hasSubscription = true;
  }

  async disable(): Promise<void> {
    if (!this.swPush.isEnabled) {
      throw new Error('PUSH_UNSUPPORTED');
    }

    this.disableLocalFallback();

    const subscription = await firstValueFrom(this.swPush.subscription);
    if (!subscription) return;

    await firstValueFrom(
      this.http.request('delete', `${this.baseUrl}/subscribe`, {
        body: { endpoint: subscription.endpoint },
      })
    );

    await subscription.unsubscribe();
    this.permission = Notification.permission;
    this.hasSubscription = false;
  }

  async showLocalNotification(title: string, body: string, url?: string, priority: number = 2): Promise<boolean> {
    if (priority >= 2) {
      this.playNotificationSound();
    }
    this.notifications.add({
      id: crypto.randomUUID(),
      title,
      body,
      createdAt: new Date(),
      read: false,
      priority,
      link: url,
    });

    return true;
  }

  async sendTest(title: string, body: string, url?: string, priority: number = 2): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/test`, {
        title,
        body,
        url,
        priority,
      })
    );
  }

  private mapSubscription(subscription: PushSubscription): PushSubscriptionRequest {
    const json = subscription.toJSON();
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: json?.keys?.['p256dh'] ?? '',
        auth: json?.keys?.['auth'] ?? '',
      },
      userAgent: navigator.userAgent,
    };
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  private async getSubscriptionWithTimeout(
    registration: ServiceWorkerRegistration,
    timeoutMs: number
  ): Promise<PushSubscription | null> {
    return Promise.race([
      registration.pushManager.getSubscription(),
      new Promise<PushSubscription | null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      ),
    ]);
  }

  private async requestPermissionWithTimeout(timeoutMs: number): Promise<NotificationPermission> {
    return Promise.race([
      Notification.requestPermission(),
      new Promise<NotificationPermission>((_, reject) =>
        setTimeout(() => reject(new Error('PERMISSION_TIMEOUT')), timeoutMs)
      ),
    ]);
  }

  private async getPermissionStateWithTimeout(
    registration: ServiceWorkerRegistration,
    applicationServerKey: Uint8Array,
    timeoutMs: number
  ): Promise<PermissionState | 'unknown'> {
    if (!registration.pushManager.permissionState) {
      return 'unknown';
    }

    return Promise.race([
      registration.pushManager.permissionState({
        userVisibleOnly: true,
        applicationServerKey,
      }),
      new Promise<PermissionState | 'unknown'>((resolve) =>
        setTimeout(() => resolve('unknown'), timeoutMs)
      ),
    ]);
  }

  private async deleteBackendSubscription(endpoint: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.request('delete', `${this.baseUrl}/subscribe`, {
          body: { endpoint },
        })
      );
    } catch (error) {
      // ignore backend cleanup failures
    }
  }

  private handleMessage(payload: any): void {
    if (document.visibilityState === 'visible') {
      return;
    }
    const dataPayload = payload?.data ?? payload;
    const notification = payload?.notification ?? payload;
    const title = dataPayload?.title ?? notification?.title ?? 'Notification';
    const body = dataPayload?.body ?? notification?.body ?? '';
    const rawPriority =
      dataPayload?.priority ??
      notification?.data?.priority ??
      notification?.priority ??
      payload?.data?.priority ??
      2;
    const priority = Number.isFinite(Number(rawPriority)) ? Number(rawPriority) : 2;
    const link =
      dataPayload?.url ??
      notification?.data?.url ??
      payload?.data?.url ??
      undefined;

    if (priority >= 2) {
      this.playNotificationSound();
    }
    this.notifications.add({
      id: crypto.randomUUID(),
      title,
      body,
      createdAt: new Date(),
      read: false,
      priority,
      link,
    });
  }

  private playNotificationSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      const carrier = audioContext.createOscillator();
      const modulator = audioContext.createOscillator();
      const modGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      const gainNode = audioContext.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(880, now + 0.18);

      modulator.type = 'triangle';
      modulator.frequency.setValueAtTime(36, now);
      modGain.gain.setValueAtTime(90, now);
      modGain.gain.exponentialRampToValueAtTime(20, now + 0.18);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(820, now + 0.22);

      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      carrier.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      modulator.start();
      carrier.start();
      modulator.stop(now + 0.3);
      carrier.stop(now + 0.3);
    } catch {
      // ignore audio errors
    }
  }

  private handleClick(event: any): void {
    const url = event?.notification?.data?.url;
    if (url) {
      this.router.navigateByUrl(url);
    }
  }
}
