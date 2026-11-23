import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActivityOverview, ActivitySettings, CampaignCreate, DirectMessageEntry, ManualFollowUp, MemberHistory, MemberReminder,
  MessageTemplate, ReminderCampaign, ReminderUpdate
} from './member-activity';

/** Activité des membres, campagnes et fiches de rappel, modèles de message et annonces de promotion. */
@Injectable({ providedIn: 'root' })
export class MemberActivityService {
  private readonly http = inject(HttpClient);
  private readonly api = '/api/member-activity';

  overview(): Observable<ActivityOverview> {
    return this.http.get<ActivityOverview>(this.api);
  }

  updateSettings(settings: ActivitySettings): Observable<ActivitySettings> {
    return this.http.put<ActivitySettings>(`${this.api}/settings`, settings);
  }

  updateFollowUp(userId: string, body: { state: 'ACTIF' | 'EN_PAUSE' | null; until: string | null; note: string | null }): Observable<ManualFollowUp> {
    return this.http.put<ManualFollowUp>(`${this.api}/members/${encodeURIComponent(userId)}/follow-up`, body);
  }

  history(userId: string): Observable<MemberHistory> {
    return this.http.get<MemberHistory>(`${this.api}/members/${encodeURIComponent(userId)}/history`);
  }

  announce(userId: string, templateCode: string): Observable<DirectMessageEntry> {
    return this.http.post<DirectMessageEntry>(`${this.api}/members/${encodeURIComponent(userId)}/announce`, { templateCode });
  }

  templates(): Observable<MessageTemplate[]> {
    return this.http.get<MessageTemplate[]>(`${this.api}/templates`);
  }

  updateTemplate(code: string, body: string, mediaFile: string | null): Observable<MessageTemplate> {
    return this.http.put<MessageTemplate>(`${this.api}/templates/${encodeURIComponent(code)}`, { body, mediaFile });
  }

  campaigns(): Observable<ReminderCampaign[]> {
    return this.http.get<ReminderCampaign[]>(`${this.api}/campaigns`);
  }

  campaign(id: number): Observable<ReminderCampaign> {
    return this.http.get<ReminderCampaign>(`${this.api}/campaigns/${id}`);
  }

  createCampaign(request: CampaignCreate): Observable<ReminderCampaign> {
    return this.http.post<ReminderCampaign>(`${this.api}/campaigns`, request);
  }

  sendCampaign(id: number): Observable<{ queued: number; skipped: string[] }> {
    return this.http.post<{ queued: number; skipped: string[] }>(`${this.api}/campaigns/${id}/send`, {});
  }

  cancelCampaign(id: number): Observable<ReminderCampaign> {
    return this.http.post<ReminderCampaign>(`${this.api}/campaigns/${id}/cancel`, {});
  }

  deleteCampaign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/campaigns/${id}`);
  }

  updateReminder(id: number, update: ReminderUpdate): Observable<MemberReminder> {
    return this.http.put<MemberReminder>(`${this.api}/reminders/${id}`, update);
  }

  resendReminder(id: number): Observable<MemberReminder> {
    return this.http.post<MemberReminder>(`${this.api}/reminders/${id}/send`, {});
  }
}
