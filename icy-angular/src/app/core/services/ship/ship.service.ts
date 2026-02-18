import { Injectable } from '@angular/core';
import { WebSocketService } from '../websocket/websocket.service';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {Ship, ShipCreateDTO} from '../../../model/ship.model';
import { ShipListDTO } from '../../../model/ShipListDTO.model';

export interface Brand {
  name: string;
  imageUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShipService {
  constructor(private wsService: WebSocketService, private http: HttpClient) {}

  // ======================================================
  // 🌐 PARTIE UTILISATEUR / WEBSOCKET
  // ======================================================

  /**
   * Écoute les mises à jour WebSocket pour les vaisseaux d'un utilisateur.
   */
  listenForUserShips(userId: string): Observable<any> {
    return this.wsService.listenForUserShips(Number(userId));
  }

  /**
   * Récupère toutes les marques avec leurs images.
   */
  getAllBrandsWithImages(): Observable<{ data: { name: string; imageUrl: string }[] }> {
    return this.http.get<{ data: { name: string; imageUrl: string }[] }>('/api/ships/brands/images');
  }

  /**
   * Récupère tous les vaisseaux d'une marque donnée.
   */
  getShipsByBrand(brand: string): Observable<{ data: Ship[] }> {
    return this.http.get<{ data: Ship[] }>(`/api/ships/shipsByBrand?brand=${brand}`);
  }

  /**
   * Récupère tous les vaisseaux d'un utilisateur via son discordId.
   */
  getUserShipsByDiscordId(discordId: string): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>('/api/user-ships/bot', { params: { discordId } });
  }

  /**
   * Ajoute un vaisseau à la flotte d'un utilisateur.
   */
  addShipToUser(payload: { shipId: number; inGamePurchase: boolean; rewardInGame: boolean; loaner: boolean }): Observable<any> {
    return this.http.post('/api/user-ships', payload);
  }

  /**
   * Supprime un vaisseau de la flotte d'un utilisateur.
   */
  deleteShip(shipId: number): Observable<any> {
    console.log('shipId', shipId);
    const params = { shipId };
    return this.http.delete('api/user-ships', { params });
  }

  /**
   * Écoute les mises à jour globales de la flotte (résumé).
   */
  getFleetSummary(): Observable<any> {
    return this.wsService.listenForFleetUpdate();
  }

  // ======================================================
  // ⚙️ PARTIE ADMIN / CRUD SHIPS
  // ======================================================

  /**
   * Récupère tous les vaisseaux existants.
   */
  getAllShips(): Observable<{ message: string; data: Ship[] }> {
    return this.http.get<{ message: string; data: Ship[] }>('/api/ships');
  }

  /**
   * Crée un nouveau vaisseau.
   */
  createShip(ship: ShipCreateDTO): Observable<any> {
    return this.http.post('/api/ships/create', ship);
  }

  /**
   * Met à jour un vaisseau existant.
   */
  updateShip(id: string, ship: ShipCreateDTO): Observable<any> {
    return this.http.put(`/api/ships/update?id=${id}`, ship);
  }

  /**
   * Supprime un vaisseau (admin).
   */
  deleteShipAdmin(id: string): Observable<any> {
    return this.http.delete(`/api/ships?id=${id}`);
  }

  // ======================================================
  // 🏷 PARTIE ADMIN / CRUD BRANDS
  // ======================================================

  /**
   * Récupère toutes les marques existantes.
   */
  getAllBrands(): Observable<{ message: string; data: Brand[] }> {
    return this.http.get<{ message: string; data: Brand[] }>('/api/ships/brands');
  }

  /**
   * Crée une nouvelle marque.
   */
  createBrand(brand: Brand): Observable<any> {
    return this.http.post('/api/ships/brands/create', brand);
  }

  /**
   * Met à jour une marque existante.
   */
  updateBrand(name: string, brand: Brand): Observable<any> {
    return this.http.put(`/api/ships/brands/update?name=${encodeURIComponent(name)}`, brand);
  }

  /**
   * Supprime une marque.
   */
  deleteBrand(name: string): Observable<any> {
    return this.http.delete(`/api/ships/brands/delete?name=${encodeURIComponent(name)}`);
  }

}
