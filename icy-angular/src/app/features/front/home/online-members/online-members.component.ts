import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserOnline } from '../../../../model/user-online.model';
import { UserStatusKey } from '../../../../model/user-profile.model';
import { Subject, fromEvent, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiResponse } from '../../../../model/api-response.model';
import { GuidesComponent } from '../guides/guides.component';

interface StatusStyle {
  label: string;
  badgeClass: string;
}

interface FrontRecentEvent {
  id: string;
  title: string;
  endDateTime?: string | null;
  type?: {
    name?: string;
    imageUrl?: string | null;
  } | null;
}

interface FrontMember {
  id: string;
  username: string;
  status: UserStatusKey;
  avatarUrl?: string | null;
}

@Component({
  selector: 'front-online-members',
  standalone: true,
  imports: [CommonModule, GuidesComponent],
  templateUrl: './online-members.component.html',
  styleUrl: './online-members.component.css'
})
export class OnlineMembersComponent implements OnInit, OnDestroy {
  totalMembers: number | null = null;
  allMembers: FrontMember[] = [];
  onlineCount = 0;
  recentEvents: FrontRecentEvent[] = [];
  currentPage = 1;
  membersPerPage = 12;
  isLoading = true;
  private recentEventsLoaded = false;
  private recentEventsTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly destroy$ = new Subject<void>();

  readonly statusStyles: Record<UserStatusKey, StatusStyle> = {
    connecte: { label: 'Connecte', badgeClass: 'front-online__badge--connecte' },
    enjeu: { label: 'En jeu', badgeClass: 'front-online__badge--enjeu' },
    absent: { label: 'Absent', badgeClass: 'front-online__badge--absent' },
    indisponible: { label: 'Indisponible', badgeClass: 'front-online__badge--indisponible' },
    horsligne: { label: 'Hors ligne', badgeClass: 'front-online__badge--horsligne' }
  };

  constructor(
    private readonly http: HttpClient,
    private readonly ngZone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.updateMembersPerPageByViewport();
    this.loadSnapshot();
    this.ngZone.runOutsideAngular(() => {
      fromEvent(window, 'resize')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.ngZone.run(() => this.updateMembersPerPageByViewport()));

      interval(60000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.ngZone.run(() => this.loadSnapshot()));
    });
  }

  ngOnDestroy(): void {
    if (this.recentEventsTimer) {
      clearTimeout(this.recentEventsTimer);
      this.recentEventsTimer = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSnapshot(): void {
    this.isLoading = true;
    this.http.get<ApiResponse<UserOnline[]>>('/api/front/members').subscribe({
      next: (response) => {
        const members = response.data ?? [];
        this.totalMembers = members.length;
        this.allMembers = this.mapMembers(members);
        this.currentPage = 1;
        this.onlineCount = this.allMembers.filter(member => this.isActiveStatus(member.status)).length;
        this.scheduleRecentEventsLoad();
      },
      error: () => {
        this.onlineCount = 0;
        this.totalMembers = null;
        this.allMembers = [];
        this.currentPage = 1;
        this.recentEvents = [];
        this.isLoading = false;
      }
    });
  }

  private scheduleRecentEventsLoad(): void {
    if (this.recentEventsLoaded) {
      this.isLoading = false;
      return;
    }

    const run = () => {
      this.recentEventsLoaded = true;
      this.loadRecentEvents();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
      return;
    }

    this.recentEventsTimer = setTimeout(run, 500);
  }

  private loadRecentEvents(): void {
    this.http.get<ApiResponse<FrontRecentEvent[]>>('/api/front/recent-events').subscribe({
      next: (response) => {
        this.recentEvents = (response.data ?? []).slice(0, 3);
        this.isLoading = false;
      },
      error: () => {
        this.recentEvents = [];
        this.isLoading = false;
      }
    });
  }

  private mapMembers(users: UserOnline[]): FrontMember[] {
    return users
      .map((user) => ({
        id: user.id,
        username: user.username,
        status: this.normalizeStatus(user.status),
        avatarUrl: user.avatarUrl ?? null
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  private normalizeStatus(status?: string | null): UserStatusKey {
    if (status === 'connecte' || status === 'enjeu' || status === 'absent' || status === 'indisponible') {
      return status;
    }
    return 'horsligne';
  }

  private isActiveStatus(status: UserStatusKey): boolean {
    return status === 'connecte' || status === 'enjeu' || status === 'indisponible';
  }

  formatEventDate(value?: string | null): string {
    if (!value) return 'Date inconnue';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Date inconnue';
    return parsed.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  get paginatedMembers(): FrontMember[] {
    const start = (this.currentPage - 1) * this.membersPerPage;
    return this.allMembers.slice(start, start + this.membersPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.allMembers.length / Math.max(1, this.membersPerPage)));
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  private updateMembersPerPageByViewport(): void {
    this.membersPerPage = 6;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

}
