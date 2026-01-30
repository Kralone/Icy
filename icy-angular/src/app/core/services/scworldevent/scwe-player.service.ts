import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable, of, switchMap, map } from 'rxjs';
import { ScWorldEventDto, ScWorldEventParticipationDto } from '../../../model/scwe-player.model';
import {Page, ScWorldEvent} from './sc-world-event.service';

@Injectable({ providedIn: 'root' })
export class ScwePlayerService {
  private readonly base = `/api/sc-world-events`;

  constructor(private http: HttpClient) {}

  hasActiveEvent(): Observable<boolean> {
    return this.http.get<boolean>(`${this.base}/current/exists`);
  }

  getMyParticipations(): Observable<ScWorldEventParticipationDto[]> {
    return this.http.get<ScWorldEventParticipationDto[]>(`${this.base}/participations/me`).pipe(
      map((res: any) => (Array.isArray(res) ? res : []))
    );
  }

  updateMyParticipation(scweId: string, status: number, points: Record<string, number>) {
    return this.http.put<ScWorldEventParticipationDto>(
      `${this.base}/${scweId}/participation/me`,
      { status, points }
    );
  }

  getLeaderboard(eventId: string, page = 0, size = 50): Observable<Page<ScWorldEventParticipationDto>> {
    const params = new HttpParams().set('page', page).set('size', size);
    // Adapte l'URL selon ton controller
    return this.http.get<Page<ScWorldEventParticipationDto>>(`/api/sc-world-events/event/${eventId}/leaderboard`, { params });
  }
}
