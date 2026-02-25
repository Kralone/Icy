import { Injectable, NgZone, inject, PLATFORM_ID } from '@angular/core';
import { fromEvent, interval, merge, Subject } from 'rxjs';
import { takeUntil, throttleTime } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class UserActivityService {
  private started = false;
  private lastActivityAt = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  start(): void {
    if (this.started) return;
    if (!this.isBrowser) return;
    this.started = true;
    this.recordActivity();
    this.flushActivity();

    this.ngZone.runOutsideAngular(() => {
      const activity$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'mousedown'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'scroll'),
        fromEvent(window, 'touchstart'),
        fromEvent(window, 'focus'),
        fromEvent(document, 'visibilitychange')
      ).pipe(throttleTime(1000));

      activity$.pipe(takeUntil(this.destroy$)).subscribe(() => this.recordActivity());
      interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => this.flushActivity());
    });
  }

  private recordActivity(): void {
    if (!this.isBrowser) return;
    if (document.visibilityState === 'hidden') return;
    this.lastActivityAt = Date.now();
  }

  private flushActivity(): void {
    if (!this.isBrowser) return;
    if (document.visibilityState === 'hidden' || !this.authService.hasToken()) return;
    const now = Date.now();
    if (now - this.lastActivityAt > 60000) return;

    this.userService.touchActivity().subscribe();
  }
}
