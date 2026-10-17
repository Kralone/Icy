import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MiningSessionService, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { UserService } from '../../../core/services/user/user.service';
import { User } from '../../../model/user.model';

interface MemberForm { userId: string; username: string; parts: string; }

/** Participants et parts, réservés à l'organisateur. Une part se saisit en parts : 1, 0,5, 0 pour exclure. */
@Component({
  selector: 'app-participants-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="participants-title">
        <h2 id="participants-title">Participants et parts</h2>
        <p class="note">Chacun a 1 part. Une demi-part vaut 0,5 ; 0 exclut du partage tout en remboursant les frais avancés.</p>
        <div class="rows">
          @for (member of members; track member.userId; let i = $index) {
            <div class="row member">
              <b>{{ member.username }}</b>
              <span class="member__parts">
                <input [name]="'parts' + i" inputmode="decimal" [(ngModel)]="member.parts" [attr.aria-label]="'Parts de ' + member.username">
                <button type="button" class="btn small" (click)="members.splice(i, 1)" [attr.aria-label]="'Retirer ' + member.username">Retirer</button>
              </span>
            </div>
          }
        </div>
        <label class="field">Ajouter un membre<input name="search" [(ngModel)]="search" autocomplete="off" placeholder="Rechercher un membre"></label>
        @if (search) {
          <div class="matches">
            @for (user of matches(); track user.id) { <button type="button" class="btn small" (click)="add(user)">+ {{ user.username }}</button> } @empty { <small class="muted">Aucun membre trouvé.</small> }
          </div>
        }
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .member { align-items: center; }
    .member__parts { display: inline-flex; gap: .4rem; align-items: center; }
    .member__parts input { width: 5rem; padding: .4rem .5rem; border: 1px solid var(--line-strong); border-radius: .4rem; color: var(--fg); background: var(--field); font: inherit; text-align: right; }
    .matches { display: flex; flex-wrap: wrap; gap: .35rem; }
  `]
})
export class ParticipantsDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly users = signal<User[]>([]);
  members: MemberForm[] = [];
  search = '';

  ngOnInit(): void {
    this.members = this.sheet().participants.map(p => ({ userId: p.user.id, username: p.user.username, parts: (p.sharesCenti / 100).toLocaleString('fr-FR') }));
    this.userService.getAllUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: response => this.users.set((response?.data ?? []).filter(user => user.active !== false)) });
  }

  matches(): User[] {
    const query = this.normalize(this.search);
    const chosen = new Set(this.members.map(member => member.userId));
    return this.users().filter(user => !chosen.has(user.id) && this.normalize(user.username).includes(query)).slice(0, 8);
  }

  add(user: User): void {
    this.members.push({ userId: user.id, username: user.username, parts: '1' });
    this.search = '';
  }

  save(): void {
    const participants = [];
    for (const member of this.members) {
      const value = Number(String(member.parts).replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || value > 100) { this.error.set(`Parts invalides pour ${member.username} : de 0 à 100.`); return; }
      participants.push({ userId: member.userId, sharesCenti: Math.round(value * 100) });
    }
    this.busy.set(true);
    this.error.set('');
    this.sessions.setParticipants(this.sheet().id, participants).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.saved.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'Les participants n’ont pas pu être enregistrés.')); }
    });
  }

  private normalize(value: string): string {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
