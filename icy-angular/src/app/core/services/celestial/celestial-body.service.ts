import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export type CelestialBodyType = 'PLANET' | 'MOON';

export interface CelestialBody {
  id: number;
  name: string;
  slug: string;
  bodyType: CelestialBodyType;
  systemName: string;
  parentPlanet: string | null;
  wikiUrl: string;
  imageUrl: string;
  gameVersion: string;
  sortOrder: number;
}

export interface PlanetUpsertPayload {
  name: string;
  systemName: string;
  parentPlanet: string | null;
  imageUrl: string;
  wikiUrl: string;
  gameVersion: string;
  sortOrder: number;
}

@Injectable({ providedIn: 'root' })
export class CelestialBodyService {
  constructor(private readonly http: HttpClient) {}

  listFrontBodies(): Observable<ApiResponse<CelestialBody[]>> {
    return this.http.get<ApiResponse<CelestialBody[]>>('/api/front/celestial-bodies');
  }

  listPlanetsAdmin(): Observable<ApiResponse<CelestialBody[]>> {
    return this.http.get<ApiResponse<CelestialBody[]>>('/api/admin/planets');
  }

  createPlanet(payload: PlanetUpsertPayload): Observable<ApiResponse<CelestialBody>> {
    return this.http.post<ApiResponse<CelestialBody>>('/api/admin/planets', payload);
  }

  updatePlanet(id: number, payload: PlanetUpsertPayload): Observable<ApiResponse<CelestialBody>> {
    return this.http.put<ApiResponse<CelestialBody>>(`/api/admin/planets/${id}`, payload);
  }

  deletePlanet(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/admin/planets/${id}`);
  }
}
