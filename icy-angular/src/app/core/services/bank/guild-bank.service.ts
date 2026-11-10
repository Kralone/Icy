import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type BankEntryKind = 'DEPOSIT' | 'EXPENSE' | 'PAYOUT' | 'ADJUSTMENT';
export type BankProjectStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

export interface BankAccess { details: boolean; write: boolean; }
export interface BankTotals { balance: number; deposits: number; expenses: number; payouts: number; adjustments: number; donors: number; entries: number; }
export interface BankMonthPoint { month: string; deposits: number; expenses: number; payouts: number; adjustmentsIn: number; adjustmentsOut: number; balance: number; }
export interface BankBalancePoint { date: string; balance: number; }
export interface BankProject {
  id: string; name: string; description: string | null; targetAmount: number | null; status: BankProjectStatus;
  shipId: number | null; shipName: string | null; shipImageUrl: string | null;
  collected: number; spent: number; paidOut: number; available: number; contributors: number; createdAt: string;
}
export interface BankPublicEntry { id: string; kind: BankEntryKind; amount: number; projectId: string | null; projectName: string | null; occurredOn: string; }
export interface BankEntry {
  id: string; kind: BankEntryKind; amount: number; signedAmount: number;
  userId: string | null; userName: string | null; userAvatarUrl: string | null;
  projectId: string | null; projectName: string | null; note: string | null; occurredOn: string;
  recordedBy: string; recordedByName: string; recordedAt: string;
  cancelled: boolean; cancelledAt: string | null; cancelledByName: string | null; cancelReason: string | null;
}
export interface BankMine { given: number; received: number; entries: BankEntry[]; }
export interface BankPlayer { userId: string; userName: string; userAvatarUrl: string | null; given: number; received: number; deposits: number; lastDeposit: string | null; }
export interface BankOverview {
  access: BankAccess; totals: BankTotals; months: BankMonthPoint[]; balanceCurve: BankBalancePoint[];
  projects: BankProject[]; recent: BankPublicEntry[]; mine: BankMine;
}
export interface BankMember { id: string; name: string; }
export interface BankDetails { entries: BankEntry[]; players: BankPlayer[]; }

export interface BankEntryRequest { kind: BankEntryKind; amount: number; userId: string | null; projectId: string | null; note: string | null; occurredOn: string | null; }
export interface BankProjectRequest { name: string; description: string | null; targetAmount: number | null; shipId: number | null; status?: BankProjectStatus; }

export const ENTRY_KIND_LABELS: Record<BankEntryKind, string> = {
  DEPOSIT: 'Dépôt',
  EXPENSE: 'Dépense',
  PAYOUT: 'Reversement',
  ADJUSTMENT: 'Ajustement'
};

export const PROJECT_STATUS_LABELS: Record<BankProjectStatus, string> = {
  OPEN: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé'
};

/** Banque de guilde (/api/bank) : le registre de l'argent que le trésorier garde en jeu. */
@Injectable({ providedIn: 'root' })
export class GuildBankService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/bank';

  overview(): Observable<BankOverview> {
    return this.http.get<BankOverview>(this.url);
  }

  details(): Observable<BankDetails> {
    return this.http.get<BankDetails>(`${this.url}/details`);
  }

  members(): Observable<BankMember[]> {
    return this.http.get<BankMember[]>(`${this.url}/members`);
  }

  record(request: BankEntryRequest): Observable<BankEntry> {
    return this.http.post<BankEntry>(`${this.url}/entries`, request);
  }

  cancel(entryId: string, reason: string): Observable<BankEntry> {
    return this.http.post<BankEntry>(`${this.url}/entries/${entryId}/cancel`, { reason });
  }

  createProject(request: BankProjectRequest): Observable<BankProject> {
    return this.http.post<BankProject>(`${this.url}/projects`, request);
  }

  updateProject(id: string, request: BankProjectRequest): Observable<BankProject> {
    return this.http.put<BankProject>(`${this.url}/projects/${id}`, request);
  }
}
