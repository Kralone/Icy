import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export interface OreMetricRange {
  min: number;
  max: number;
  med: number;
}

export interface OreMix {
  oreCode: string;
  probability: number;
  minPct: number;
  maxPct: number;
  medPct: number;
}

export interface OreLocation {
  id: number;
  locationCode: string;
  users: number;
  scans: number;
  clusters: number;
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
