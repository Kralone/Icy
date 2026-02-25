import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client;
  private shouldReconnectAfterPageShow = false;
  private pendingConnectCallbacks: Array<() => void> = [];
  private shipUpdatesSubject = new Subject<string>();
  private fleetUpdatesSubject = new Subject<any>();
  private eventSubject = new Subject<string>();
  private goalSubject = new Subject<string>();
  private notificationSubject = new Subject<any>();
  private goalsSubscription: StompSubscription | null = null;
  private goalsListenerCount = 0;
  private notificationsSubscription: StompSubscription | null = null;
  private userNotificationsSubscription: StompSubscription | null = null;
  private lastNotificationsUserId: string | null = null;

  constructor() {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg: string) => console.log(`[STOMP] ${msg}`),
    });

    this.stompClient.onConnect = () => {
      console.log('✅ WebSocket connecté');
      const callbacks = [...this.pendingConnectCallbacks];
      this.pendingConnectCallbacks = [];
      callbacks.forEach(callback => callback());
    };

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

  private ensureConnected(callback: () => void): void {
    if (this.stompClient.connected) {
      callback();
      return;
    }

    this.pendingConnectCallbacks.push(callback);

    if (!this.stompClient.active) {
      this.stompClient.activate();
    }
  }

  connectShipUpdate(userId: string): void {
    this.ensureConnected(() => this.subscribeToShipUpdates(userId));
  }

  connectFleetUpdate(): void {
    this.ensureConnected(() => this.subscribeToFleetUpdate());
  }

  connectEvent(): void {
    this.ensureConnected(() => this.subscribeToEvent());
  }

  connectNotifications(userId?: string): void {
    this.ensureConnected(() => this.subscribeToNotifications(userId));
  }

  connectGoalUpdates(): void {
    this.goalsListenerCount += 1;
    this.ensureConnected(() => this.subscribeToGoals());
  }

  disconnectFleetUpdate(): void {
    this.stompClient.unsubscribe('/topic/fleet/update');
  }

  disconnectEvent(): void {
    this.stompClient.unsubscribe('/topic/events');
  }

  disconnectGoalUpdates(): void {
    this.goalsListenerCount = Math.max(0, this.goalsListenerCount - 1);
    if (this.goalsListenerCount === 0 && this.goalsSubscription) {
      this.goalsSubscription.unsubscribe();
      this.goalsSubscription = null;
    }
  }

  disconnect(): void {
    if (this.stompClient && this.stompClient.active) {
      this.stompClient.deactivate();
      console.log('🔌 WebSocket déconnecté');
    }
  }

  private subscribeToShipUpdates(userId: string): void {
    this.stompClient.subscribe(`/topic/user/${userId}/ships`, (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour SHIPS:', Array(message.body).length);
      this.shipUpdatesSubject.next(message.body);
    });
  }

  private subscribeToFleetUpdate(): void {
    this.stompClient.subscribe('/topic/fleet/update', (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour FLEET:', Array(message.body).length);
      this.fleetUpdatesSubject.next(message.body);
    });
  }

  private subscribeToEvent(): void {
    this.stompClient.subscribe('/topic/events', (message: IMessage) => {
      console.debug('📡 Nouvelle mise à jour EVENT:', Array(message.body).length);
      this.eventSubject.next(message.body);
    });
  }

  private subscribeToGoals(): void {
    if (this.goalsSubscription) {
      return;
    }

    this.goalsSubscription = this.stompClient.subscribe('/topic/goals', (message: IMessage) => {
      this.goalSubject.next(message.body);
    });
  }

  private subscribeToNotifications(userId?: string): void {
    if (!this.notificationsSubscription) {
      this.notificationsSubscription = this.stompClient.subscribe('/topic/notifications', (message: IMessage) => {
        this.notificationSubject.next(message.body);
      });
    }

    if (userId && userId !== this.lastNotificationsUserId) {
      if (this.userNotificationsSubscription) {
        this.userNotificationsSubscription.unsubscribe();
        this.userNotificationsSubscription = null;
      }
      this.userNotificationsSubscription = this.stompClient.subscribe(
        `/topic/user/${userId}/notifications`,
        (message: IMessage) => {
          this.notificationSubject.next(message.body);
        }
      );
      this.lastNotificationsUserId = userId;
    }
  }

  getShipUpdates(): Observable<string> {
    return this.shipUpdatesSubject.asObservable();
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

  listenForUserShips(userId: number): Observable<string> {
    return this.getShipUpdates();
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
}
