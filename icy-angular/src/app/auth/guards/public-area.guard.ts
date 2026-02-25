import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

const toPrivateUrl = (url: string): string => {
  if (url === '/utilitaires' || url.startsWith('/utilitaires/')) {
    return `/icy${url}`;
  }
  return '/icy/dashboard';
};

export const publicAreaGuard: CanActivateFn & CanActivateChildFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasToken()) {
    return true;
  }

  const requestedUrl = state?.url || '/utilitaires';
  return router.createUrlTree([toPrivateUrl(requestedUrl)]);
};
