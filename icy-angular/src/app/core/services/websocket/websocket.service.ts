import { Injectable, NgZone } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client;
  private shouldReconnectAfterPageShow = false;
  private readonly shipUpdatesSubjects = new Map<string, Subject<string>>();
  private fleetUpdatesSubject = new Subject<any>();
  private eventSubject = new Subject<string>();
  private goalSubject = new Subject<string>();
  private miningSheetsSubject = new Subject<string>();
  private notificationSubject = new Subject<any>();
  private readonly shipSubscriptions = new Map<string, StompSubscription>();
  private readonly shipListenerCounts = new Map<string, number>();
  private fleetSubscription: StompSubscription | null = null;
  private fleetListenerCount = 0;
  private eventSubscription: StompSubscription | null = null;
  private eventListenerCount = 0;
  private goalsSubscription: StompSubscription | null = null;
  private goalsListenerCount = 0;
  private miningSheetsSubscription: StompSubscription | null = null;
  private miningSheetsListenerCount = 0;
  private notificationsSubscription: StompSubscription | null = null;
  private userNotificationsSubscription: StompSubscription | null = null;
  private notificationsListenerCount = 0;
  private notificationsUserId: string | null = null;
  private subscribedNotificationsUserId: string | null = null;

  constructor(
    private readonly ngZone: NgZone,
    private readonly authService: AuthService
  ) {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg: string) => console.log(`[STOMP] ${msg}`),
    });
    this.stompClient.beforeConnect = () => {
      this.stompClient.connectHeaders = {
        Authorization: `Bearer ${this.authService.getToken()}`,
      };
    };

    this.stompClient.onConnect = () => {
      console.log('✅ WebSocket connecté');
      // STOMP subscriptions belong to a connection. Handles from a previous
      // connection must never prevent their recreation after reconnect.
      this.clearSubscriptionHandles();
      this.syncSubscriptions();
    };

    this.stompClient.onWebSocketClose = () => this.clearSubscriptionHandles();

    this.stompClient.onStompError = frame => {
      console.error('❌ STOMP error:', frame.headers['message'], frame.body);
    };

    this.registerPageLifecycleHooks();
  }

  private registerPageLifecycleHooks(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('pagehide', () => {
      this.shouldReconnectAfterPageShow = this.stompClient.active || this.stompClient.connected;
      this.disconnect();
    });

    window.addEventListener('pageshow', () => {
      if (this.shouldReconnectAfterPageShow && !this.stompClient.active) {
        this.stompClient.activate();
      }
      this.shouldReconnectAfterPageShow = false;
    });
  }

  private ensureConnected(): void {
    if (!this.stompClient.active) {
      this.stompClient.activate();
    }

    if (this.stompClient.connected) {
      this.syncSubscriptions();
    }
  }

  connectShipUpdate(userId: string): void {
    this.shipListenerCounts.set(userId, (this.shipListenerCounts.get(userId) ?? 0) + 1);
    this.ensureConnected();
  }

  disconnectShipUpdate(userId: string): void {
    const listenerCount = Math.max(0, (this.shipListenerCounts.get(userId) ?? 0) - 1);
    if (listenerCount > 0) {
      this.shipListenerCounts.set(userId, listenerCount);
      return;
    }
    this.shipListenerCounts.delete(userId);
    this.unsubscribe(this.shipSubscriptions, userId);
    this.shipUpdatesSubjects.delete(userId);
  }

  connectFleetUpdate(): void {
    this.fleetListenerCount += 1;
    this.ensureConnected();
  }

  connectEvent(): void {
    this.eventListenerCount += 1;
    this.ensureConnected();
  }

  connectNotifications(userId?: string): void {
    this.notificationsListenerCount += 1;
    this.notificationsUserId = userId ?? null;
    this.ensureConnected();
  }

  disconnectNotifications(): void {
    this.notificationsListenerCount = Math.max(0, this.notificationsListenerCount - 1);
    if (this.notificationsListenerCount > 0) {
      return;
    }
    this.notificationsUserId = null;
    this.notificationsSubscription?.unsubscribe();
    this.notificationsSubscription = null;
    this.userNotificationsSubscription?.unsubscribe();
    this.userNotificationsSubscription = null;
    this.subscribedNotificationsUserId = null;
  }

  connectGoalUpdates(): void {
    this.goalsListenerCount += 1;
    this.ensureConnected();
  }

  connectMiningSheets(): void {
    this.miningSheetsListenerCount += 1;
    this.ensureConnected();
  }

  disconnectFleetUpdate(): void {
    this.fleetListenerCount = Math.max(0, this.fleetListenerCount - 1);
    if (this.fleetListenerCount === 0) {
      this.fleetSubscription?.unsubscribe();
      this.fleetSubscription = null;
    }
  }

  disconnectEvent(): void {
    this.eventListenerCount = Math.max(0, this.eventListenerCount - 1);
    if (this.eventListenerCount === 0) {
      this.eventSubscription?.unsubscribe();
      this.eventSubscription = null;
    }
  }

  disconnectGoalUpdates(): void {
    this.goalsListenerCount = Math.max(0, this.goalsListenerCount - 1);
    if (this.goalsListenerCount === 0 && this.goalsSubscription) {
      this.goalsSubscription.unsubscribe();
      this.goalsSubscription = null;
    }
  }

  disconnectMiningSheets(): void {
    this.miningSheetsListenerCount = Math.max(0, this.miningSheetsListenerCount - 1);
    if (this.miningSheetsListenerCount === 0 && this.miningSheetsSubscription) {
      this.miningSheetsSubscription.unsubscribe();
      this.miningSheetsSubscription = null;
    }
  }

  disconnect(): void {
    if (this.stompClient && this.stompClient.active) {
      this.stompClient.deactivate();
      console.log('🔌 WebSocket déconnecté');
    }
  }

  private syncSubscriptions(): void {
    if (!this.stompClient.connected) {
      return;
    }

    for (const [userId, listenerCount] of this.shipListenerCounts) {
      if (listenerCount > 0 && !this.shipSubscriptions.has(userId)) {
        this.subscribeToShipUpdates(userId);
      }
    }
    if (this.fleetListenerCount > 0 && !this.fleetSubscription) this.subscribeToFleetUpdate();
    if (this.eventListenerCount > 0 && !this.eventSubscription) this.subscribeToEvent();
    if (this.goalsListenerCount > 0 && !this.goalsSubscription) this.subscribeToGoals();
    if (this.miningSheetsListenerCount > 0 && !this.miningSheetsSubscription) this.subscribeToMiningSheets();
    if (this.notificationsListenerCount > 0) this.subscribeToNotifications(this.notificationsUserId ?? undefined);
  }

  private clearSubscriptionHandles(): void {
    this.shipSubscriptions.clear();
    this.fleetSubscription = null;
    this.eventSubscription = null;
    this.goalsSubscription = null;
    this.miningSheetsSubscription = null;
    this.notificationsSubscription = null;
    this.userNotificationsSubscription = null;
    this.subscribedNotificationsUserId = null;
  }

  private unsubscribe(subscriptions: Map<string, StompSubscription>, key: string): void {
    subscriptions.get(key)?.unsubscribe();
    subscriptions.delete(key);
  }

  private subscribeToShipUpdates(userId: string): void {
    const subscription = this.stompClient.subscribe(`/topic/user/${userId}/ships`, (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour SHIPS:', Array(message.body).length);
      this.ngZone.run(() => this.getShipUpdatesSubject(userId).next(message.body));
    });
    this.shipSubscriptions.set(userId, subscription);
  }

  private subscribeToFleetUpdate(): void {
    this.fleetSubscription = this.stompClient.subscribe('/topic/fleet/update', (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour FLEET:', Array(message.body).length);
      this.ngZone.run(() => this.fleetUpdatesSubject.next(message.body));
    });
  }

  private subscribeToEvent(): void {
    this.eventSubscription = this.stompClient.subscribe('/topic/events', (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour EVENT:', Array(message.body).length);
      this.ngZone.run(() => this.eventSubject.next(message.body));
    });
  }

  private subscribeToGoals(): void {
    if (this.goalsSubscription) {
      return;
    }

    this.goalsSubscription = this.stompClient.subscribe('/topic/goals', (message: IMessage) => {
      this.ngZone.run(() => this.goalSubject.next(message.body));
    });
  }

  private subscribeToMiningSheets(): void {
    if (this.miningSheetsSubscription) {
      return;
    }

    this.miningSheetsSubscription = this.stompClient.subscribe('/topic/mining-sheets', (message: IMessage) => {
      this.ngZone.run(() => this.miningSheetsSubject.next(message.body));
    });
  }

  private subscribeToNotifications(userId?: string): void {
    if (!this.notificationsSubscription) {
      this.notificationsSubscription = this.stompClient.subscribe('/topic/notifications', (message: IMessage) => {
        this.ngZone.run(() => this.notificationSubject.next(message.body));
      });
    }

    if (userId && userId !== this.subscribedNotificationsUserId) {
      this.userNotificationsSubscription?.unsubscribe();
      this.userNotificationsSubscription = this.stompClient.subscribe(
        `/topic/user/${userId}/notifications`,
        (message: IMessage) => {
          this.ngZone.run(() => this.notificationSubject.next(message.body));
        }
      );
      this.subscribedNotificationsUserId = userId;
    }
  }

  private getShipUpdatesSubject(userId: string): Subject<string> {
    let subject = this.shipUpdatesSubjects.get(userId);
    if (!subject) {
      subject = new Subject<string>();
      this.shipUpdatesSubjects.set(userId, subject);
    }
    return subject;
  }

  getShipUpdates(userId: string): Observable<string> {
    return this.getShipUpdatesSubject(userId).asObservable();
  }

  getFleetUpdate(): Observable<any> {
    return this.fleetUpdatesSubject.asObservable();
  }

  getEvent(): Observable<string> {
    return this.eventSubject.asObservable();
  }

  getNotifications(): Observable<any> {
    return this.notificationSubject.asObservable();
  }

  getGoalUpdates(): Observable<string> {
    return this.goalSubject.asObservable();
  }

  getMiningSheetUpdates(): Observable<string> {
    return this.miningSheetsSubject.asObservable();
  }

  listenForUserShips(userId: string): Observable<string> {
    return this.getShipUpdates(userId);
  }

  listenForFleetUpdate(): Observable<any> {
    return this.getFleetUpdate();
  }

  listenForEvent(): Observable<string> {
    return this.getEvent();
  }

  listenForNotifications(): Observable<any> {
    return this.getNotifications();
  }

  listenForGoalUpdates(): Observable<string> {
    return this.getGoalUpdates();
  }

  listenForMiningSheets(): Observable<string> {
    return this.getMiningSheetUpdates();
  }
}
