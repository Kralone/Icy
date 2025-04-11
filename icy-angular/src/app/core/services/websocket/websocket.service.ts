import { Injectable } from '@angular/core';
import {Client, Message, over, Subscription} from 'stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client | null = null;
  private shipUpdatesSubject = new Subject<string>(); // Observable pour les mises à jour des vaisseaux
  private fleetUpdatesSubject = new Subject<any>();
  private eventSubject = new Subject<string>();
  private fleetSub?: Subscription;
  private eventSub?: Subscription;

  constructor() {}

  connectShipUpdate(userId: string): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = over(socket);

    this.stompClient.connect({}, () => {
      console.log('✅ Ship WebSocket connecté');
      this.subscribeToShipUpdates(userId);
    }, (error: unknown) => { // 🔹 Ajout du type `unknown` pour éviter l'erreur TS7006
      console.error('❌ WebSocket erreur', error);
    });
  }

  connectFleetUpdate(): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = over(socket);

    this.stompClient.connect({}, () => {
      console.log('✅ Fleet WebSocket connecté');
      this.subscribeToFleetUpdate();
    }, error => {
      console.error('❌ WebSocket erreur', error);
    })
  }

  connectEvent(): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = over(socket);

    this.stompClient.connect({}, () => {
      console.log('✅ Event WebSocket connecté');
      this.subscribeToEvent();
    }, error => {
      console.error('❌ WebSocket erreur', error);
    })
  }

  disconnectFleetUpdate(): void {
    if (this.fleetSub) {
      this.fleetSub.unsubscribe();
    }
  }

  disconnectEvent(): void {
    if (this.eventSub) {
      this.eventSub.unsubscribe();
    }
  }

  private subscribeToShipUpdates(userId: string): void {
    if (this.stompClient) {
      this.fleetSub = this.stompClient.subscribe(`/topic/user/${userId}/ships`, (message: Message) => {
        console.debug('📡 Nouvelle mise à jour:', Array(message.body).length);
        this.shipUpdatesSubject.next(message.body);
      });
    }
  }

  private subscribeToFleetUpdate(): void {
    if(this.stompClient) {
      this.stompClient.subscribe('/topic/fleet/update', (message: Message) => {
        console.debug('📡 Nouvelle mise à jour:', Array(message.body).length);
        this.fleetUpdatesSubject.next(message.body);
      })
    }
  }

  private subscribeToEvent(): void {
    if (this.stompClient) {
      this.eventSub = this.stompClient.subscribe('/topic/events', (message) => {
        console.debug('📡 Nouvelle mise à jour:', Array(message.body).length);
        this.eventSubject.next(message.body);
      });

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

  disconnect(): void {
    if (this.stompClient !== null) {
      this.stompClient.disconnect(() => {
        console.log('🔌 WebSocket déconnecté');
      });
    }
  }

  listenForUserShips(userId: number): Observable<string> {
    return this.getShipUpdates();
  }

  listenForFleetUpdate() {
    return this.getFleetUpdate();
  }

  listenForEvent() {
    return this.getEvent();
  }
}
