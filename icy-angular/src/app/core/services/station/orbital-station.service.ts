import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export type StationKind = 'ORBITAL' | 'LAGRANGE' | 'OUTLAW' | 'GATEWAY' | 'SERVICE';
export type StationOrbitKind = 'PLANET' | 'MOON' | 'LAGRANGE_POINT' | 'ASTEROID_BELT' | 'JUMP_POINT' | 'UNKNOWN';

export interface OrbitalStation {
  id: number;
  name: string;
  slug: string;
  systemName: string;
  stationKind: StationKind;
  orbitKind: StationOrbitKind;
  orbitTarget: string | null;
  lagrangePoint: string | null;
  operatorName: string | null;
  wikiUrl: string;
  imageUrl: string;
  gameVersion: string;
  notes: string | null;
  sortOrder: number;
}

export interface StationUpsertPayload {
  name: string;
  systemName: string;
  stationKind: StationKind;
  orbitKind: StationOrbitKind;
  orbitTarget: string | null;
  lagrangePoint: string | null;
  operatorName: string | null;
  wikiUrl: string;
  imageUrl: string;
  gameVersion: string;
  notes: string | null;
  sortOrder: number;
}

@Injectable({ providedIn: 'root' })
export class OrbitalStationService {
  constructor(private readonly http: HttpClient) {}

  listFrontStations(): Observable<ApiResponse<OrbitalStation[]>> {
    return this.http.get<ApiResponse<OrbitalStation[]>>('/api/front/stations');
  }

  listAdminStations(): Observable<ApiResponse<OrbitalStation[]>> {
    return this.http.get<ApiResponse<OrbitalStation[]>>('/api/admin/stations');
  }

  createStation(payload: StationUpsertPayload): Observable<ApiResponse<OrbitalStation>> {
    return this.http.post<ApiResponse<OrbitalStation>>('/api/admin/stations', payload);
  }

  updateStation(id: number, payload: StationUpsertPayload): Observable<ApiResponse<OrbitalStation>> {
    return this.http.put<ApiResponse<OrbitalStation>>(`/api/admin/stations/${id}`, payload);
  }

  deleteStation(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/admin/stations/${id}`);
  }
}
