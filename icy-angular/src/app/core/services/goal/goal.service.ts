import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {Goal} from '../../../model/goal.model';
import {GoalTemplate} from '../../../model/goal-template.model';

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly apiUrl = '/api/goals';

  constructor(private http: HttpClient) {}

  getAllGoals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(this.apiUrl);
  }

  getAllTemplates(): Observable<GoalTemplate[]> {
    return this.http.get<GoalTemplate[]>(`/api/goal-templates`);
  }

  updateProgress(id: number, delta: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/progress`, { delta });
  }

  deleteGoal(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  togglePinned(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/pin`, null);
  }

  addGoal(goal: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, goal);
  }

  addTemplate(template: any): Observable<any> {
    return this.http.post<any>(`/api/goal-templates`, template);
  }

  addTemplateTree(template: any): Observable<void> {
    return this.http.post<void>(`/api/goal-templates/batch`, template);
  }

  getPinnedGoal(): Observable<Goal> {
    return this.http.get<Goal>(`${this.apiUrl}/pinned`);
  }

  incrementGoal(id: number, delta: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/increment?delta=${delta}`, null);
  }

  updateGoal(id: number, payload: Partial<Goal>): Observable<Goal> {
    return this.http.put<Goal>(`${this.apiUrl}/${id}`, payload);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`/api/goal-templates/${id}`);
  }

  applyTemplate(id: number, payload: { userId?: string | null; parentGoalId?: number | null }): Observable<void> {
    return this.http.post<void>(`/api/goal-templates/${id}/apply`, payload ?? {});
  }

}
