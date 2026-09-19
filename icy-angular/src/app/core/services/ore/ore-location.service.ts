import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export interface OreMetricRange {
  min: number | null;
  max: number | null;
  med: number | null;
}

export interface OreMix {
  imageUrl?: string | null;
  catalogEntryId?: number | null;
  oreCode: string;
  probability: number | null;
  minPct: number | null;
  maxPct: number | null;
  medPct: number | null;
}

export interface OreLocation {
  id: number | null;
  locationKey?: string | null;
  locationCode: string;
  sourceUrl?: string | null;
  gameVersion?: string | null;
  updatedAt?: string | null;
  users: number | null;
  scans: number | null;
  clusters: number | null;
  clusterCount: OreMetricRange;
  mass: OreMetricRange;
  inst: OreMetricRange;
  res: OreMetricRange;
  ores: OreMix[];
}

export interface OreLocationUploadResult {
  locationCount: number;
  oreEntryCount: number;
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

  uploadAndReset(file: File): Observable<ApiResponse<OreLocationUploadResult>> {
    const payload = new FormData();
    payload.append('file', file);
    return this.http.post<ApiResponse<OreLocationUploadResult>>('/api/admin/ore-locations/upload', payload);
  }
}
