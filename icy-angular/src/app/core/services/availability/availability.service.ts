import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { AvailabilityMember, AvailabilitySlot } from './availability';

/** Disponibilités habituelles : les siennes pour chaque membre, celles de tous pour les admins et officiers. */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/availability';

  mine(): Observable<AvailabilitySlot[]> {
    return this.http.get<{ slots: AvailabilitySlot[] }>(`${this.apiUrl}/me`).pipe(map(response => response.slots ?? []));
  }

  save(slots: AvailabilitySlot[]): Observable<AvailabilitySlot[]> {
    return this.http.put<{ slots: AvailabilitySlot[] }>(`${this.apiUrl}/me`, { slots }).pipe(map(response => response.slots ?? []));
  }

  members(): Observable<AvailabilityMember[]> {
    return this.http.get<AvailabilityMember[]>(`${this.apiUrl}/members`).pipe(shareReplay(1));
  }
}
