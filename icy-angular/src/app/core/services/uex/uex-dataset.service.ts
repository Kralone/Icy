import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export interface UexDatasetSummary {
  datasetKey: string;
  sourceUrl: string;
  itemCount: number;
  fetchedAt: string | null;
  updatedAt: string | null;
}

export interface UexDatasetDetail extends UexDatasetSummary {
  previewPayload: unknown;
  previewItemCount: number;
  truncated: boolean;
}

export interface UexResourceSale {
  displayName: string;
  canonicalName: string;
  kind: string;
  baseSell: number;
  bestSell: number | null;
  bestSellTerminal: string | null;
}

export interface UexRefineryDatasets {
  methods: unknown[];
  capacities: unknown[];
  yields: unknown[];
  audits: unknown[];
  methodsFetchedAt: string | null;
  capacitiesFetchedAt: string | null;
  yieldsFetchedAt: string | null;
  auditsFetchedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class UexDatasetService {
  private readonly baseUrl = '/api/utils/uex/datasets';

  constructor(private readonly http: HttpClient) {}

  listDatasets(): Observable<ApiResponse<UexDatasetSummary[]>> {
    return this.http.get<ApiResponse<UexDatasetSummary[]>>(this.baseUrl);
  }

  getDataset(datasetKey: string): Observable<ApiResponse<UexDatasetDetail>> {
    return this.http.get<ApiResponse<UexDatasetDetail>>(`${this.baseUrl}/${encodeURIComponent(datasetKey)}`);
  }

  refreshDataset(datasetKey: string): Observable<ApiResponse<UexDatasetDetail>> {
    return this.http.post<ApiResponse<UexDatasetDetail>>(`${this.baseUrl}/${encodeURIComponent(datasetKey)}/refresh`, {});
  }

  listResourceSales(names: string[]): Observable<ApiResponse<UexResourceSale[]>> {
    const query = names
      .filter((name) => !!name?.trim())
      .map((name) => `names=${encodeURIComponent(name.trim())}`)
      .join('&');
    const url = query ? `/api/front/resources/sales?${query}` : '/api/front/resources/sales';
    return this.http.get<ApiResponse<UexResourceSale[]>>(url);
  }

  listRefineryDatasets(): Observable<ApiResponse<UexRefineryDatasets>> {
    return this.http.get<ApiResponse<UexRefineryDatasets>>('/api/front/resources/refineries');
  }
}
