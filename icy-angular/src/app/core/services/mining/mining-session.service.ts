import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Types de l'API /api/sessions (fiches de minage V3). Tous les montants et le partage sont calculés par le serveur. */
export type SessionStatus = 'ACTIVE' | 'SETTLEMENT' | 'CLOSED';
export type SessionPhase = 'MINING' | 'REFINING' | 'HANDOVER' | 'SELLING' | 'PAYMENTS' | 'DONE';
export type ExpenseKind = 'FUEL' | 'REPAIR' | 'MATERIAL' | 'OTHER';
export type OreDestination = 'SELL' | 'KEEP';

export interface UserRef { id: string; username: string; avatarUrl: string | null; }

export interface SessionSummary {
  id: string;
  name: string;
  sessionDate: string;
  status: SessionStatus;
  phase: SessionPhase;
  organizer: UserRef | null;
  participantCount: number;
  totalSales: number;
  mine: boolean;
  operationEventId: string | null;
}

export interface SessionParticipant { user: UserRef; sharesCenti: number; joinedAt: string; seller: boolean; }
export interface SessionExpense { id: string; payer: UserRef; kind: ExpenseKind; amount: number; note: string | null; createdAt: string; editable: boolean; }
export interface RefineryOrderLine { commodityId: number; commodityName: string; quantityCscu: number; quality: number; destination: OreDestination; }
export interface RefineryOrder {
  id: string;
  launcher: UserRef;
  terminalId: number | null;
  terminalLabel: string;
  methodCode: string | null;
  methodLabel: string | null;
  cost: number;
  finishesAt: string;
  ready: boolean;
  recipient: UserRef;
  handedOverAt: string | null;
  lines: RefineryOrderLine[];
  editable: boolean;
  canHandOver: boolean;
}
export interface SaleLine { commodityId: number; commodityName: string; quantityCscu: number; }
export interface SessionSale { id: string; seller: UserRef; terminalId: number | null; terminalLabel: string; amount: number; soldAt: string; lines: SaleLine[]; editable: boolean; }
export interface StockLine { commodityId: number; commodityName: string; inStockCscu: number; awaitingCscu: number; }
export interface SellerStock { seller: UserRef; lines: StockLine[]; }
export interface Remaining { commodityId: number; commodityName: string; totalCscu: number; soldCscu: number; remainingCscu: number; }
export interface ShareRow { user: UserRef; sharesCenti: number; share: number; advanced: number; cashed: number; balance: number; gap: number; }
export interface Transfer { id: string | null; from: UserRef; to: UserRef; amount: number; receivedAt: string | null; receivedBy: UserRef | null; }
export interface SettlementInfo { id: string; createdAt: string; createdBy: UserRef; closedAt: string | null; closeKind: 'NORMAL' | 'FORCED' | null; closeReason: string | null; }
export interface SessionShare {
  /** NONE : aucune vente encore, aucun solde affiché. PREVIEW : provisoire. SETTLEMENT : comptes arrêtés. */
  source: 'NONE' | 'PREVIEW' | 'SETTLEMENT';
  totalSales: number;
  totalExpenses: number;
  net: number;
  totalSharesCenti: number;
  rows: ShareRow[];
  transfers: Transfer[];
  settlement: SettlementInfo | null;
}
export interface SessionHistory { action: string; actor: UserRef; reason: string | null; at: string; }
export interface CancelledSettlement { id: string; createdAt: string; cancelledAt: string; cancelledBy: UserRef | null; totalSales: number; totalExpenses: number; net: number; transfers: Transfer[]; }

export interface SessionSheet {
  id: string;
  name: string;
  sessionDate: string;
  status: SessionStatus;
  phase: SessionPhase;
  revision: number;
  organizer: UserRef;
  operationEventId: string | null;
  operationTitle: string | null;
  permissions: { currentUserId: string; organizer: boolean; participant: boolean; canEdit: boolean };
  participants: SessionParticipant[];
  expenses: SessionExpense[];
  orders: RefineryOrder[];
  sales: SessionSale[];
  stock: SellerStock[];
  remaining: Remaining[];
  share: SessionShare;
  history: SessionHistory[];
  cancelledSettlements: CancelledSettlement[];
  lastOrderFinishesAt: string | null;
  serverTime: string;
}

export interface MarketCommodity { id: number; name: string; code: string | null; }
export interface MarketTerminal { id: number; name: string; location: string | null; system: string | null; refinery: boolean; }
export interface MarketMethod { code: string; name: string; ratingYield: number | null; ratingSpeed: number | null; ratingCost: number | null; }
export interface MarketReference { commodities: MarketCommodity[]; refineries: MarketTerminal[]; methods: MarketMethod[]; saleTerminals: MarketTerminal[]; pricesFetchedAt: string | null; }

export interface SalePoint { terminalId: number | null; terminalName: string; location: string | null; pricePerScu: number; demandScu: number | null; estimatedAuec: number; observedAt: string | null; }
export interface SaleSuggestions {
  commodities: { commodityId: number; commodityName: string; remainingCscu: number; points: SalePoint[] }[];
  singleStop: { terminalId: number | null; terminalName: string; location: string | null; commodityNames: string[] } | null;
  pricesFetchedAt: string | null;
}

