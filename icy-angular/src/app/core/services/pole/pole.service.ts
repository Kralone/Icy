import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PoleHome, PoleNews, PoleReferents } from './pole';

/** Pôles de l'organisation : référents, accueil d'un pôle et ses actualités. */
@Injectable({ providedIn: 'root' })
export class PoleService {
  private readonly http = inject(HttpClient);

  referents(): Observable<PoleReferents[]> {
    return this.http.get<PoleReferents[]>('/api/poles');
  }

  home(key: string): Observable<PoleHome> {
    return this.http.get<PoleHome>(`/api/poles/${key}`);
  }

  publishNews(key: string, news: { title: string; content: string }): Observable<PoleNews> {
    return this.http.post<PoleNews>(`/api/poles/${key}/news`, news);
  }

  updateNews(key: string, id: number, news: { title: string; content: string }): Observable<PoleNews> {
    return this.http.put<PoleNews>(`/api/poles/${key}/news/${id}`, news);
  }

  deleteNews(key: string, id: number): Observable<void> {
    return this.http.delete<void>(`/api/poles/${key}/news/${id}`);
  }
}
