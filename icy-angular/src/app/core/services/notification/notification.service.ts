import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly storageKey = 'iceforge.notifications';
  private readonly storage: Storage | null = this.resolveStorage();
  private readonly notificationsSubject = new BehaviorSubject<NotificationItem[]>(this.loadStored());
  readonly notifications$ = this.notificationsSubject.asObservable();
  private readonly maxAgeMs = 30 * 24 * 60 * 60 * 1000;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey) {
        this.notificationsSubject.next(this.pruneOld(this.loadStored()));
      }
    });
  }

  add(notification: NotificationItem): void {
    const current = this.pruneOld(this.notificationsSubject.value);
    this.publish([notification, ...current]);
  }

  markAllRead(): void {
    const updated = this.pruneOld(this.notificationsSubject.value).map((item) => ({
      ...item,
      read: true
    }));
    this.publish(updated);
  }

  markRead(id: string): void {
    const updated = this.pruneOld(this.notificationsSubject.value).map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    this.publish(updated);
  }

  remove(id: string): void {
    const updated = this.pruneOld(this.notificationsSubject.value).filter((item) => item.id !== id);
    this.publish(updated);
  }

  refreshFromStorage(): void {
    this.publish(this.loadStored());
  }

  private pruneOld(items: NotificationItem[]): NotificationItem[] {
    const now = Date.now();
    return items.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      if (Number.isNaN(created)) {
        return true;
      }
      return now - created <= this.maxAgeMs;
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private publish(items: NotificationItem[]): void {
    const pruned = this.pruneOld(items);
    this.notificationsSubject.next(pruned);
    this.saveStored(pruned);
  }

  private loadStored(): NotificationItem[] {
    try {
      if (!this.storage) return [];
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<NotificationItem & { createdAt: string }>;
      const hydrated = parsed.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));
      return this.pruneOld(hydrated);
    } catch {
      return [];
    }
  }

  private saveStored(items: NotificationItem[]): void {
    try {
      if (!this.storage) return;
      const payload = items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }));
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  private resolveStorage(): Storage | null {
    try {
      const testKey = '__iceforge_notify_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch {
      try {
        const testKey = '__iceforge_notify_test__';
        sessionStorage.setItem(testKey, '1');
        sessionStorage.removeItem(testKey);
        return sessionStorage;
      } catch {
        return null;
      }
    }
  }
}
