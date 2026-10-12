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
  imageUrl?: string;
  allowShipProposals?: boolean;
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

export interface OperationDraftSummary {
  id: string;
  title: string;
  type?: string | null;
  typeTextColor?: string | null;
  typeBackgroundColor?: string | null;
  typeImageUrl?: string | null;
  startDateTime: string;
  endDateTime: string;
  updatedAt?: string | null;
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

  createOperation(event: EventCreateRequest): Observable<any> {
    return this.http.post<any>('/api/operations/create', event).pipe(map(res => res.data));
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
  /** `includeDrafts` : réservé à la gestion des événements ; le serveur ne l'honore que pour un organisateur. */
  getAll(options: { includeDrafts?: boolean } = {}): Observable<EventDTO[]> {
    return this.http.get<any>(`${this.baseUrl}/all`, options.includeDrafts ? { params: { includeDrafts: true } } : {}).pipe(
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

  /** `expectedRevision` : le serveur refuse (409) si l'opération a changé depuis cette révision. */
  updateOperation(eventId: string, payload: { briefing?: string; objectives?: string; meetingPoint?: string; imageUrl?: string; allowShipProposals?: boolean; expectedRevision?: number | null }, options: { keepalive?: boolean } = {}) {
    return this.http.put<any>(`/api/operations/${eventId}`, payload, options.keepalive ? { keepalive: true } : {}).pipe(map(res => res.data));
  }

  getOperationDrafts() {
    return this.http.get<{ data: OperationDraftSummary[] }>('/api/operations/drafts').pipe(map(res => res.data));
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
  proposeOperationShip(operationId: string, shipId: number, groupId?: number, requirementId?: string) {
    let params: any = { shipId };
    if (groupId != null) params.groupId = groupId;
    if (requirementId) params.requirementId = requirementId;
    return this.http.post(`/api/operations/${operationId}/ships/proposals`, {}, { params });
  }
  withdrawOperationShipProposal(operationId: string, proposalId: string) {
    return this.http.delete(`/api/operations/${operationId}/ships/proposals/${proposalId}`);
  }
  markOperationShipProposalUnavailable(operationId: string, proposalId: string) {
    return this.http.post(`/api/operations/${operationId}/ships/proposals/${proposalId}/unavailable`, {});
  }
  setOperationShipPilot(operationId: string, proposalId: string, pilotUserId: string | null) {
    let params: any = {};
    if (pilotUserId) params.pilotUserId = pilotUserId;
    return this.http.put(`/api/operations/${operationId}/ships/proposals/${proposalId}/pilot`, {}, { params });
  }
  getOperationShips(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/ships`); }
  getOperationGroupsForEdit(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/groups/edit`); }
  createOperationGroup(operationId: string, payload: any) { return this.http.post(`/api/operations/${operationId}/groups`, payload); }
  updateOperationGroup(operationId: string, groupId: number, payload: any) { return this.http.put(`/api/operations/${operationId}/groups/${groupId}`, payload); }
  deleteOperationGroup(operationId: string, groupId: number) { return this.http.delete(`/api/operations/${operationId}/groups/${groupId}`); }
  reorderOperationGroups(operationId: string, groupIds: number[]) { return this.http.put(`/api/operations/${operationId}/groups/reorder`, groupIds); }
  getOperationAssignmentRequests(operationId: string) { return this.http.get<{ data: Array<{ id: string; groupId: number; userId: string; status: string; createdAt: string }> }>(`/api/operations/${operationId}/assignment-requests`); }
  approveOperationAssignment(requestId: string) { return this.http.post(`/api/operations/assignment-requests/${requestId}/approve`, {}); }
  refuseOperationAssignment(requestId: string) { return this.http.post(`/api/operations/assignment-requests/${requestId}/refuse`, {}); }
  getOperationShipRequirements(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/ship-requirements`); }
  createOperationShipRequirement(operationId: string, payload: any) { return this.http.post(`/api/operations/${operationId}/ship-requirements`, payload); }
  updateOperationShipRequirement(operationId: string, requirementId: string, payload: any) { return this.http.put(`/api/operations/${operationId}/ship-requirements/${requirementId}`, payload); }
  deleteOperationShipRequirement(operationId: string, requirementId: string) { return this.http.delete(`/api/operations/${operationId}/ship-requirements/${requirementId}`); }
}
