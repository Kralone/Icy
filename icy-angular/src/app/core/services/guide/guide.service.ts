import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Guide } from '../../../model/guide.model';

@Injectable({ providedIn: 'root' })
export class GuideService {
  constructor(private readonly http: HttpClient) {}
  listPublished(): Observable<Guide[]> { return this.http.get<Guide[]>('/api/guides'); }
  getPublished(slug: string): Observable<Guide> { return this.http.get<Guide>(`/api/guides/${slug}`); }
  listAdmin(): Observable<Guide[]> { return this.http.get<Guide[]>('/api/admin/guides'); }
  create(guide: Partial<Guide>): Observable<Guide> { return this.http.post<Guide>('/api/admin/guides', guide); }
  update(id: number, guide: Partial<Guide>): Observable<Guide> { return this.http.put<Guide>(`/api/admin/guides/${id}`, guide); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`/api/admin/guides/${id}`); }
}
