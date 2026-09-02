import { PLATFORM_ID } from '@angular/core';
import { HttpErrorResponse, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../services/auth/auth.service';
import { HttpAuthInterceptor } from './http.interceptor';

describe('HttpAuthInterceptor', () => {
  let interceptor: HttpAuthInterceptor;
  let authService: { refreshToken: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    authService = {
      refreshToken: vi.fn(),
      logout: vi.fn()
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        HttpAuthInterceptor,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
    interceptor = TestBed.inject(HttpAuthInterceptor);
  });

  it('returns a 403 without refreshing tokens or logging the user out', async () => {
    localStorage.setItem('token', 'still-valid-token');
    const forbidden = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
    const next: HttpHandler = { handle: vi.fn(() => throwError(() => forbidden)) };

    await expect(firstValueFrom(interceptor.intercept(new HttpRequest('GET', '/api/admin'), next)))
      .rejects.toBe(forbidden);

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('refreshes once and retries a request after a 401', async () => {
    localStorage.setItem('token', 'expired-token');
    authService.refreshToken.mockReturnValue(of({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    const next = {
      handle: vi.fn()
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })))
        .mockReturnValueOnce(of(new HttpResponse({ status: 200 })))
    } as HttpHandler;

    const response = await firstValueFrom(interceptor.intercept(new HttpRequest('GET', '/api/profile'), next));

    expect(response).toBeInstanceOf(HttpResponse);
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(next.handle).toHaveBeenCalledTimes(2);
    const retriedRequest = (next.handle as ReturnType<typeof vi.fn>).mock.calls[1][0] as HttpRequest<unknown>;
    expect(retriedRequest.headers.get('Authorization')).toBe('Bearer new-access');
    expect(localStorage.getItem('token')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });
});
