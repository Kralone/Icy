import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DisciplineRecord, DisciplineSummary, SanctionDecision, WarningCategory } from '../../../model/discipline.model';

/** Avertissements disciplinaires (Officiers et Directeurs). */
@Injectable({ providedIn: 'root' })
export class DisciplineService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/admin/discipline';

  summary(): Observable<DisciplineSummary> {
    return this.http.get<DisciplineSummary>(this.api);
  }

  record(userId: string): Observable<DisciplineRecord> {
    return this.http.get<DisciplineRecord>(`${this.api}/members/${encodeURIComponent(userId)}`);
  }

  warn(userId: string, category: WarningCategory, reason: string): Observable<DisciplineRecord> {
    return this.http.post<DisciplineRecord>(`${this.api}/members/${encodeURIComponent(userId)}/warnings`, { category, reason });
  }

  revoke(warningId: number, reason: string, notifyMember: boolean): Observable<DisciplineRecord> {
    return this.http.post<DisciplineRecord>(`${this.api}/warnings/${warningId}/revoke`, { reason, notifyMember });
  }

  resend(warningId: number): Observable<DisciplineRecord> {
    return this.http.post<DisciplineRecord>(`${this.api}/warnings/${warningId}/resend`, {});
  }

  decide(userId: string, decision: SanctionDecision, note: string, notifyMember: boolean): Observable<DisciplineRecord> {
    return this.http.post<DisciplineRecord>(`${this.api}/members/${encodeURIComponent(userId)}/decision`, { decision, note, notifyMember });
  }

  confirmDiscordBan(sanctionId: number): Observable<DisciplineRecord> {
    return this.http.post<DisciplineRecord>(`${this.api}/sanctions/${sanctionId}/discord-ban`, {});
  }
}
