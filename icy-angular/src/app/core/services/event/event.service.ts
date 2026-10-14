import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { WebSocketService } from '../websocket/websocket.service';
import { EventType } from '../../../model/event-type.model';
import { OperationOrganization } from '../../../features/operations/organization/operation-organization.model';
import { CrewPreset, CrewPresetPayload, OperationCrew, PositionDraft } from '../../../features/operations/organization/operation-crew.model';
import { OperationCoordination } from '../../../features/operations/organization/operation-coordination-board.component';

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
  /** Liste de gestion uniquement : opération pas encore publiée, invisible des membres. */
  draft?: boolean;
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

  leaveOperationGroup(operationId: string) {
    return this.http.delete(`/api/operations/${operationId}/assignments/me`);
  }

  cancelOperationGroupRequest(operationId: string) {
    return this.http.delete(`/api/operations/${operationId}/assignment-requests/me`);
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
  acceptOperationShipProposal(operationId: string, proposalId: string) {
    return this.http.post(`/api/operations/${operationId}/ships/proposals/${proposalId}/accept`, {});
  }
  declineOperationShipProposal(operationId: string, proposalId: string) {
    return this.http.post(`/api/operations/${operationId}/ships/proposals/${proposalId}/decline`, {});
  }
  setOperationShipPilot(operationId: string, proposalId: string, pilotUserId: string | null) {
    let params: any = {};
    if (pilotUserId) params.pilotUserId = pilotUserId;
    return this.http.put(`/api/operations/${operationId}/ships/proposals/${proposalId}/pilot`, {}, { params });
  }
  getOperationShips(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/ships`); }
  getOperationOrganization(operationId: string) { return this.http.get<{ data: OperationOrganization }>(`/api/operations/${operationId}/organization`).pipe(map(res => res.data)); }
  getOperationCoordination(operationId: string) { return this.http.get<{ data: OperationCoordination }>(`/api/operations/${operationId}/coordination`).pipe(map(res => res.data)); }
  assignOperationMember(operationId: string, userId: string, groupId: number) { return this.http.put(`/api/operations/${operationId}/assignments/members/${userId}`, {}, { params: { groupId } }); }
  removeOperationMember(operationId: string, userId: string) { return this.http.delete(`/api/operations/${operationId}/assignments/members/${userId}`); }
  createOperationGroup(operationId: string, payload: any) { return this.http.post(`/api/operations/${operationId}/groups`, payload); }
  updateOperationGroup(operationId: string, groupId: number, payload: any) { return this.http.put(`/api/operations/${operationId}/groups/${groupId}`, payload); }
  /** {@code withLinkedShips} : les besoins de vaisseaux du groupe et les vaisseaux proposés pour lui sont supprimés avec lui. */
  deleteOperationGroup(operationId: string, groupId: number, withLinkedShips = false) {
    return this.http.delete(`/api/operations/${operationId}/groups/${groupId}`, withLinkedShips ? { params: { withLinkedShips: true } } : {});
  }
  reorderOperationGroups(operationId: string, groupIds: number[]) { return this.http.put(`/api/operations/${operationId}/groups/reorder`, groupIds); }
  approveOperationAssignment(requestId: string) { return this.http.post(`/api/operations/assignment-requests/${requestId}/approve`, {}); }
  refuseOperationAssignment(requestId: string) { return this.http.post(`/api/operations/assignment-requests/${requestId}/refuse`, {}); }
  getOperationShipRequirements(operationId: string) { return this.http.get<{ data: any[] }>(`/api/operations/${operationId}/ship-requirements`); }
  createOperationShipRequirement(operationId: string, payload: any) { return this.http.post(`/api/operations/${operationId}/ship-requirements`, payload); }
  updateOperationShipRequirement(operationId: string, requirementId: string, payload: any) { return this.http.put(`/api/operations/${operationId}/ship-requirements/${requirementId}`, payload); }
  getOperationCrews(operationId: string) { return this.http.get<{ data: OperationCrew[] }>(`/api/operations/${operationId}/crews`).pipe(map(res => res.data)); }
  getCrewPresets(shipModelId: number) { return this.http.get<{ data: CrewPreset[] }>('/api/operations/crew-presets', { params: { shipModelId } }).pipe(map(res => res.data)); }
  /** Bibliothèque complète, presets archivés compris : le serveur ne rend les archivés qu'à un administrateur. */
  getCrewPresetLibrary() { return this.http.get<{ data: CrewPreset[] }>('/api/operations/crew-presets', { params: { includeArchived: true } }).pipe(map(res => res.data)); }
  saveCrewPreset(presetId: string | null, payload: CrewPresetPayload) {
    return (presetId ? this.http.put<{ data: CrewPreset }>(`/api/operations/crew-presets/${presetId}`, payload) : this.http.post<{ data: CrewPreset }>('/api/operations/crew-presets', payload)).pipe(map(res => res.data));
  }
  setCrewPresetArchived(presetId: string, archived: boolean) {
    return archived ? this.http.delete(`/api/operations/crew-presets/${presetId}`) : this.http.post(`/api/operations/crew-presets/${presetId}/restore`, {});
  }
  /** Mon propre poste dans mon équipage ; null : je reste dans l'équipage, sans poste. */
  setMyOperationPosition(operationId: string, positionId: number | null) {
    const url = `/api/operations/${operationId}/assignments/me/position`;
    return positionId === null ? this.http.delete(url) : this.http.put(url, {}, { params: { positionId } });
  }
  addOperationPosition(operationId: string, groupId: number, payload: PositionDraft & { sortOrder: number }) { return this.http.post(`/api/operations/${operationId}/groups/${groupId}/positions`, payload); }
  updateOperationPosition(operationId: string, groupId: number, positionId: number, payload: PositionDraft & { sortOrder: number }) { return this.http.put(`/api/operations/${operationId}/groups/${groupId}/positions/${positionId}`, payload); }
  deleteOperationPosition(operationId: string, groupId: number, positionId: number) { return this.http.delete(`/api/operations/${operationId}/groups/${groupId}/positions/${positionId}`); }
  /** positionId null : le membre reste dans l'équipage, sans poste. */
  setOperationMemberPosition(operationId: string, userId: string, positionId: number | null) {
    const url = `/api/operations/${operationId}/assignments/members/${userId}/position`;
    return positionId === null ? this.http.delete(url) : this.http.put(url, {}, { params: { positionId } });
  }
  deleteOperationShipRequirement(operationId: string, requirementId: string) { return this.http.delete(`/api/operations/${operationId}/ship-requirements/${requirementId}`); }
}
