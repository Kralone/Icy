import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecruitmentAdmin } from '../../../model/recruitment-admin.model';

@Injectable({
  providedIn: 'root'
})
export class RecruitmentService {
  private readonly API_URL = '/api/recruitment';

  constructor(private http: HttpClient) {}

  /**
   * 🚀 Candidat : soumission d'une candidature
   * (Le backend s'occupe de transformer en RecruitmentAdmin côté serveur)
   */
  create(recruitment: {
    username: string;
    discordTag: string;
    motivation: string;
    referral?: string;
    experience?: string;
    preferredGameplay?: string;
  }): Observable<void> {
    return this.http.post<void>(this.API_URL, recruitment);
  }

  /**
   * 📋 Admin : récupération de toutes les candidatures
   */
  getAll(): Observable<RecruitmentAdmin[]> {
    return this.http.get<RecruitmentAdmin[]>(this.API_URL);
  }

  /**
   * 🧩 Admin : mise à jour d'une candidature
   */
  update(recruitment: RecruitmentAdmin): Observable<RecruitmentAdmin> {
    return this.http.put<RecruitmentAdmin>(`${this.API_URL}/${recruitment.id}`, recruitment);
  }

  /**
   * 🧊 Admin : marquer comme traitée
   */
  markProcessed(id: number): Observable<void> {
    return this.http.patch<void>(`${this.API_URL}/${id}/process`, {});
  }

  /**
   * 🗑️ Admin : suppression d'une candidature
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  accept(id: number): Observable<void> {
    return this.http.patch<void>(`${this.API_URL}/${id}/accept`, {});
  }

  refuse(id: number): Observable<void> {
    return this.http.patch<void>(`${this.API_URL}/${id}/refuse`, {});
  }

}
