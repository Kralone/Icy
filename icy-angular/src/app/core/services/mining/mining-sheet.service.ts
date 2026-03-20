import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type MiningSheetStatus = 'OPEN' | 'LOCKED' | 'FINALIZED';
export type MiningJobType = 'REFINERY' | 'FUEL' | 'REPAIR' | 'MATERIAL';

export interface MiningSheetUser {
  id: string;
  username: string;
  roles: string[];
  avatarUrl: string | null;
}

export interface MiningSheetJobOre {
  id: string;
  oreName: string;
  quantityCscu: number;
  quantityScu: number;
  includeInSale: boolean;
}

export interface MiningSheetJob {
  id: string;
  type: MiningJobType;
  owner: MiningSheetUser;
  refineryMethod: string | null;
  durationMinutes: number | null;
  costAuec: number;
  publishedAt: string | null;
  finishAt: string | null;
  remainingSeconds: number | null;
  notes: string | null;
  ores: MiningSheetJobOre[];
  editableByCurrentUser: boolean;
  timerEditableByCurrentUser: boolean;
}

export interface MiningSheetShipCargoGrid {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  slotCount: number;
}

export interface MiningSheetShip {
  id: string;
  shipId: number | null;
  shipName: string;
  shipImageUrl: string | null;
  shipBrandName: string | null;
  shipFocus: string | null;
  shipSize: string | null;
  shipScu: number | null;
  addedBy: MiningSheetUser;
  addedAt: string;
  cargoGrids: MiningSheetShipCargoGrid[];
  removableByCurrentUser: boolean;
}

export interface MiningSheetSale {
  id: string;
  declaredBy: MiningSheetUser;
  creditAuec: number;
  declaredAt: string;
}

export interface MiningSheetSummaryOre {
  oreName: string;
  totalCscu: number;
  totalScu: number;
  bestSellAuec: number | null;
  bestSellTerminal: string | null;
  estimatedAuec: number | null;
}

export interface MiningSheetUserMaterialOre {
  oreName: string;
  totalCscu: number;
  totalScu: number;
}

export interface MiningSheetUserMaterial {
  userId: string;
  username: string;
  totalScu: number;
  ores: MiningSheetUserMaterialOre[];
}

export interface MiningSheetSettlement {
  userId: string;
  username: string;
  grossEstimateAuec: number;
  paidCostsAuec: number;
  sharedCostAuec: number;
  compensationAuec: number;
  payoutAuec: number;
}

export interface MiningSheetSaleTransfer {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amountAuec: number;
}

export interface MiningSheetSummary {
  ores: MiningSheetSummaryOre[];
  keptOres: MiningSheetSummaryOre[];
  longestRemainingSeconds: number;
  userMaterials: MiningSheetUserMaterial[];
  totalEstimatedAuec: number;
  totalCostsAuec: number;
  netEstimatedAuec: number;
  settlements: MiningSheetSettlement[];
  totalDeclaredSalesAuec: number;
  saleSettlements: MiningSheetSettlement[];
  saleTransfers: MiningSheetSaleTransfer[];
}

export interface MiningSheet {
  id: string;
  sheetName: string;
  operationDate: string;
  refineryLocation: string;
  saleLocation: string | null;
  status: MiningSheetStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: MiningSheetUser;
  members: MiningSheetUser[];
  jobs: MiningSheetJob[];
  sheetShips: MiningSheetShip[];
  sales: MiningSheetSale[];
  summary: MiningSheetSummary;
  editableByCurrentUser: boolean;
  adminView: boolean;
}

export interface MiningSheetUpsertPayload {
  sheetName: string;
  operationDate: string;
  refineryLocation: string;
  saleLocation?: string | null;
  memberIds: string[];
}

export interface MiningSheetJobOrePayload {
  oreName: string;
  quantityCscu: number;
  includeInSale?: boolean | null;
}

export interface MiningSheetJobPayload {
  type: MiningJobType;
  ownerUserId?: string | null;
  refineryMethod?: string | null;
  durationMinutes?: number | null;
  costAuec?: number | null;
  publishedAt?: string | null;
  notes?: string | null;
  ores?: MiningSheetJobOrePayload[] | null;
}

@Injectable({ providedIn: 'root' })
export class MiningSheetService {
  private readonly baseUrl = '/api/mining-sheets';

  constructor(private readonly http: HttpClient) {}

  listSheets(): Observable<MiningSheet[]> {
    return this.http.get<MiningSheet[]>(this.baseUrl);
  }

  createSheet(payload: MiningSheetUpsertPayload): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(this.baseUrl, payload);
  }

  updateSheet(sheetId: string, payload: MiningSheetUpsertPayload): Observable<MiningSheet> {
    return this.http.put<MiningSheet>(`${this.baseUrl}/${sheetId}`, payload);
  }

  lockSheet(sheetId: string): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/lock`, {});
  }

  unlockSheet(sheetId: string): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/unlock`, {});
  }

  finalizeSheet(sheetId: string): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/finalize`, {});
  }

  createJob(sheetId: string, payload: MiningSheetJobPayload): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/jobs`, payload);
  }

  updateJob(sheetId: string, jobId: string, payload: MiningSheetJobPayload): Observable<MiningSheet> {
    return this.http.put<MiningSheet>(`${this.baseUrl}/${sheetId}/jobs/${jobId}`, payload);
  }

  deleteJob(sheetId: string, jobId: string): Observable<MiningSheet> {
    return this.http.delete<MiningSheet>(`${this.baseUrl}/${sheetId}/jobs/${jobId}`);
  }

  addSheetShip(sheetId: string, shipId: number): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/ships`, { shipId });
  }

  removeSheetShip(sheetId: string, sheetShipId: string): Observable<MiningSheet> {
    return this.http.delete<MiningSheet>(`${this.baseUrl}/${sheetId}/ships/${sheetShipId}`);
  }

  declareSale(sheetId: string, creditAuec: number): Observable<MiningSheet> {
    return this.http.post<MiningSheet>(`${this.baseUrl}/${sheetId}/sales`, { creditAuec });
  }

  suggestSaleLocations(query: string): Observable<string[]> {
    const safeQuery = (query ?? '').trim();
    const url = safeQuery
      ? `${this.baseUrl}/sale-locations?query=${encodeURIComponent(safeQuery)}`
      : `${this.baseUrl}/sale-locations`;
    return this.http.get<string[]>(url);
  }
}
