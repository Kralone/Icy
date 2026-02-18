import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { ExecutiveHangarApiService } from '../../../core/services/utils/executive-hangar-api.service';

type HangarStatus = 'ONLINE' | 'OFFLINE';
type CircleColor = 'green' | 'red' | 'empty';

type Threshold = {
  min: number;
  max: number;
  colors: CircleColor[];
};

type ScheduleRow = {
  status: 'En ligne' | 'Hors ligne';
  statusClass: 'status-online' | 'status-offline';
  time: Date;
};

@Component({
  standalone: true,
  selector: 'app-executive-hangar',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './executive-hangar.component.html',
  styleUrl: './executive-hangar.component.css'
})
export class ExecutiveHangarComponent implements OnInit, OnDestroy {
  private readonly defaultInitialOpenIso = '2026-02-01T17:09:54.775-05:00';

  readonly openDuration = 3900338;
  readonly closeDuration = 7200623;
  readonly cycleDuration = this.openDuration + this.closeDuration;
  // From backend: this is the next time the hangar goes ONLINE (anchor for all cycles).
  nextOnlineAt = new Date(this.defaultInitialOpenIso);

  status: HangarStatus = 'OFFLINE';
  countdown = '00:00';
  nextChangeAt: Date = new Date();
  circles: CircleColor[] = ['empty', 'empty', 'empty', 'empty', 'empty'];
  scheduleRows: ScheduleRow[] = [];
  canManageTiming = false;
  showTimingModal = false;
  timingInput = '';
  timingError = '';
  configError = '';

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  private readonly thresholds: Threshold[] = [
    { min: 0, max: 12 * 60 * 1000, colors: ['green', 'green', 'green', 'green', 'green'] },
    { min: 12 * 60 * 1000, max: 24 * 60 * 1000, colors: ['green', 'green', 'green', 'green', 'empty'] },
    { min: 24 * 60 * 1000, max: 36 * 60 * 1000, colors: ['green', 'green', 'green', 'empty', 'empty'] },
    { min: 36 * 60 * 1000, max: 48 * 60 * 1000, colors: ['green', 'green', 'empty', 'empty', 'empty'] },
    { min: 48 * 60 * 1000, max: 60 * 60 * 1000, colors: ['green', 'empty', 'empty', 'empty', 'empty'] },
    { min: 60 * 60 * 1000, max: 65 * 60 * 1000, colors: ['empty', 'empty', 'empty', 'empty', 'empty'] },
    { min: 65 * 60 * 1000, max: 89 * 60 * 1000, colors: ['red', 'red', 'red', 'red', 'red'] },
    { min: 89 * 60 * 1000, max: 113 * 60 * 1000, colors: ['green', 'red', 'red', 'red', 'red'] },
    { min: 113 * 60 * 1000, max: 137 * 60 * 1000, colors: ['green', 'green', 'red', 'red', 'red'] },
    { min: 137 * 60 * 1000, max: 161 * 60 * 1000, colors: ['green', 'green', 'green', 'red', 'red'] },
    { min: 161 * 60 * 1000, max: 185 * 60 * 1000, colors: ['green', 'green', 'green', 'green', 'red'] }
  ];

  constructor(
    private userService: UserService,
    private executiveHangarApiService: ExecutiveHangarApiService
  ) {}

  ngOnInit(): void {
    this.loadPermissions();
    this.loadConfigAndStart();
  }

