import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserService } from '../../core/services/user/user.service';

const resolveRequiredRoles = (route: { data?: Record<string, unknown>; parent?: any }): string[] => {
  const direct = route.data?.['roles'] as string[] | undefined;
  if (direct?.length) return direct;
  if (route.parent) return resolveRequiredRoles(route.parent);
  return [];
};

export const roleGuard: CanActivateFn & CanActivateChildFn = (route, state) => {
  const requiredRoles = resolveRequiredRoles(route);
  if (requiredRoles.length === 0) return true;

  const userService = inject(UserService);
  const router = inject(Router);

  return userService.getMyProfile().pipe(
    map((response) => {
      const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').trim().toUpperCase());
      const allowed = requiredRoles
        .map((role) => role.trim().toUpperCase())
        .some((role) => roles.includes(role));
      return allowed ? true : router.createUrlTree(['/icy']);
    }),
    catchError(() => of(router.createUrlTree(['/icy'])))
  );
};
