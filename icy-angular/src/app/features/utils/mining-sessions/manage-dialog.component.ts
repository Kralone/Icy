import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MiningSessionService, SessionSheet, formatAuec, serverMessage } from '../../../core/services/mining/mining-session.service';

export type ManageAction = 'settle' | 'close' | 'reopen' | 'rename';

/**
 * Actions de l'organisateur : renommer, arrêter les comptes, clôturer de force, rouvrir.
 * Chaque action dit ce qu'elle change avant d'être validée ; clôture et réouverture demandent un motif.
 */
@Component({
  selector: 'app-manage-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--gold)" (click)="$event.stopPropagation()" (ngSubmit)="confirm()" aria-labelledby="manage-title">
        <h2 id="manage-title">Gérer la fiche</h2>
        <div class="choices" role="radiogroup" aria-label="Action">
          @for (choice of choices(); track choice.value) {
            <label class="choice" [class.choice--on]="action === choice.value">
              <input type="radio" name="action" [value]="choice.value" [(ngModel)]="action"> <span><b>{{ choice.label }}</b><small>{{ choice.help }}</small></span>
            </label>
          }
        </div>
        @if (action === 'rename') {
          <div class="fields">
            <label class="field">Nom<input name="name" [(ngModel)]="name" maxlength="160" required></label>
            <label class="field">Date<input name="date" type="date" [(ngModel)]="date" required></label>
          </div>
        }
        @if (action === 'settle') {
          <p class="locked">Ventes {{ auec(sheet().share.totalSales) }} · frais {{ auec(sheet().share.totalExpenses) }} · net {{ auec(sheet().share.net) }} aUEC.
            Frais, ventes et parts seront figés ; chaque receveur confirmera ses versements.</p>
          @if (remainingScu() > 0) { <p class="alert">Il reste du minerai à vendre. Arrêtez les comptes seulement si ce reste ne sera pas vendu.</p> }
        }
        @if (action === 'reopen') {
          <div class="choices" role="radiogroup" aria-label="Rouvrir pour">
            @if (sheet().status === 'CLOSED') {
              <label class="choice" [class.choice--on]="target === 'SETTLEMENT'"><input type="radio" name="target" value="SETTLEMENT" [(ngModel)]="target"> <span><b>Corriger une confirmation</b><small>Les montants ne changent pas.</small></span></label>
            }
            <label class="choice" [class.choice--on]="target === 'ACTIVE'"><input type="radio" name="target" value="ACTIVE" [(ngModel)]="target"> <span><b>Corriger un frais, une vente ou une part</b><small>Les versements seront recalculés et les confirmations refaites. Le règlement actuel reste dans l’historique.</small></span></label>
          </div>
        }
        @if (action === 'close' || action === 'reopen') {
          <label class="field">Motif<textarea name="reason" rows="2" maxlength="500" [(ngModel)]="reason" required placeholder="Visible dans l’historique de la fiche"></textarea></label>
        }
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy() || !action">{{ busy() ? 'Enregistrement…' : confirmLabel() }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .choices { display: grid; gap: .45rem; }
    .choice { display: flex; gap: .6rem; align-items: start; padding: .6rem .7rem; border: 1px solid var(--line-strong); border-radius: .55rem; background: var(--panel-2); cursor: pointer; }
    .choice--on { border-color: var(--gold); }
    .choice span { display: grid; gap: .15rem; }
    .choice small { color: var(--muted); }
  `]
})
export class ManageDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  action: ManageAction | '' = '';
  target: 'SETTLEMENT' | 'ACTIVE' = 'ACTIVE';
  reason = '';
  name = '';
  date = '';
  readonly auec = formatAuec;

  ngOnInit(): void {
    const sheet = this.sheet();
    this.name = sheet.name;
    this.date = sheet.sessionDate;
    this.target = sheet.status === 'CLOSED' ? 'SETTLEMENT' : 'ACTIVE';
    this.action = sheet.status === 'ACTIVE' ? 'settle' : sheet.status === 'SETTLEMENT' ? 'close' : 'reopen';
  }

  choices(): { value: ManageAction; label: string; help: string }[] {
    const status = this.sheet().status;
    const list: { value: ManageAction; label: string; help: string }[] = [];
    if (status === 'ACTIVE') list.push({ value: 'settle', label: 'Arrêter les comptes', help: 'Fige le partage et la liste des versements.' });
    if (status === 'SETTLEMENT') list.push({ value: 'close', label: 'Clôturer sans toutes les confirmations', help: 'La fiche reste marquée « clôturée avec des versements non confirmés ».' });
    if (status !== 'ACTIVE') list.push({ value: 'reopen', label: 'Rouvrir la fiche', help: 'Pour corriger une erreur.' });
    list.push({ value: 'rename', label: 'Renommer ou changer la date', help: 'Sans effet sur les comptes.' });
    return list;
  }

  remainingScu(): number {
    return this.sheet().remaining.reduce((sum, item) => sum + item.remainingCscu, 0);
  }

  confirmLabel(): string {
    switch (this.action) {
      case 'settle': return 'Arrêter les comptes';
      case 'close': return 'Clôturer la fiche';
      case 'reopen': return 'Rouvrir la fiche';
      default: return 'Enregistrer';
    }
  }

  confirm(): void {
    const id = this.sheet().id;
    let request: Observable<SessionSheet>;
    if (this.action === 'settle') request = this.sessions.settle(id);
    else if (this.action === 'rename') request = this.sessions.update(id, { name: this.name.trim() || null, sessionDate: this.date || null });
    else {
      if (!this.reason.trim()) { this.error.set('Indiquez un motif.'); return; }
      request = this.action === 'close' ? this.sessions.forceClose(id, this.reason.trim()) : this.sessions.reopen(id, this.target, this.reason.trim());
    }
    this.busy.set(true);
    this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.saved.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'L’action n’a pas pu être enregistrée.')); }
    });
  }
}
