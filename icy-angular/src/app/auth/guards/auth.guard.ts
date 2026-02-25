import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

const redirectToLogin = (router: Router, stateUrl: string) =>
  router.createUrlTree(['/login'], { queryParams: { returnUrl: stateUrl || '/icy/dashboard' } });

export const authGuard: CanActivateFn & CanActivateChildFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const targetUrl = state?.url || '/icy/dashboard';

  if (!authService.hasToken()) {
    return redirectToLogin(router, targetUrl);
  }

  return authService.verifyToken().pipe(
    map((valid) => (valid ? true : redirectToLogin(router, targetUrl))),
    catchError(() => of(redirectToLogin(router, targetUrl)))
  );
};
