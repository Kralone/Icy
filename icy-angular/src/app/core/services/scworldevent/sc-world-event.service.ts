import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ScWorldEventType {
  name: string;
  textColor?: string | null;
  imageUrl?: string | null;
  scoreSchema?: string | null;
  createdAt?: string | null;
}

export interface ScWorldEvent {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;     // ISO
  endAt?: string | null;
  typeName: string;
  typeTextColor?: string | null;
  typeImageUrl?: string | null;
  bannerImageUrl?: string | null;
  gallery?: string | null;        // JSON string
  scoreSchema?: string | null;    // snapshot JSON string
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class ScWorldEventService {
  private readonly eventsUrl = '/api/sc-world-events';
  private readonly typesUrl = '/api/sc-world-event-types';

  constructor(private http: HttpClient) {}

  // =========================================================
  // TYPES
  // =========================================================
  getTypes(): Observable<ScWorldEventType[]> {
    return this.http.get<ScWorldEventType[]>(this.typesUrl);
  }

  createType(payload: { name: string; textColor?: string; imageUrl?: string; scoreSchema?: string }): Observable<ScWorldEventType> {
    return this.http.post<ScWorldEventType>(this.typesUrl, payload);
  }

  updateType(name: string, payload: { textColor?: string; imageUrl?: string; scoreSchema?: string }): Observable<ScWorldEventType> {
    return this.http.put<ScWorldEventType>(`${this.typesUrl}/${encodeURIComponent(name)}`, payload);
  }

  deleteType(name: string): Observable<void> {
    return this.http.delete<void>(`${this.typesUrl}/${encodeURIComponent(name)}`);
  }

  // =========================================================
  // EVENTS
  // =========================================================

  /**
   * Pour l'ADMIN : Récupère TOUS les événements (Passés, Présents, Futurs).
   * Triés par date DESC par défaut côté back.
   */
  getAll(page = 0, size = 30): Observable<Page<ScWorldEvent>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    return this.http.get<Page<ScWorldEvent>>(this.eventsUrl, { params });
  }

  /**
   * ✅ NOUVEAU - Pour le JOUEUR :
   * Récupère uniquement les événements "Jouables" (En cours ou Futurs).
   * Exclut ceux qui sont terminés (clôturés).
   */
  getPlayable(page = 0, size = 30): Observable<Page<ScWorldEvent>> {
    const params = new HttpParams()
      .set('page', page)
      .set('size', size);

    // Suppose que tu as créé l'endpoint /playable côté Spring Boot comme discuté
    return this.http.get<Page<ScWorldEvent>>(`${this.eventsUrl}/playable`, { params });
  }

  getHistory(page = 0, size = 30): Observable<Page<ScWorldEvent>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ScWorldEvent>>(`${this.eventsUrl}/history`, { params });
  }

  /**
   * Utile si tu veux vérifier s'il y a un "Main Event" spécifique en cours
   */
  getCurrent(): Observable<ScWorldEvent | null> {
    return this.http.get<ScWorldEvent>(`${this.eventsUrl}/current`);
  }

  getOne(id: string): Observable<ScWorldEvent> {
    return this.http.get<ScWorldEvent>(`${this.eventsUrl}/${id}`);
  }

  // =========================================================
  // EVENTS - CRUD
  // =========================================================

  createEvent(payload: {
    title: string;
    description?: string;
    startAt: string;
    endAt?: string | null;
    typeName: string;
    bannerImageUrl?: string;
    gallery?: string;
  }): Observable<ScWorldEvent> {
    return this.http.post<ScWorldEvent>(this.eventsUrl, payload);
  }

  updateEvent(id: string, payload: Partial<{
    title: string;
    description: string;
    startAt: string;
    endAt: string | null;
    typeName: string;
    bannerImageUrl: string;
    gallery: string;
  }>): Observable<ScWorldEvent> {
    return this.http.put<ScWorldEvent>(`${this.eventsUrl}/${id}`, payload);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.eventsUrl}/${id}`);
  }
}
