import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ExpenseKind, MiningSessionService, SessionExpense, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { OperationIconComponent, OperationIconName } from '../../operations/briefing/operation-icon.component';
import { groupDigits, parseAmount } from './session-input';

export interface CostKind { value: ExpenseKind | 'REFINING'; label: string; icon: OperationIconName; color: string; }

/** Types de frais : même couleur et même pictogramme dans la liste et dans la saisie. */
export const EXPENSE_KINDS: (CostKind & { value: ExpenseKind })[] = [
  { value: 'FUEL', label: 'Carburant', icon: 'fuel', color: '#fca5a5' },
  { value: 'REPAIR', label: 'Réparation', icon: 'wrench', color: '#93c5fd' },
  { value: 'MATERIAL', label: 'Matériel', icon: 'cargo', color: '#c4b5fd' },
  { value: 'OTHER', label: 'Autre', icon: 'dots', color: '#cbd5e1' }
];
/** Le coût d'un ordre de raffinage, affiché parmi les frais. */
export const REFINING_COST: CostKind = { value: 'REFINING', label: 'Raffinage', icon: 'flask', color: '#fdba74' };

/** Frais avancé hors raffinage : le coût d'un ordre se saisit sur l'ordre. */
@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [FormsModule, OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--s-costs)" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="expense-title">
        <h2 id="expense-title">{{ expense() ? 'Modifier un frais' : 'Ajouter un frais' }}</h2>
        <fieldset class="kinds">
          <legend>Type</legend>
          @for (kind of kinds; track kind.value) {
            <label class="kind-choice" [style.--k]="kind.color">
              <input type="radio" name="kind" [value]="kind.value" [(ngModel)]="form.kind">
              <app-operation-icon [name]="kind.icon" /> {{ kind.label }}
            </label>
          }
        </fieldset>
        <div class="fields">
          <label class="field">Montant payé (aUEC)<input name="amount" class="big" inputmode="numeric" autocomplete="off" [ngModel]="form.amount" (ngModelChange)="form.amount = group($event)" placeholder="8 400" required></label>
          @if (sheet().permissions.organizer) {
            <label class="field">Payé par
              <select name="payer" [(ngModel)]="form.payer">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
            </label>
          }
        </div>
        <label class="field">Note (facultatif)<input name="note" [(ngModel)]="form.note" maxlength="200" placeholder="Plein du Prospector"></label>
        <p class="note">{{ form.payer && form.payer !== sheet().permissions.currentUserId ? 'Remboursé à ce membre avant le partage.' : 'Ce frais vous est remboursé avant le partage.' }}</p>
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          @if (expense()) { <button type="button" class="btn danger" [disabled]="busy()" (click)="remove()">Supprimer</button> }
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .kinds { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); gap: .45rem; margin: 0; padding: 0; border: 0; }
    .kinds legend { margin-bottom: .3rem; padding: 0; color: var(--text); font-size: .88rem; }
    .kind-choice { position: relative; display: flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.75rem; padding: .45rem .6rem;
      border: 1px solid var(--line-strong); border-radius: .55rem; color: var(--soft); background: var(--field); font-size: .9rem; cursor: pointer;
      transition: border-color .12s, background-color .12s, color .12s; }
    .kind-choice input { position: absolute; opacity: 0; pointer-events: none; }
    .kind-choice app-operation-icon { color: var(--k); }
    .kind-choice:hover { border-color: var(--k); }
    .kind-choice:has(input:checked) { border-color: var(--k); color: #0b1220; background: var(--k); font-weight: 700; box-shadow: 0 0 0 3px color-mix(in srgb, var(--k) 25%, transparent); }
    .kind-choice:has(input:checked) app-operation-icon { color: #0b1220; }
    .kind-choice:has(input:focus-visible) { outline: 2px solid #72ddf7; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .kind-choice { transition: none; } }
  `]
})
export class ExpenseDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly expense = input<SessionExpense | null>(null);
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly kinds = EXPENSE_KINDS;
  readonly group = groupDigits;
  readonly busy = signal(false);
  readonly error = signal('');
  form = { kind: 'FUEL' as ExpenseKind, amount: '', note: '', payer: '' };

  ngOnInit(): void {
    const expense = this.expense();
    this.form = expense
      ? { kind: expense.kind, amount: groupDigits(expense.amount), note: expense.note ?? '', payer: expense.payer.id }
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
