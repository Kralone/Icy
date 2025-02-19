import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api/auth';
  private authStatus = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post<{ accessToken: string, refreshToken: string }>(
      `${this.apiUrl}/login`,
      { username, password }
    ).pipe(
      tap((res) => {
        this.setToken(res.accessToken);
        this.setRefreshToken(res.refreshToken);
        this.authStatus.next(true);
      })
    );
  }

  logout() {
    this.removeTokens();
    this.authStatus.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private setToken(token: string) {
    localStorage.setItem('accessToken', token);
  }

  private setRefreshToken(token: string) {
    localStorage.setItem('refreshToken', token);
  }

  private removeTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  isLoggedIn(): Observable<boolean> {
    return this.authStatus.asObservable();
  }
}
