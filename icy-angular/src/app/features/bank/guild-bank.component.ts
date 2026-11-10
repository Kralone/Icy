import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import {
  BankDetails, BankEntry, BankEntryKind, BankOverview, BankProject, BankProjectStatus, ENTRY_KIND_LABELS, GuildBankService, PROJECT_STATUS_LABELS
} from '../../core/services/bank/guild-bank.service';
import { formatAuec, serverMessage } from '../../core/services/mining/mining-session.service';
import { ShipService } from '../../core/services/ship/ship.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { AsyncStateComponent } from '../../shared/async-state/async-state.component';
import { OperationIconComponent } from '../operations/briefing/operation-icon.component';
import { SearchOption, SearchSelectComponent } from '../utils/mining-sessions/search-select.component';
import { CurvePoint, balanceChart, compactAuec, dayLabel, monthBars, nearestPoint, parseAmount, todayIso, variation } from './bank-charts';

type DetailTab = 'journal' | 'players';
type Period = 'all' | '30' | '90' | '365';

interface EntryForm { kind: BankEntryKind; amount: string; userId: string | null; projectId: string | null; note: string; occurredOn: string; }
interface ProjectForm { id: string | null; name: string; description: string; target: string; shipId: number | null; status: BankProjectStatus; }

/**
 * Banque : le registre de l'argent que le trésorier garde en jeu.
 * Tout membre voit le solde, les graphiques et les projets ; le détail et la saisie dépendent des droits renvoyés par le serveur.
 * La page se relit à chaque signal « la banque a changé » ; l'abonnement se ferme quand on quitte la page.
 */
