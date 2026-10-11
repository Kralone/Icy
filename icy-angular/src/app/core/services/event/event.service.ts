import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { WebSocketService } from '../websocket/websocket.service';
import { EventType } from '../../../model/event-type.model';

export interface EventCreateRequest {
  type: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
}

export interface EventDTO {
  id: string;
  type: EventType;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  createdAt: string;
  finished: boolean;
  activityType?: 'EVENT' | 'OPERATION';
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly baseUrl = '/api/events';

  isLoading = false;

  constructor(private http: HttpClient, private wsService: WebSocketService) {}

  // --- WebSocket ---
  listenForEventUpdate(): Observable<any> {
    return this.wsService.listenForEvent();
  }

  // --- CRUD Événements ---
  createEvent(event: EventCreateRequest): Observable<EventDTO> {
    return this.http.post<any>(`${this.baseUrl}/create`, event).pipe(
      map(res => res.data as EventDTO)
    );
  }

  updateEvent(event: any): Observable<EventDTO> {
    return this.http.put<any>(`${this.baseUrl}/update`, event).pipe(
      map(res => res.data as EventDTO)
    );
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}?id=${id}`);
  }

  /**
   * 🔹 Récupère tous les événements
   */
  getAll(): Observable<EventDTO[]> {
    return this.http.get<any>(`${this.baseUrl}/all`).pipe(
      map(res => res.data as EventDTO[])
    );
  }

  /**
   * 🔹 Récupère uniquement les événements à venir
   */
  getUpcomingEvents(): Observable<{ data: EventDTO[] }> {
    return this.http.get<{ data: EventDTO[] }>(`${this.baseUrl}/upcoming`);
  }

  // --- Types d'événements ---
  getAllTypes(): Observable<EventType[]> {
    return this.http.get<any>(`${this.baseUrl}/types`).pipe(
      map(res => res.data as EventType[])
    );
  }

  createType(type: any): Observable<EventType> {
    return this.http.post<{ data: EventType }>(`${this.baseUrl}/types`, type).pipe(
      map(res => res.data)
    );
  }

  deleteType(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/types/${name}`);
  }

  updateEventType(type: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/types/${type.name}`, type);
  }

  // --- Participations ---
  setParticipationStatus(eventId: string, status: number) {
    return this.http.post(`${this.baseUrl}/participation`, { eventId, status });
  }

  getParticipations(eventId: string): Observable<Object> {
    return this.http.get(`${this.baseUrl}/participation`, { params: { eventId } });
  }

  convertToOperation(eventId: string) {
    return this.http.post<any>(`/api/operations/${eventId}/convert`, {}).pipe(map(res => res.data));
  }

  getOperationForEdit(eventId: string) {
    return this.http.get<any>(`/api/operations/${eventId}/edit`).pipe(map(res => res.data));
  }

  updateOperation(eventId: string, payload: { briefing?: string; meetingPoint?: string; imageUrl?: string }) {
    return this.http.put<any>(`/api/operations/${eventId}`, payload).pipe(map(res => res.data));
  }

  publishOperation(eventId: string) {
    return this.http.post<any>(`/api/operations/${eventId}/publish`, {}).pipe(map(res => res.data));
  }

  assignOperationGroup(operationId: string, groupId: number) {
    return this.http.post(`/api/operations/${operationId}/assignments/me/${groupId}`, {});
  }

  requestOperationGroup(operationId: string, groupId: number) {
    return this.http.post(`/api/operations/${operationId}/assignment-requests/me/${groupId}`, {});
  }

  getMyHangar() { return this.http.get<{ data: any[] }>('/api/user-ships'); }
  proposeOperationShip(operationId: string, shipId: number, groupId?: number) {
    let params: any = { shipId };
    if (groupId != null) params.groupId = groupId;
    return this.http.post(`/api/operations/${operationId}/ships/proposals`, {}, { params });
  }
  getOperationGroupsForEdit(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/groups/edit`); }
  createOperationGroup(operationId: string, payload: any) { return this.http.post(`/api/operations/${operationId}/groups`, payload); }
}
