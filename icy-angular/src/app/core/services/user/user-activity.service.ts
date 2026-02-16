import { Injectable, NgZone } from '@angular/core';
import { fromEvent, interval, merge, Subject } from 'rxjs';
import { takeUntil, throttleTime } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class UserActivityService {
  private started = false;
  private lastActivityAt = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  start(): void {
    if (this.started) return;
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
    if (document.visibilityState === 'hidden') return;
    this.lastActivityAt = Date.now();
  }

  private flushActivity(): void {
    if (document.visibilityState === 'hidden' || !this.authService.hasToken()) return;
    const now = Date.now();
    if (now - this.lastActivityAt > 60000) return;

    this.userService.touchActivity().subscribe();
  }
}
