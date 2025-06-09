import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {Goal} from '../../../model/goal.model';

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly apiUrl = '/api/goals';

  constructor(private http: HttpClient) {}

  getAllGoals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(this.apiUrl);
  }

  updateProgress(id: number, delta: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/progress`, { delta });
  }

  deleteGoal(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  togglePinned(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/pin`, id);
  }

  addGoal(goal: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, goal);
  }

  getPinnedGoal(): Observable<Goal> {
    return this.http.get<Goal>(`${this.apiUrl}/pinned`);
  }

  incrementGoal(id: number, delta: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/increment?delta=${delta}`, null);
  }

}
