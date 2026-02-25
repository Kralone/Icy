import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {Observable, map, tap, of, catchError} from 'rxjs';
import {User} from '../../../model/userDto.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<{
    tokens: { accessToken: string, refreshToken: string },
    user: User
  }> {
    return this.http.post<{ tokens: { accessToken: string, refreshToken: string }, user: User }>(
      `${this.apiUrl}/login`,
      { username, password }
    ).pipe(
      tap(response => {
        // 🧊 Ne rien stocker si c’est un mot de passe temporaire
        if (response.tokens.accessToken !== 'resetPwd' && response.tokens.refreshToken !== 'resetPwd') {
          this.setStorage('token', response.tokens.accessToken);
          this.setStorage('refreshToken', response.tokens.refreshToken);
          this.setStorage('user', JSON.stringify(response.user.username));
        }
      })
    );
  }

  logout(): void {
    this.removeStorage('user');
    this.removeStorage('token');
    this.removeStorage('refreshToken');
  }

  resetPassword(payload: { id: string, newPassword: string }): Observable<{ tokens: { accessToken: string, refreshToken: string }, user: User }> {
    return this.http.post<{ tokens: { accessToken: string, refreshToken: string }, user: User }>(
      `${this.apiUrl}/reset-password`, payload);
  }


  refreshToken(): Observable<{accessToken: string, refreshToken: string }> {
    const refreshToken = this.getStorage('refreshToken');
    return this.http.post<{accessToken: string, refreshToken: string }>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      map(response => response)
    );
  }

  hasToken(): boolean {
    return !!this.getStorage('token');
  }

  getToken(): string {
    const token = this.getStorage('token');
    if (!token) {
      throw new Error('Aucun token JWT trouvé dans le stockage local.');
    }
    return token;
  }

  verifyToken(): Observable<boolean> {
    const token = this.getStorage('token');
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
    const userJson = this.getStorage('user');
    if (!userJson) return null;
    return userJson;
  }


  forceResetPassword(userId: string): Observable<void> {
    return this.http.post<void>(
      `/api/auth/admin/force-reset-password?id=${userId}`,
      {},
      { withCredentials: true }
    );
  }


  isAdmin(): Observable<boolean> {
    return this.http.get<boolean>('/api/auth/isAdmin');
  }

  getUserIdFromToken(): string {
    const token = this.getToken();

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Token JWT invalide : structure incorrecte.');
    }

    try {
      const payload = JSON.parse(atob(parts[1]));
      // ✅ On cherche d'abord "userId" puis éventuellement d'autres champs
      const userId = payload?.userId || payload?.id || payload?.sub;

      if (!userId || typeof userId !== 'string') {
        throw new Error('Impossible de récupérer l’UUID utilisateur depuis le token.');
      }

      return userId;
    } catch (error) {
      console.error('❌ Erreur lors du décodage du token JWT :', error);
      throw new Error('Erreur lors du décodage du token JWT.');
    }
  }

  private getStorage(key: string): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(key);
  }

  private setStorage(key: string, value: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, value);
  }

  private removeStorage(key: string): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(key);
  }


}
