import { Injectable } from '@angular/core';
import { WebSocketService } from '../websocket/websocket.service';
import { Observable } from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {Ship} from '../../../model/ship.model';
import {ShipListDTO} from '../../../model/ShipListDTO.model';

@Injectable({
  providedIn: 'root'
})
export class ShipService {
  constructor(private wsService: WebSocketService, private http: HttpClient) {}

  /**
   * Écoute les mises à jour WebSocket pour les vaisseaux d'un utilisateur.
   * @param userId L'ID de l'utilisateur
   * @returns Observable<any> (correction du typage)
   */
  listenForUserShips(userId: string): Observable<any> {
    return this.wsService.listenForUserShips(Number(userId));
  }

  getAllBrandsWithImages(): Observable<{ data: { name: string, imageUrl: string }[] }> {
    return this.http.get<{ data: { name: string, imageUrl: string }[] }>('/api/ships/brands/images');
  }

  getShipsByBrand(brand: string): Observable<{ data: Ship[] }> {
    return this.http.get<{ data: Ship[] }>(`/api/ships/shipsByBrand?brand=${brand}`);
  }

  addShipToUser(payload: { shipId: number, inGamePurchase: boolean, loaner: boolean }): Observable<any> {
    return this.http.post('/api/user-ships', payload);
  }

  deleteShip(shipId: number) {
    console.log('shipId', shipId);
    const params = { shipId };
    return this.http.delete('api/user-ships', { params });
  }

  getFleetSummary(): Observable<any> {
    return this.wsService.listenForFleetUpdate();
  }



}