@Component({
  selector: 'app-guild-bank',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, AsyncStateComponent, OperationIconComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeDialogs()' },
  templateUrl: './guild-bank.component.html',
  styleUrls: ['../utils/mining-sessions/mining-session-shared.css', './guild-bank.component.css']
})
export class GuildBankComponent {
  private readonly bank = inject(GuildBankService);
  private readonly shipService = inject(ShipService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kindLabels = ENTRY_KIND_LABELS;
  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly formatAuec = formatAuec;
  readonly compactAuec = compactAuec;
  readonly dayLabel = dayLabel;
  readonly kinds: BankEntryKind[] = ['DEPOSIT', 'EXPENSE', 'PAYOUT', 'ADJUSTMENT'];

  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly overview = signal<BankOverview | null>(null);
  readonly details = signal<BankDetails | null>(null);
  /** Moment du dernier rafraîchissement venu du serveur : fait clignoter le solde. */
  readonly pulse = signal(0);
  readonly today = signal(todayIso());

  readonly access = computed(() => this.overview()?.access ?? { details: false, write: false });
  readonly totals = computed(() => this.overview()?.totals);
  readonly chart = computed(() => balanceChart(this.overview()?.balanceCurve ?? [], this.today()));
  readonly bars = computed(() => monthBars(this.overview()?.months ?? []));
  readonly change30 = computed(() => variation(this.overview()?.balanceCurve ?? [], this.today(), 30));
  readonly openProjects = computed(() => (this.overview()?.projects ?? []).filter(project => project.status === 'OPEN'));
  readonly closedProjects = computed(() => (this.overview()?.projects ?? []).filter(project => project.status !== 'OPEN'));
  readonly hover = signal<CurvePoint | null>(null);
  readonly monthsInflow = computed(() => this.bars().reduce((sum, bar) => sum + bar.inflow, 0));
  readonly monthsOutflow = computed(() => this.bars().reduce((sum, bar) => sum + bar.outflow, 0));

  // ----- Détail (journal, joueurs) -----
  readonly tab = signal<DetailTab>('journal');
  readonly filterPlayer = signal<string | null>(null);
  readonly filterProject = signal<string>('');
  readonly filterKind = signal<string>('');
  readonly filterPeriod = signal<Period>('all');
  readonly showCancelled = signal(true);
  readonly journalPage = signal(0);
  readonly pageSize = 25;
  readonly filteredEntries = computed(() => {
    const entries = this.details()?.entries ?? [];
    const player = this.filterPlayer();
    const project = this.filterProject();
    const kind = this.filterKind();
    const period = this.filterPeriod();
    const since = period === 'all' ? '' : shiftIso(this.today(), -Number(period));
    return entries.filter(entry =>
      (!player || entry.userId === player) &&
      (!project || (project === 'none' ? !entry.projectId : entry.projectId === project)) &&
      (!kind || entry.kind === kind) &&
      (!since || entry.occurredOn >= since) &&
      (this.showCancelled() || !entry.cancelled));
  });
  readonly filteredSum = computed(() => this.filteredEntries().filter(entry => !entry.cancelled).reduce((sum, entry) => sum + entry.signedAmount, 0));
  readonly journalPages = computed(() => Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize)));
  readonly journalVisible = computed(() => this.filteredEntries().slice(this.journalPage() * this.pageSize, (this.journalPage() + 1) * this.pageSize));
  readonly playerFilterOptions = computed<SearchOption<string>[]>(() =>
    (this.details()?.players ?? []).map(player => ({ value: player.userId, label: player.userName })));
  readonly topGiven = computed(() => Math.max(1, ...(this.details()?.players ?? []).map(player => Math.max(player.given, player.received))));

  // ----- Saisie -----
  readonly entryDialog = signal(false);
  readonly projectDialog = signal(false);
  readonly cancelTarget = signal<BankEntry | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly memberOptions = signal<SearchOption<string>[]>([]);
  readonly shipOptions = signal<SearchOption<number>[]>([]);
  entryForm: EntryForm = this.emptyEntry('DEPOSIT');
  projectForm: ProjectForm = this.emptyProject();
  cancelReason = '';

  constructor() {
    this.load();
    inject(WebSocketService).watchGuildBank()
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(false));
  }

  load(showLoading = true): void {
    if (showLoading) this.state.set('loading');
    this.today.set(todayIso());
    this.bank.overview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: overview => {
        const previous = this.overview()?.totals.balance;
        this.overview.set(overview);
        this.state.set('ready');
        if (previous !== undefined && previous !== overview.totals.balance) this.pulse.update(value => value + 1);
        if (overview.access.details) this.loadDetails();
        else this.details.set(null);
      },
      error: () => { if (showLoading) this.state.set('error'); }
    });
  }

  private loadDetails(): void {
    this.bank.details().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: details => {
        this.details.set(details);
        if (this.journalPage() >= this.journalPages()) this.journalPage.set(0);
      },
      error: () => this.details.set(null)
    });
  }

  // ----- Graphique -----

  onChartMove(event: PointerEvent, svg: Element): void {
    const chart = this.chart();
    if (!chart) return;
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    this.hover.set(nearestPoint(chart.points, ((event.clientX - box.left) / box.width) * 1000));
  }

  statusLabel(status: BankProjectStatus): string {
    return this.statusLabels[status] ?? status;
  }

  progress(project: BankProject): number {
    if (!project.targetAmount) return 0;
    return Math.min(100, Math.round((project.collected / project.targetAmount) * 100));
  }

  playerWidth(value: number): number {
    return Math.max(value ? 1.5 : 0, (value / this.topGiven()) * 100);
  }

  setFilter(update: () => void): void {
    update();
    this.journalPage.set(0);
  }

  resetFilters(): void {
    this.filterPlayer.set(null);
    this.filterProject.set('');
    this.filterKind.set('');
    this.filterPeriod.set('all');
    this.showCancelled.set(true);
    this.journalPage.set(0);
  }

  showPlayer(userId: string): void {
    this.filterPlayer.set(userId);
    this.tab.set('journal');
    this.journalPage.set(0);
  }

  // ----- Mouvements -----

  openEntry(kind: BankEntryKind, projectId: string | null = null): void {
    this.entryForm = { ...this.emptyEntry(kind), projectId };
    this.formError.set('');
    this.entryDialog.set(true);
    this.loadMembers();
  }

  entryAmountPreview(): string {
    const amount = parseAmount(this.entryForm.amount);
    return amount === null ? '' : `${formatAuec(amount)} aUEC`;
  }

  saveEntry(): void {
    const amount = parseAmount(this.entryForm.amount);
    if (amount === null) { this.formError.set('Montant illisible : écrivez par exemple 250000, 250k ou 1,5M.'); return; }
    this.saving.set(true);
    this.formError.set('');
    const form = this.entryForm;
    const needsPlayer = form.kind === 'DEPOSIT' || form.kind === 'PAYOUT';
    this.bank.record({
      kind: form.kind, amount,
      userId: needsPlayer || form.kind === 'EXPENSE' ? form.userId : null,
      projectId: form.projectId || null,
      note: form.note.trim() || null,
      occurredOn: form.occurredOn || null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.entryDialog.set(false); this.load(false); },
      error: error => { this.saving.set(false); this.formError.set(serverMessage(error, 'Le mouvement n’a pas pu être enregistré.')); }
    });
  }

  askCancel(entry: BankEntry): void {
    this.cancelReason = '';
    this.formError.set('');
    this.cancelTarget.set(entry);
  }

  confirmCancel(): void {
    const entry = this.cancelTarget();
    if (!entry) return;
    if (!this.cancelReason.trim()) { this.formError.set('Indiquez le motif de l’annulation.'); return; }
    this.saving.set(true);
    this.bank.cancel(entry.id, this.cancelReason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.cancelTarget.set(null); this.load(false); },
      error: error => { this.saving.set(false); this.formError.set(serverMessage(error, 'L’annulation a échoué.')); }
    });
  }

  // ----- Projets -----

  openProject(project: BankProject | null = null): void {
    this.projectForm = project
      ? { id: project.id, name: project.name, description: project.description ?? '', target: project.targetAmount ? String(project.targetAmount) : '', shipId: project.shipId, status: project.status }
      : this.emptyProject();
    this.formError.set('');
    this.projectDialog.set(true);
    this.loadShips();
  }

  saveProject(): void {
    const form = this.projectForm;
    const target = form.target.trim() ? parseAmount(form.target) : null;
    if (form.target.trim() && (target === null || target <= 0)) { this.formError.set('Objectif illisible : écrivez par exemple 2M ou 2000000.'); return; }
    this.saving.set(true);
    this.formError.set('');
    const request = { name: form.name, description: form.description.trim() || null, targetAmount: target, shipId: form.shipId, status: form.status };
    const call = form.id ? this.bank.updateProject(form.id, request) : this.bank.createProject(request);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.projectDialog.set(false); this.load(false); },
      error: error => { this.saving.set(false); this.formError.set(serverMessage(error, 'Le projet n’a pas pu être enregistré.')); }
    });
  }

  closeDialogs(): void {
    if (this.saving()) return;
    this.entryDialog.set(false);
    this.projectDialog.set(false);
    this.cancelTarget.set(null);
  }

  private loadMembers(): void {
    if (this.memberOptions().length) return;
    this.bank.members().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: members => this.memberOptions.set(members.map(member => ({ value: member.id, label: member.name })))
    });
  }

  private loadShips(): void {
    if (this.shipOptions().length) return;
    this.shipService.getAllShips().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => this.shipOptions.set((response?.data ?? [])
        .map(ship => ({ value: ship.id, label: ship.name, detail: ship.brand?.name ?? null }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')))
    });
  }

  private emptyEntry(kind: BankEntryKind): EntryForm {
    return { kind, amount: '', userId: null, projectId: null, note: '', occurredOn: todayIso() };
  }

  private emptyProject(): ProjectForm {
    return { id: null, name: '', description: '', target: '', shipId: null, status: 'OPEN' };
  }
}

function shiftIso(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
