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
  salePoints: UexResourceSalePoint[];
}

export interface UexResourceSalePoint {
  terminalName: string;
  sellPrice: number;
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

export interface UexVehicleRental {
  vehicleName: string;
  terminalName: string;
  rentPrice: number;
}

export interface UexVehiclePurchase {
  vehicleName: string;
  terminalName: string;
  buyPrice: number;
}

export interface UexVehicleTerminal {
  name: string | null;
  nickname: string | null;
  displayName: string | null;
  code: string | null;
  planetName: string | null;
  cityName: string | null;
  spaceStationName: string | null;
  screenshot: string | null;
}

export type CatalogMapScope = 'VEHICLES' | 'ITEMS' | 'LOCATIONS' | 'ECONOMY' | 'WIKELO';

export interface CatalogSyncRun {
  id: number;
  operation: 'SCRAPE_ALL' | 'SCRAPE_AND_MAP';
  scope: CatalogMapScope | null;
  status: 'QUEUED' | 'RUNNING' | 'WAITING_FOR_REVIEW' | 'SUCCEEDED' | 'FAILED';
  currentStep: number;
  totalSteps: number;
  message: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

export interface CatalogConflictCandidate {
  externalId: string;
  name: string;
  slug: string | null;
  imageUrl: string;
  fallbackImage: boolean;
  description: string | null;
  sourceUrl: string | null;
}

export interface CatalogConflict {
  id: number;
  runId: number;
  family: string;
  name: string;
  manufacturer: string | null;
  candidates: CatalogConflictCandidate[];
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

  scrapeAllCatalogSources(): Observable<ApiResponse<CatalogSyncRun>> {
    return this.http.post<ApiResponse<CatalogSyncRun>>('/api/admin/catalog-sync/scrape-all', {});
  }

  scrapeAndMapCatalogScope(scope: CatalogMapScope): Observable<ApiResponse<CatalogSyncRun>> {
    return this.http.post<ApiResponse<CatalogSyncRun>>('/api/admin/catalog-sync/scrape-and-map', { scope });
  }

  getCurrentCatalogSync(): Observable<ApiResponse<CatalogSyncRun | null>> {
    return this.http.get<ApiResponse<CatalogSyncRun | null>>('/api/admin/catalog-sync/current');
  }

  getCatalogConflicts(runId: number): Observable<ApiResponse<CatalogConflict[]>> {
    return this.http.get<ApiResponse<CatalogConflict[]>>(`/api/admin/catalog-sync/conflicts?runId=${runId}`);
  }

  resolveCatalogConflict(conflictId: number, externalIds: string[]): Observable<ApiResponse<CatalogSyncRun>> {
    return this.http.post<ApiResponse<CatalogSyncRun>>(
      `/api/admin/catalog-sync/conflicts/${conflictId}/resolve`,
      { externalIds }
    );
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

  listVehicleRentals(): Observable<ApiResponse<UexVehicleRental[]>> {
    return this.http.get<ApiResponse<UexVehicleRental[]>>('/api/front/vehicles/rentals');
  }

  listVehiclePurchases(): Observable<ApiResponse<UexVehiclePurchase[]>> {
    return this.http.get<ApiResponse<UexVehiclePurchase[]>>('/api/front/vehicles/purchases');
  }

  listVehicleTerminals(): Observable<ApiResponse<UexVehicleTerminal[]>> {
    return this.http.get<ApiResponse<UexVehicleTerminal[]>>('/api/front/vehicles/terminals');
  }
}
