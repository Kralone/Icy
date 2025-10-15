import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Observable, map, tap, of, catchError} from 'rxjs';
import {User} from '../../../model/userDto.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<boolean> {
    return this.http.post<{ tokens: { accessToken: string, refreshToken: string }, user: User }>(
      `${this.apiUrl}/login`,
      { username, password }
    ).pipe(
      tap(response => {
        const accessToken = response.tokens.accessToken;
        const refreshToken = response.tokens.refreshToken;
        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(response.user.username));
      }),
      map(() => true)
    );
  }


  logout(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  resetPassword(payload: { id: string, newPassword: string }): Observable<{ tokens: { accessToken: string, refreshToken: string }, user: User }> {
    return this.http.post<{ tokens: { accessToken: string, refreshToken: string }, user: User }>(
      `${this.apiUrl}/reset-password`, payload);
  }


  refreshToken(): Observable<{accessToken: string, refreshToken: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.http.post<{accessToken: string, refreshToken: string }>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      map(response => response)
    );
  }

  hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  verifyToken(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return of(false);

    return this.http.get<{ valid: boolean }>(
      `${this.apiUrl}/verify-token`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  private getTokenExpiration(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  getCurrentUser(): any {
    const userJson = localStorage.getItem('user');
    if (!userJson) return null;
    return userJson;
  }


  forceResetPassword(userId: string): Promise<void> {
    return fetch(`/api/auth/admin/force-reset-password?id=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    }).then(response => {
      if (!response.ok) {
        throw new Error('Erreur lors de la réinitialisation du mot de passe.');
      }
    });
  }

  isAdmin(): Observable<boolean> {
    return this.http.get<boolean>('/api/auth/isAdmin');
  }

}
