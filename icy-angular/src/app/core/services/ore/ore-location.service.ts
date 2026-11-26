import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export interface OreMix {
  imageUrl?: string | null;
  catalogEntryId?: number | null;
  oreCode: string;
  probability: number | null;
  minPct: number | null;
  maxPct: number | null;
  /** Mode de minage (Vaisseau, Véhicule, À pied) et taille des amas. */
  method?: string | null;
  clusterMin?: number | null;
  clusterMax?: number | null;
  clusterProbability?: number | null;
}

export interface OreLocation {
  locationKey?: string | null;
  /** Système indiqué par les fichiers du jeu, quand il est connu. */
  systemName?: string | null;
  locationCode: string;
  sourceUrl?: string | null;
  gameVersion?: string | null;
  updatedAt?: string | null;
  ores: OreMix[];
}

@Injectable({ providedIn: 'root' })
export class OreLocationService {
  constructor(private readonly http: HttpClient) {}

  listAdminLocations(): Observable<ApiResponse<OreLocation[]>> {
    return this.http.request<ApiResponse<OreLocation[]>>('GET', '/api/admin/ore-locations');
  }

  listFrontLocations(): Observable<ApiResponse<OreLocation[]>> {
    return this.http.request<ApiResponse<OreLocation[]>>('GET', '/api/front/ore-locations');
  }
}
