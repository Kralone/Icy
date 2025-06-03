import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client;
  private shipUpdatesSubject = new Subject<string>();
  private fleetUpdatesSubject = new Subject<any>();
  private eventSubject = new Subject<string>();

  constructor() {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg: string) => console.log(`[STOMP] ${msg}`),
    });

    this.stompClient.onStompError = frame => {
      console.error('❌ STOMP error:', frame.headers['message'], frame.body);
    };
  }

  private ensureConnected(callback: () => void): void {
    if (!this.stompClient.active) {
      this.stompClient.onConnect = () => {
        console.log('✅ WebSocket connecté');
        callback();
      };
      this.stompClient.activate();
    } else {
      callback();
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

  disconnectFleetUpdate(): void {
    this.stompClient.unsubscribe('/topic/fleet/update');
  }

  disconnectEvent(): void {
    this.stompClient.unsubscribe('/topic/events');
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

  getShipUpdates(): Observable<string> {
    return this.shipUpdatesSubject.asObservable();
  }

  getFleetUpdate(): Observable<any> {
    return this.fleetUpdatesSubject.asObservable();
  }

  getEvent(): Observable<string> {
    return this.eventSubject.asObservable();
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
}
