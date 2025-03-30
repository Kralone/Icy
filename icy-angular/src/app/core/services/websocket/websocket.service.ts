import { Injectable } from '@angular/core';
import { Client, Message, over } from 'stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private stompClient: Client | null = null;
  private shipUpdatesSubject = new Subject<string>(); // Observable pour les mises à jour des vaisseaux
  private fleetUpdatesSubject = new Subject<any>();

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

  private subscribeToShipUpdates(userId: string): void {
    if (this.stompClient) {
      this.stompClient.subscribe(`/topic/user/${userId}/ships`, (message: Message) => {
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

  getShipUpdates(): Observable<string> {
    return this.shipUpdatesSubject.asObservable();
  }

  getFleetUpdate(): Observable<any> {
    return this.fleetUpdatesSubject.asObservable();
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
}
