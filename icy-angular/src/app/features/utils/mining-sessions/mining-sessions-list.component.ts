import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MiningSessionService, SessionPhase, SessionSummary, formatAuec, serverMessage } from '../../../core/services/mining/mining-session.service';
import { UserService } from '../../../core/services/user/user.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';
import { User } from '../../../model/user.model';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';
import { OperationIconComponent } from '../../operations/briefing/operation-icon.component';

export const PHASE_LABELS: Record<SessionPhase, string> = {
  MINING: 'Minage',
  REFINING: 'Raffinage',
  HANDOVER: 'Remise du cargo',
  SELLING: 'Vente',
  PAYMENTS: 'Versements',
  DONE: 'Terminée'
};

/** Liste des fiches de minage : en cours d'abord, puis l'historique. */
@Component({
  selector: 'app-mining-sessions-list',
  standalone: true,
  imports: [FormsModule, RouterLink, AsyncStateComponent, OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'creating.set(false)' },
  templateUrl: './mining-sessions-list.component.html',
  styleUrls: ['./mining-session-shared.css', './mining-sessions-list.component.css']
})
export class MiningSessionsListComponent {
  private readonly sessions = inject(MiningSessionService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly sheets = signal<SessionSummary[]>([]);
  readonly users = signal<User[]>([]);
  readonly canCreate = signal(false);
  readonly active = computed(() => this.sheets().filter(sheet => sheet.status !== 'CLOSED'));
  readonly closed = computed(() => this.sheets().filter(sheet => sheet.status === 'CLOSED'));
  readonly historyPage = signal(0);
  readonly historyPageSize = 10;
  readonly historyVisible = computed(() => this.closed().slice(this.historyPage() * this.historyPageSize, (this.historyPage() + 1) * this.historyPageSize));
  readonly historyPages = computed(() => Math.max(1, Math.ceil(this.closed().length / this.historyPageSize)));

  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly createError = signal('');
  form = { name: '', date: new Date().toISOString().slice(0, 10), search: '', participantIds: [] as string[] };

  readonly phaseLabels = PHASE_LABELS;
  readonly formatAuec = formatAuec;
  private currentUserId = '';

  constructor() {
    try { this.currentUserId = this.authService.getUserIdFromToken(); } catch { this.currentUserId = ''; }
    this.load();
    inject(WebSocketService).watchMiningSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(false));
    this.userService.getMyProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        const roles = (response?.data?.roles ?? []).map(role => (role ?? '').toUpperCase());
        this.canCreate.set(roles.some(role => role === 'SPECIALISTE' || role === 'OFFICIER' || role === 'ADMIN'));
      },
      error: () => this.canCreate.set(false)
    });
  }

  load(showLoading = true): void {
    if (showLoading) this.state.set('loading');
    this.sessions.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheets => { this.sheets.set(sheets); this.state.set('ready'); },
      error: () => { if (showLoading) this.state.set('error'); }
    });
  }

  openCreate(): void {
    this.form = { name: '', date: new Date().toISOString().slice(0, 10), search: '', participantIds: this.currentUserId ? [this.currentUserId] : [] };
    this.createError.set('');
    this.creating.set(true);
    if (!this.users().length) {
      this.userService.getAllUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: response => this.users.set((response?.data ?? []).filter(user => user.active !== false)) });
    }
  }

  memberMatches(): User[] {
    const query = this.normalize(this.form.search);
    const chosen = new Set(this.form.participantIds);
    return this.users().filter(user => !chosen.has(user.id) && (!query || this.normalize(user.username).includes(query))).slice(0, 8);
  }

  chosenMembers(): User[] {
    const byId = new Map(this.users().map(user => [user.id, user]));
    return this.form.participantIds.map(id => byId.get(id) ?? ({ id, username: id === this.currentUserId ? 'Vous' : 'Membre' } as User));
  }

  addMember(user: User): void {
    this.form.participantIds = [...this.form.participantIds, user.id];
    this.form.search = '';
  }

  removeMember(id: string): void {
    this.form.participantIds = this.form.participantIds.filter(existing => existing !== id);
  }

  create(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.createError.set('');
    this.sessions.create({ name: this.form.name.trim() || null, sessionDate: this.form.date || null, participantIds: this.form.participantIds })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: sheet => { this.saving.set(false); this.creating.set(false); this.router.navigate(['/icy/outils/fiches-minage', sheet.id]); },
        error: error => { this.saving.set(false); this.createError.set(serverMessage(error, 'La fiche n’a pas pu être créée.')); }
      });
  }

  dateLabel(value: string): string {
    return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private normalize(value: string): string {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