  ngOnDestroy(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  get isOnline(): boolean {
    return this.status === 'ONLINE';
  }

  get statusLabelFr(): string {
    return this.isOnline ? 'EN LIGNE' : 'HORS LIGNE';
  }

  openTimingModal(): void {
    if (!this.canManageTiming) return;
    const nextOnlineAt = this.computeNextOnlineAt(new Date());
    this.timingInput = this.toDateTimeLocal(nextOnlineAt);
    this.timingError = '';
    this.showTimingModal = true;
  }

  closeTimingModal(): void {
    this.showTimingModal = false;
    this.timingError = '';
  }

  saveNextOnlineTiming(): void {
    if (!this.canManageTiming) return;

    const target = this.parseDateTimeLocal(this.timingInput);
    if (!target) {
      this.timingError = 'Date/heure invalide.';
      return;
    }

    const now = new Date();
    if (target.getTime() <= now.getTime()) {
      this.timingError = 'La date doit etre dans le futur.';
      return;
    }

    this.executiveHangarApiService.setNextOnline(target.toISOString()).subscribe({
      next: (response) => {
        const apiInitialOpenTime = response?.data?.initialOpenTime;
        if (apiInitialOpenTime) {
          this.nextOnlineAt = new Date(apiInitialOpenTime);
          this.refreshState();
          this.scheduleRows = this.buildScheduleRows();
        }
        this.closeTimingModal();
      },
      error: () => {
        this.timingError = 'Impossible de sauvegarder le prochain cycle.';
      }
    });
  }

  resetTimingToDefault(): void {
    if (!this.canManageTiming) return;
    this.executiveHangarApiService.resetConfig().subscribe({
      next: (response) => {
        const apiInitialOpenTime = response?.data?.initialOpenTime;
        this.nextOnlineAt = new Date(apiInitialOpenTime ?? this.defaultInitialOpenIso);
        this.refreshState();
        this.scheduleRows = this.buildScheduleRows();
        this.closeTimingModal();
      },
      error: () => {
        this.timingError = 'Impossible de reinitialiser la configuration.';
      }
    });
  }

  private onTick(): void {
    const previousStatus = this.status;
    this.refreshState();
    if (previousStatus !== this.status) {
      this.scheduleRows = this.buildScheduleRows();
    }
  }

  private loadPermissions(): void {
    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.canManageTiming = roles.includes('ADMIN') || roles.includes('OFFICIER');
      },
      error: () => {
        this.canManageTiming = false;
      }
    });
  }

  private loadConfigAndStart(): void {
    this.executiveHangarApiService.getConfig().subscribe({
      next: (response) => {
        const apiInitialOpenTime = response?.data?.initialOpenTime;
        this.nextOnlineAt = new Date(apiInitialOpenTime ?? this.defaultInitialOpenIso);
        this.bootstrapTicker();
      },
      error: () => {
        this.configError = 'Configuration backend indisponible, fallback local actif.';
        this.nextOnlineAt = new Date(this.defaultInitialOpenIso);
        this.bootstrapTicker();
      }
    });
  }

  private bootstrapTicker(): void {
    this.refreshState();
    this.scheduleRows = this.buildScheduleRows();
    this.tickTimer = setInterval(() => this.onTick(), 1000);
  }

  private refreshState(): void {
    const now = new Date();
    const current = this.getCurrentState(now);

    this.status = current.status;
    this.nextChangeAt = current.nextChangeAt;
    this.countdown = this.formatCountdown(Math.max(0, this.nextChangeAt.getTime() - now.getTime()));
    this.circles = current.waitingForNextOnline ? ['empty', 'empty', 'empty', 'empty', 'empty'] : this.getCircleColors(current.timeInCycle);
  }

  private getCurrentState(currentTime: Date): {
    status: HangarStatus;
    nextChangeAt: Date;
    timeInCycle: number;
    waitingForNextOnline: boolean;
  } {
    // Before the configured next-online anchor, keep OFFLINE and count down to it.
    if (currentTime.getTime() < this.nextOnlineAt.getTime()) {
      return {
        status: 'OFFLINE',
        nextChangeAt: this.nextOnlineAt,
        timeInCycle: 0,
        waitingForNextOnline: true
      };
    }

    const elapsed = currentTime.getTime() - this.nextOnlineAt.getTime();
    const timeInCycle = this.toPositiveModulo(elapsed, this.cycleDuration);

    if (timeInCycle < this.openDuration) {
      return {
        status: 'ONLINE',
        nextChangeAt: new Date(currentTime.getTime() + (this.openDuration - timeInCycle)),
        timeInCycle,
        waitingForNextOnline: false
      };
    }

    const closeProgress = timeInCycle - this.openDuration;
    return {
      status: 'OFFLINE',
      nextChangeAt: new Date(currentTime.getTime() + (this.closeDuration - closeProgress)),
      timeInCycle,
      waitingForNextOnline: false
    };
  }

  private getCircleColors(timeInCycle: number): CircleColor[] {
    const found = this.thresholds.find((threshold) => timeInCycle >= threshold.min && timeInCycle < threshold.max);
    return found?.colors ?? ['empty', 'empty', 'empty', 'empty', 'empty'];
  }

  private buildScheduleRows(): ScheduleRow[] {
    const now = new Date();
    const state = this.getCurrentState(now);
    const rows: ScheduleRow[] = [];

    let eventTime = state.nextChangeAt.getTime();
    let nextStatus: HangarStatus = state.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';

    while (rows.length < 10) {
      rows.push({
        status: nextStatus === 'ONLINE' ? 'En ligne' : 'Hors ligne',
        statusClass: nextStatus === 'ONLINE' ? 'status-online' : 'status-offline',
        time: new Date(eventTime)
      });

      eventTime += nextStatus === 'ONLINE' ? this.openDuration : this.closeDuration;
      nextStatus = nextStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    }

    return rows;
  }

  private computeNextOnlineAt(now: Date): Date {
    if (now.getTime() < this.nextOnlineAt.getTime()) {
      return this.nextOnlineAt;
    }
    const elapsed = now.getTime() - this.nextOnlineAt.getTime();
    const cyclesCompleted = Math.floor(elapsed / this.cycleDuration);
    return new Date(this.nextOnlineAt.getTime() + (cyclesCompleted + 1) * this.cycleDuration);
  }

  private toDateTimeLocal(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private parseDateTimeLocal(value: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toPositiveModulo(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
  }

  private formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
