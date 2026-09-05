
import { Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { User } from '../../../model/user.model';
import { ExecutiveHangarApiService } from '../../../core/services/utils/executive-hangar-api.service';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import { utilityRouteFor } from '../utility-route-context';

type PlayerRow = {
  id: string;
  username: string;
  roles: string[];
  hasExecShip: boolean;
};

@Component({
  standalone: true,
  selector: 'app-executive-hangar-players',
  imports: [FormsModule, RouterLink],
  templateUrl: './executive-hangar-players.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './executive-hangar-players.component.css'
})
export class ExecutiveHangarPlayersComponent implements OnInit {
  private readonly switchAnimMs = 260;
  private readonly flipAnimMs = 560;
  private readonly leaveAnimMs = 320;
  private readonly holdBeforeMoveMs = 220;

  canManageExecShips = false;
  rows: PlayerRow[] = [];
  paginatedRows: PlayerRow[] = [];
  isLoading = false;
  errorMessage = '';
  currentPage = 1;
  pageSize = 10;
  private totalPagesValue = 1;
  @ViewChild('rowsBody') rowsBody?: ElementRef<HTMLElement>;

  private switchTargetState = new Map<string, boolean>();
  private rowLeavingIds = new Set<string>();
  private togglingIds = new Set<string>();

  constructor(
    private userService: UserService,
    private executiveHangarApiService: ExecutiveHangarApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  get statusLink(): string {
    return utilityRouteFor(this.router.url, 'executive-hangar');
  }

  ngOnInit(): void {
    this.loadPermissions();
    this.loadPlayers();
  }

  get totalPages(): number {
    return this.totalPagesValue;
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.rebuildDisplayRows();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.rebuildDisplayRows();
    }
  }

  async onToggleExecShip(row: PlayerRow, event: MouseEvent): Promise<void> {
    if (!this.canManageExecShips) {
      return;
    }
    if (this.togglingIds.has(row.id)) {
      return;
    }

    this.togglingIds.add(row.id);
    const toggledValue = !row.hasExecShip;
    this.switchTargetState.set(row.id, toggledValue);
    setTimeout(() => this.switchTargetState.delete(row.id), this.switchAnimMs);

    const button = event.currentTarget as HTMLElement | null;
    if (button) {
      this.spawnParticles(button, toggledValue ? '#86efac' : '#fca5a5');
    }

    const previewRows = this.rows.map((item) =>
      item.id === row.id ? { ...item, hasExecShip: toggledValue } : item
    );

    const willRemainVisible = this.getCurrentPageIds(previewRows).includes(row.id);

    if (!willRemainVisible) {
      await this.playRowLeaveAnimation(row.id);
      this.applyToggle(row.id, toggledValue);
      this.syncToggleWithApi(row.id, toggledValue);
      this.togglingIds.delete(row.id);
      return;
    }

    const beforeRects = this.captureVisibleRowRects();
    setTimeout(() => {
      this.applyToggle(row.id, toggledValue);
      this.syncToggleWithApi(row.id, toggledValue);
      requestAnimationFrame(() => this.playFlipAnimation(beforeRects));
    }, this.holdBeforeMoveMs);
    setTimeout(() => this.togglingIds.delete(row.id), this.flipAnimMs);
  }

  isSwitchToOn(id: string): boolean {
    return this.switchTargetState.get(id) === true;
  }

  isSwitchToOff(id: string): boolean {
    return this.switchTargetState.get(id) === false;
  }

  trackByRowId(_: number, row: PlayerRow): string {
    return row.id;
  }

  private loadPlayers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      users: this.userService.getAllUsers(),
      statuses: this.executiveHangarApiService.getPlayerStatuses(),
    }).subscribe({
      next: ({ users, statuses }) => {
        const usersData = users?.data ?? [];
        const statusMap = new Map((statuses?.data ?? []).map((entry) => [entry.userId, !!entry.hasExecShip]));
        this.rows = usersData.map((user) => this.toRow(user, statusMap));
        this.currentPage = 1;
        this.rebuildDisplayRows();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la liste des joueurs.';
        this.isLoading = false;
      }
    });
  }

  private loadPermissions(): void {
    if (!this.authService.hasToken()) {
      this.canManageExecShips = false;
      return;
    }

    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.canManageExecShips = roles.includes('ADMIN') || roles.includes('OFFICIER');
      },
      error: () => {
        this.canManageExecShips = false;
      }
    });
  }

  private getSortedRows(sourceRows: PlayerRow[]): PlayerRow[] {
    return [...sourceRows].sort((a, b) => {
      if (a.hasExecShip !== b.hasExecShip) {
        return a.hasExecShip ? 1 : -1;
      }
      return a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });
    });
  }

  private getCurrentPageIds(sourceRows: PlayerRow[]): string[] {
    const sorted = this.getSortedRows(sourceRows);
    const totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    const safePage = Math.min(this.currentPage, totalPages);
    const start = (safePage - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize).map((row) => row.id);
  }

  private toRow(user: User, statusMap: Map<string, boolean>): PlayerRow {
    return {
      id: user.id,
      username: user.username,
      roles: user.roles ?? [],
      hasExecShip: !!statusMap.get(user.id)
    };
  }

  private applyToggle(id: string, toggledValue: boolean): void {
    const row = this.rows.find((item) => item.id === id);
    if (!row) return;
    row.hasExecShip = toggledValue;
    this.rebuildDisplayRows();
  }

  private syncToggleWithApi(id: string, toggledValue: boolean): void {
    this.executiveHangarApiService.setPlayerStatus(id, toggledValue).subscribe({
      error: () => {
        this.applyToggle(id, !toggledValue);
        this.errorMessage = 'La synchronisation backend a echoue, changement annule.';
      }
    });
  }

  private captureVisibleRowRects(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    if (!this.rowsBody?.nativeElement) {
      return map;
    }

    const rowElements = this.rowsBody.nativeElement.querySelectorAll<HTMLElement>('tr[data-row-id]');
    rowElements.forEach((element) => {
      const rowId = element.dataset['rowId'];
      if (!rowId) return;
      map.set(rowId, element.getBoundingClientRect());
    });
    return map;
  }

  private playFlipAnimation(beforeRects: Map<string, DOMRect>): void {
    if (!this.rowsBody?.nativeElement) {
      return;
    }

    const rowElements = this.rowsBody.nativeElement.querySelectorAll<HTMLElement>('tr[data-row-id]');
    rowElements.forEach((element) => {
      const rowId = element.dataset['rowId'];
      if (!rowId) return;
      const before = beforeRects.get(rowId);
      if (!before) return;

      const after = element.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (Math.abs(deltaY) < 1) return;

      element.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: `translateY(${deltaY}px)`, offset: 0.32 },
          { transform: 'translateY(0)' }
        ],
        {
          duration: this.flipAnimMs,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      );
    });
  }

  private async playRowLeaveAnimation(rowId: string): Promise<void> {
    if (!this.rowsBody?.nativeElement) {
      return;
    }
    const element = this.rowsBody.nativeElement.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"]`);
    if (!element) {
      return;
    }

    this.rowLeavingIds.add(rowId);
    const animation = element.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 1, transform: 'translateY(0)', offset: 0.35 },
        { opacity: 0, transform: 'translateY(26px)' }
      ],
      {
        duration: this.leaveAnimMs + this.holdBeforeMoveMs,
        easing: 'ease-in'
      }
    );
    try {
      await animation.finished;
    } catch {
      // Ignore cancellation.
    }
    this.rowLeavingIds.delete(rowId);
  }

  private spawnParticles(button: HTMLElement, color: string): void {
    const rect = button.getBoundingClientRect();
    const burstContainer = document.createElement('span');
    burstContainer.style.position = 'fixed';
    burstContainer.style.left = `${rect.left + rect.width / 2}px`;
    burstContainer.style.top = `${rect.top + rect.height / 2}px`;
    burstContainer.style.width = '0';
    burstContainer.style.height = '0';
    burstContainer.style.pointerEvents = 'none';
    burstContainer.style.zIndex = '9999';
    document.body.appendChild(burstContainer);

    const count = 9;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.style.position = 'absolute';
      particle.style.left = '0';
      particle.style.top = '0';
      particle.style.width = '8px';
      particle.style.height = '8px';
      particle.style.borderRadius = '9999px';
      particle.style.background = color;
      particle.style.boxShadow = `0 0 12px ${color}`;
      burstContainer.appendChild(particle);

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
      const distance = 16 + Math.random() * 18;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      particle.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
          { transform: `translate(${x}px, ${y}px) scale(0.2)`, opacity: 0 }
        ],
        {
          duration: 520,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
        }
      );
    }

    setTimeout(() => {
      burstContainer.remove();
    }, 560);
  }

  private rebuildDisplayRows(): void {
    const sortedRows = this.getSortedRows(this.rows);
    this.totalPagesValue = Math.max(1, Math.ceil(sortedRows.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPagesValue);
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedRows = sortedRows.slice(start, start + this.pageSize);
  }
}
