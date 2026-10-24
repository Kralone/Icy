import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import {
  MarketReference, MiningSessionService, RefineryOrder, SaleSuggestions, SessionExpense, SessionSale, SessionSheet, Transfer,
  formatAuec, formatScu, oreColor, serverMessage, sharesLabel
} from '../../../core/services/mining/mining-session.service';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';
import { OperationIconComponent } from '../../operations/briefing/operation-icon.component';
import { CostKind, EXPENSE_KINDS, ExpenseDialogComponent, REFINING_COST } from './expense-dialog.component';
import { HintComponent } from './hint.component';
import { ManageDialogComponent } from './manage-dialog.component';
import { STEPS, countdownLabel, hourLabel, mySituation, progress, stepState } from './mining-session-view';
import { OrderDialogComponent } from './order-dialog.component';
import { ParticipantsDialogComponent } from './participants-dialog.component';
import { SaleDialogComponent } from './sale-dialog.component';
import { SessionFlowComponent } from './session-flow.component';

type Dialog =
  | { kind: 'expense'; expense: SessionExpense | null }
  | { kind: 'order'; order: RefineryOrder | null }
  | { kind: 'sale'; sale: SessionSale | null }
  | { kind: 'participants' }
  | { kind: 'manage' };

/** Fiche d'une session de minage (docs/mining-v3/SPEC.md, « Écran »), dans le style des fiches d'opération. */
@Component({
  selector: 'app-mining-session-page',
  standalone: true,
  imports: [RouterLink, AsyncStateComponent, OperationIconComponent, HintComponent, SessionFlowComponent, ExpenseDialogComponent, OrderDialogComponent,
    SaleDialogComponent, ParticipantsDialogComponent, ManageDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mining-session-page.component.html',
  styleUrls: ['./mining-session-shared.css', './mining-session-page.component.css']
})
export class MiningSessionPageComponent {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly sheetId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly state = signal<'loading' | 'error' | 'missing' | 'ready'>('loading');
  readonly sheet = signal<SessionSheet | null>(null);
  readonly reference = signal<MarketReference | null>(null);
  readonly suggestions = signal<SaleSuggestions | null>(null);
  readonly dialog = signal<Dialog | null>(null);
  readonly actionError = signal('');
  readonly busy = signal(false);
  readonly openSpots = signal<ReadonlySet<number>>(new Set());
  /** Écart entre l'horloge du serveur et celle du navigateur : les comptes à rebours suivent le serveur. */
  private clockOffset = 0;
  readonly now = signal(Date.now());

  readonly steps = STEPS;
  private readonly kinds = new Map<string, CostKind>(EXPENSE_KINDS.map(kind => [kind.value, kind]));
  readonly auec = formatAuec;
  readonly scu = formatScu;
  readonly color = oreColor;
  readonly parts = sharesLabel;
  readonly hour = hourLabel;
  readonly heroImage = '/assets/images/home/activities/mining.jpg';

  readonly stepIndex = computed(() => STEPS.findIndex(step => step.phase === this.sheet()?.phase));
  readonly progress = computed(() => { const sheet = this.sheet(); return sheet ? progress(sheet, this.now()) : null; });
  readonly mine = computed(() => { const sheet = this.sheet(); return sheet ? mySituation(sheet) : null; });
  readonly costs = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return [];
    const orders = sheet.orders.filter(order => order.cost > 0).map(order => ({ kind: REFINING_COST, who: order.launcher.username, amount: order.cost, note: order.terminalLabel, expense: null as SessionExpense | null }));
    const expenses = sheet.expenses.map(expense => ({ kind: this.kinds.get(expense.kind) ?? { ...EXPENSE_KINDS[3], label: expense.kind }, who: expense.payer.username, amount: expense.amount, note: expense.note ?? '', expense }));
    return [...orders, ...expenses];
  });
  readonly lastFinish = computed(() => this.sheet()?.lastOrderFinishesAt ?? null);
  readonly locked = computed(() => this.sheet()?.status !== 'ACTIVE');
  readonly remainingTotal = computed(() => (this.sheet()?.remaining ?? []).reduce((sum, item) => sum + item.remainingCscu, 0));
  readonly keptLines = computed(() => (this.sheet()?.orders ?? []).flatMap(order => order.lines.filter(line => line.destination === 'KEEP').map(line => ({ order, line }))));
  readonly myStock = computed(() => {
    const sheet = this.sheet();
    return sheet?.stock.find(stock => stock.seller.id === sheet.permissions.currentUserId) ?? null;
  });

  constructor() {
    this.load();
    this.sessions.reference().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: reference => this.reference.set(reference),
      error: () => this.reference.set({ commodities: [], refineries: [], methods: [], saleTerminals: [], pricesFetchedAt: null })
    });
    if (this.sheetId) inject(WebSocketService).watchMiningSession(this.sheetId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(false));
    // Comptes à rebours des ordres : à la seconde.
    interval(1_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(Date.now() + this.clockOffset));
  }

  load(showLoading = true): void {
    if (!this.sheetId) { this.state.set('missing'); return; }
    if (showLoading) this.state.set('loading');
    this.sessions.get(this.sheetId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => this.apply(sheet),
      // Une fiche supprimée pendant qu'on la regarde devient introuvable, même lors d'une relecture silencieuse.
      error: error => {
        const missing = (error as { status?: number })?.status === 404;
        if (missing) { this.dialog.set(null); this.sheet.set(null); this.state.set('missing'); }
        else if (showLoading || !this.sheet()) this.state.set('error');
      }
    });
  }

  /** Une réponse d'écriture contient la fiche à jour : pas de relecture. */
  apply(sheet: SessionSheet): void {
    this.clockOffset = new Date(sheet.serverTime).getTime() - Date.now();
    this.now.set(Date.now() + this.clockOffset);
    const previous = this.sheet();
    this.sheet.set(sheet);
    this.state.set('ready');
    const remaining = sheet.remaining.some(item => item.remainingCscu > 0);
    const changed = !previous || JSON.stringify(previous.remaining) !== JSON.stringify(sheet.remaining);
    if (remaining && sheet.status === 'ACTIVE' && changed) {
      this.sessions.suggestions(sheet.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: suggestions => this.suggestions.set(suggestions), error: () => this.suggestions.set(null) });
    } else if (!remaining) {
      this.suggestions.set(null);
    }
  }

  deleted(): void {
    this.dialog.set(null);
    void this.router.navigate(['/icy/outils/fiches-minage']);
  }

  saved(sheet: SessionSheet): void {
    this.dialog.set(null);
    this.apply(sheet);
  }

  open(dialog: Dialog): void {
    this.actionError.set('');
    this.dialog.set(dialog);
  }

  // ----- Actions directes -----

  handOver(order: RefineryOrder): void {
    this.act(this.sessions.handOver(this.sheetId, order.id), 'La remise n’a pas pu être enregistrée.');
  }

  cancelHandOver(order: RefineryOrder): void {
    this.act(this.sessions.cancelHandOver(this.sheetId, order.id), 'La remise n’a pas pu être annulée.');
  }

  confirm(transfer: Transfer): void {
    if (transfer.id) this.act(this.sessions.confirmReceipt(this.sheetId, transfer.id), 'La confirmation n’a pas pu être enregistrée.');
  }

  withdraw(transfer: Transfer): void {
    if (transfer.id) this.act(this.sessions.withdrawReceipt(this.sheetId, transfer.id), 'La confirmation n’a pas pu être retirée.');
  }

  private act(request: ReturnType<MiningSessionService['settle']>, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.apply(sheet); },
      error: error => { this.busy.set(false); this.actionError.set(serverMessage(error, fallback)); }
    });
  }

  // ----- Affichage -----

  toggleSpots(commodityId: number): void {
    const next = new Set(this.openSpots());
    if (next.has(commodityId)) next.delete(commodityId); else next.add(commodityId);
    this.openSpots.set(next);
  }

  orderState(order: RefineryOrder): 'wait' | 'ready' | 'given' {
    if (order.handedOverAt) return 'given';
    return new Date(order.finishesAt).getTime() <= this.now() ? 'ready' : 'wait';
  }

  orderBadge(order: RefineryOrder): string {
    const state = this.orderState(order);
    if (state === 'given') return order.launcher.id === order.recipient.id ? 'Récupéré' : 'Remis au vendeur';
    if (state === 'ready') return order.launcher.id === order.recipient.id ? 'Prêt · à récupérer' : 'Prêt · à remettre';
    return 'En raffinage';
  }

  /** Temps restant affiché en direct (« 1:12:05 »), ou null une fois prêt. */
  orderCountdown(order: RefineryOrder): string | null {
    const left = new Date(order.finishesAt).getTime() - this.now();
    return left > 0 ? countdownLabel(left) : null;
  }

  stepClass(index: number): 'done' | 'now' | 'next' {
    const sheet = this.sheet();
    return sheet ? stepState(sheet, index) : 'next';
  }

  holders(commodityId: number): { name: string; inStock: number; awaiting: number }[] {
    return (this.sheet()?.stock ?? []).map(stock => {
      const line = stock.lines.find(item => item.commodityId === commodityId);
      return { name: stock.seller.username, inStock: line?.inStockCscu ?? 0, awaiting: line?.awaitingCscu ?? 0 };
    }).filter(entry => entry.inStock > 0 || entry.awaiting > 0);
  }

  points(commodityId: number) {
    return this.suggestions()?.commodities.find(item => item.commodityId === commodityId)?.points ?? [];
  }

  soldRatio(total: number, remaining: number): number {
    return total > 0 ? Math.round((1 - remaining / total) * 100) : 0;
  }

  dateLabel(value: string): string {
    return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  dateTimeLabel(value: string): string {
    const date = new Date(value);
    return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${hourLabel(value)}`;
  }

  refineries(sheet: SessionSheet): string {
    return [...new Set(sheet.orders.map(order => order.terminalLabel))].join(' · ');
  }

  historyLabel(action: string): string {
    return ({
      SETTLED: 'Comptes arrêtés', REOPENED_SETTLEMENT: 'Rouverte pour corriger une confirmation', REOPENED_ACTIVE: 'Rouverte pour correction',
      CLOSED: 'Terminée', FORCED_CLOSE: 'Clôture forcée', RECEIPT_CONFIRMED: 'Versement confirmé', RECEIPT_WITHDRAWN: 'Confirmation retirée'
    } as Record<string, string>)[action] ?? action;
  }

  canConfirm(transfer: Transfer): boolean {
    const sheet = this.sheet();
    return !!sheet && sheet.status === 'SETTLEMENT' && (transfer.to.id === sheet.permissions.currentUserId || sheet.permissions.organizer);
  }

  goTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly message = serverMessage;
}
