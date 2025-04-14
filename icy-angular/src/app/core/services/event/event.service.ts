import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {WebSocketService} from '../websocket/websocket.service';

export interface EventCreateRequest {
  type: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
}

export interface EventDTO {
  id: string;
  type: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  createdAt: string;
  finished: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly baseUrl = '/api/events';

  isLoading = false;

  constructor(private http: HttpClient, private wsService: WebSocketService) {}

  listenForEventUpdate(): Observable<any> {
    return this.wsService.listenForEvent();
  }

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
}
