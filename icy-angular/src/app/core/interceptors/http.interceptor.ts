import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth/auth.service';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class HttpAuthInterceptor implements HttpInterceptor {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private refreshInFlight$?: Observable<{ accessToken: string, refreshToken: string }>;

  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Routes à exclure de l'ajout automatique du token
    const excludedPaths = [
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/reset-password'
    ];

    const isExcluded = excludedPaths.some(path => request.url.includes(path));

    // Ne pas ajouter le token pour les routes exclues
    if (isExcluded) {
      return next.handle(request);
    }

    const token = this.isBrowser ? localStorage.getItem('token') : null;

    const authReq = token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          return this.refreshTokensOnce().pipe(
            switchMap(res => {
              if (this.isBrowser) {
                localStorage.setItem('token', res.accessToken);
                localStorage.setItem('refreshToken', res.refreshToken);
              }
              const retryReq = request.clone({
                setHeaders: { Authorization: `Bearer ${res.accessToken}` }
              });

              return next.handle(retryReq);
            }),
            catchError(err => {
              this.authService.logout();
              this.router.navigate(['/login']);
              return throwError(() => err);
            })
          );
        }

        return throwError(() => error);
      })
    );
  }

  private refreshTokensOnce(): Observable<{ accessToken: string, refreshToken: string }> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.authService.refreshToken().pipe(
        finalize(() => this.refreshInFlight$ = undefined),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.refreshInFlight$;
  }
}