export interface ExpensePayload { payerUserId?: string | null; kind: ExpenseKind; amount: number; note?: string | null; }
export interface OrderPayload {
  launcherUserId?: string | null;
  terminalId: number | null;
  methodCode?: string | null;
  cost: number;
  /** Durée restante affichée par la raffinerie ; null à la modification garde l'heure de fin. */
  remainingMinutes: number | null;
  recipientUserId: string | null;
  lines: { commodityId: number | null; quantityCscu: number; quality: number | null; destination: OreDestination }[];
}
export interface SalePayload { sellerUserId?: string | null; terminalId: number | null; terminalLabel?: string | null; amount: number; lines: { commodityId: number; quantityCscu: number }[]; }

@Injectable({ providedIn: 'root' })
export class MiningSessionService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/sessions';

  list(): Observable<SessionSummary[]> { return this.http.get<SessionSummary[]>(this.base); }
  get(id: string): Observable<SessionSheet> { return this.http.get<SessionSheet>(`${this.base}/${id}`); }
  reference(): Observable<MarketReference> { return this.http.get<MarketReference>(`${this.base}/reference`); }
  byOperation(operationId: string): Observable<{ sheetId: string }> { return this.http.get<{ sheetId: string }>(`${this.base}/by-operation/${operationId}`); }
  suggestions(id: string): Observable<SaleSuggestions> { return this.http.get<SaleSuggestions>(`${this.base}/${id}/sale-suggestions`); }

  create(payload: { name: string | null; sessionDate: string | null; participantIds: string[] }): Observable<SessionSheet> { return this.http.post<SessionSheet>(this.base, payload); }
  update(id: string, payload: { name?: string | null; sessionDate?: string | null }): Observable<SessionSheet> { return this.http.put<SessionSheet>(`${this.base}/${id}`, payload); }
  setParticipants(id: string, participants: { userId: string; sharesCenti: number }[]): Observable<SessionSheet> { return this.http.put<SessionSheet>(`${this.base}/${id}/participants`, { participants }); }

  addExpense(id: string, payload: ExpensePayload): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/expenses`, payload); }
  updateExpense(id: string, expenseId: string, payload: ExpensePayload): Observable<SessionSheet> { return this.http.put<SessionSheet>(`${this.base}/${id}/expenses/${expenseId}`, payload); }
  deleteExpense(id: string, expenseId: string): Observable<SessionSheet> { return this.http.delete<SessionSheet>(`${this.base}/${id}/expenses/${expenseId}`); }

  addOrder(id: string, payload: OrderPayload): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/refinery-orders`, payload); }
  updateOrder(id: string, orderId: string, payload: OrderPayload): Observable<SessionSheet> { return this.http.put<SessionSheet>(`${this.base}/${id}/refinery-orders/${orderId}`, payload); }
  deleteOrder(id: string, orderId: string): Observable<SessionSheet> { return this.http.delete<SessionSheet>(`${this.base}/${id}/refinery-orders/${orderId}`); }
  handOver(id: string, orderId: string): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/refinery-orders/${orderId}/handover`, {}); }
  cancelHandOver(id: string, orderId: string): Observable<SessionSheet> { return this.http.delete<SessionSheet>(`${this.base}/${id}/refinery-orders/${orderId}/handover`); }

  addSale(id: string, payload: SalePayload): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/sales`, payload); }
  updateSale(id: string, saleId: string, payload: SalePayload): Observable<SessionSheet> { return this.http.put<SessionSheet>(`${this.base}/${id}/sales/${saleId}`, payload); }
  deleteSale(id: string, saleId: string): Observable<SessionSheet> { return this.http.delete<SessionSheet>(`${this.base}/${id}/sales/${saleId}`); }

  settle(id: string): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/settle`, {}); }
  reopen(id: string, target: 'SETTLEMENT' | 'ACTIVE', reason: string): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/reopen`, { target, reason }); }
  forceClose(id: string, reason: string): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/close`, { reason }); }
  confirmReceipt(id: string, transferId: string): Observable<SessionSheet> { return this.http.post<SessionSheet>(`${this.base}/${id}/transfers/${transferId}/received`, {}); }
  withdrawReceipt(id: string, transferId: string): Observable<SessionSheet> { return this.http.delete<SessionSheet>(`${this.base}/${id}/transfers/${transferId}/received`); }
}

/** cSCU → texte en SCU, à la française : 1480 → « 14,8 ». */
export function formatScu(cscu: number): string {
  return (cscu / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function formatAuec(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)).replace(/ | /g, ' ');
}

export function sharesLabel(centi: number): string {
  if (centi === 100) return '1 part';
  if (centi === 50) return 'demi-part';
  if (centi === 0) return 'exclu du partage';
  return `${(centi / 100).toLocaleString('fr-FR')} part`;
}

/** Message d'erreur du serveur, ou texte de repli si la réponse n'en donne pas. */
export function serverMessage(error: unknown, fallback: string): string {
  const response = error as { status?: number; error?: { message?: unknown } };
  if (response?.status === 0) return 'Serveur injoignable. Réessayez dans un instant.';
  return (typeof response?.error?.message === 'string' && response.error.message) || fallback;
}

/** Couleur d'un minerai : même teinte partout (pastilles, barres, suggestions). */
const ORE_PALETTE = ['#c4b5fd', '#7dd3fc', '#f9a8d4', '#fde047', '#fdba74', '#86efac', '#fca5a5', '#a5b4fc', '#67e8f9', '#fcd34d'];
export function oreColor(name: string): string {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ORE_PALETTE[hash % ORE_PALETTE.length];
}
