import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class HttpAuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Routes à exclure de l'ajout automatique du token
    const excludedPaths = [
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/reset-password'
    ];

    const isExcluded = excludedPaths.some(path => request.url.includes(path));

    // Ne pas ajouter le token pour les routes exclues
    if (isExcluded) {
      return next.handle(request);
    }

    const token = localStorage.getItem('token');

    const authReq = token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          return this.authService.refreshToken().pipe(
            switchMap(res => {
              localStorage.setItem('token', res.tokens.accessToken);
              localStorage.setItem('refreshToken', res.tokens.refreshToken);

              const retryReq = request.clone({
                setHeaders: { Authorization: `Bearer ${res.tokens.accessToken}` }
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
}
