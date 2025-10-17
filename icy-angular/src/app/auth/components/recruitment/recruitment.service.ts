import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recruitment } from './recruitment.model';

@Injectable({
  providedIn: 'root'
})
export class RecruitmentService {
  private readonly API_URL = '/api/recruitment';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Recruitment[]> {
    return this.http.get<Recruitment[]>(this.API_URL);
  }

  create(recruitment: Recruitment): Observable<Recruitment> {
    return this.http.post<Recruitment>(this.API_URL, recruitment);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}
