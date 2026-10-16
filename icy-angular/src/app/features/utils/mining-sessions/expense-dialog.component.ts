import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ExpenseKind, MiningSessionService, SessionExpense, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { parseAmount } from './session-input';

export const EXPENSE_KINDS: { value: ExpenseKind; label: string }[] = [
  { value: 'FUEL', label: 'Carburant' },
  { value: 'REPAIR', label: 'Réparation' },
  { value: 'MATERIAL', label: 'Matériel' },
  { value: 'OTHER', label: 'Autre' }
];

/** Frais avancé hors raffinage : le coût d'un ordre se saisit sur l'ordre. */
@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--s-costs)" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="expense-title">
        <h2 id="expense-title">{{ expense() ? 'Modifier un frais' : 'Ajouter un frais' }}</h2>
        <div class="fields">
          <label class="field">Type
            <select name="kind" [(ngModel)]="form.kind">@for (kind of kinds; track kind.value) { <option [ngValue]="kind.value">{{ kind.label }}</option> }</select>
          </label>
          <label class="field">Montant payé (aUEC)<input name="amount" class="big" inputmode="numeric" autocomplete="off" [(ngModel)]="form.amount" placeholder="8 400" required></label>
          @if (sheet().permissions.organizer) {
            <label class="field">Payé par
              <select name="payer" [(ngModel)]="form.payer">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
            </label>
          }
        </div>
        <label class="field">Note (facultatif)<input name="note" [(ngModel)]="form.note" maxlength="200" placeholder="Plein du Prospector"></label>
        <p class="note">Ce frais vous est remboursé avant le partage.</p>
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          @if (expense()) { <button type="button" class="btn danger" [disabled]="busy()" (click)="remove()">Supprimer</button> }
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  `
})
export class ExpenseDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly expense = input<SessionExpense | null>(null);
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly kinds = EXPENSE_KINDS;
  readonly busy = signal(false);
  readonly error = signal('');
  form = { kind: 'FUEL' as ExpenseKind, amount: '', note: '', payer: '' };

  ngOnInit(): void {
    const expense = this.expense();
    this.form = expense
      ? { kind: expense.kind, amount: String(expense.amount), note: expense.note ?? '', payer: expense.payer.id }
      : { kind: 'FUEL', amount: '', note: '', payer: this.sheet().permissions.currentUserId };
  }

  save(): void {
    const amount = parseAmount(this.form.amount);
    if (!amount) { this.error.set('Indiquez un montant supérieur à zéro.'); return; }
    const payload = { kind: this.form.kind, amount, note: this.form.note.trim() || null, payerUserId: this.sheet().permissions.organizer ? this.form.payer : null };
    const expense = this.expense();
    const request = expense ? this.sessions.updateExpense(this.sheet().id, expense.id, payload) : this.sessions.addExpense(this.sheet().id, payload);
    this.run(request);
  }

  remove(): void {
    const expense = this.expense();
    if (expense) this.run(this.sessions.deleteExpense(this.sheet().id, expense.id));
  }

  private run(request: ReturnType<MiningSessionService['addExpense']>): void {
    this.busy.set(true);
    this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.saved.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'Le frais n’a pas pu être enregistré.')); }
    });
  }
}
