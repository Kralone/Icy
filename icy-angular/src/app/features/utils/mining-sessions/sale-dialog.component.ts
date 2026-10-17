import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MarketReference, MiningSessionService, RefineryOrder, SaleSuggestions, SessionSale, SessionSheet, formatAuec, formatScu, oreColor, serverMessage } from '../../../core/services/mining/mining-session.service';
import { groupDigits, parseAmount, parseScu, scuInput } from './session-input';

interface SaleLineForm { commodityId: number; name: string; availableCscu: number; scu: string; include: boolean; }

/**
 * Enregistrer une vente : seul le minerai remis au vendeur est proposé, au plus la quantité disponible.
 * Le montant saisi est celui réellement reçu en jeu ; l'estimation UEX n'est qu'un repère.
 */
@Component({
  selector: 'app-sale-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--s-sell)" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="sale-title">
        <h2 id="sale-title">{{ sale() ? 'Modifier la vente' : 'Enregistrer une vente' }}</h2>
        @if (current().permissions.organizer) {
          <label class="field">Vendeur
            <select name="seller" [(ngModel)]="seller" (ngModelChange)="rebuild()">@for (p of current().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
          </label>
        }
        <div class="field">
          <span>Disponible chez {{ sellerName() }}</span>
          @if (lines.length) {
            @for (line of lines; track line.commodityId) {
              <div class="sale-line" [style.--c]="color(line.name)">
                <label class="inline"><input type="checkbox" [name]="'inc' + line.commodityId" [(ngModel)]="line.include"> <b>{{ line.name }}</b></label>
                <input [name]="'qty' + line.commodityId" inputmode="decimal" autocomplete="off" [(ngModel)]="line.scu" [disabled]="!line.include" [attr.aria-label]="'SCU vendus de ' + line.name">
                <span class="muted">sur {{ scu(line.availableCscu) }} SCU</span>
              </div>
            }
            <small>Une vente partielle laisse le reste en stock.</small>
          } @else {
            <small>Rien en stock pour l’instant. Seul le minerai remis au vendeur peut être vendu.</small>
          }
          @for (order of waitingOrders(); track order.id) {
            <span class="waiting">
              @if (order.launcher.id === order.recipient.id) { Votre ordre de {{ order.terminalLabel }} est prêt. } @else { Ordre de {{ order.launcher.username }} prêt à {{ order.terminalLabel }}, pas encore remis. }
              <button type="button" class="btn small" [disabled]="busy()" (click)="handOver(order)">{{ order.launcher.id === order.recipient.id ? 'Je l’ai récupéré' : 'Je l’ai reçu' }}</button>
            </span>
          }
        </div>
        @if (lines.length) {
          <div class="fields">
            <label class="field">Lieu de vente
              <select name="terminal" [(ngModel)]="terminalId">
                <option [ngValue]="null">Autre lieu (saisi à la main)</option>
                @for (t of reference().saleTerminals; track t.id) { <option [ngValue]="t.id">{{ t.name }}@if (t.location) { · {{ t.location }} }</option> }
              </select>
            </label>
            @if (terminalId === null) { <label class="field">Nom du lieu<input name="label" [(ngModel)]="otherLabel" maxlength="200" placeholder="Terminal, ville ou station"></label> }
          </div>
          <label class="field">Montant reçu en jeu (aUEC)
            <input name="amount" class="big" inputmode="numeric" autocomplete="off" [ngModel]="amount" (ngModelChange)="amount = group($event)" placeholder="236 000" required>
            <small>{{ estimateLabel() }} Seul le montant reçu compte dans le partage.</small>
          </label>
        }
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          @if (sale()) { <button type="button" class="btn danger" [disabled]="busy()" (click)="remove()">Supprimer</button> }
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy() || !lines.length">{{ busy() ? 'Enregistrement…' : 'Enregistrer la vente' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .sale-line { display: grid; grid-template-columns: minmax(0, 1fr) 7rem auto; gap: .5rem; align-items: center; padding: .4rem .55rem; border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); border-radius: .5rem; background: color-mix(in srgb, var(--c) 10%, transparent); }
    .sale-line b { color: var(--c); }
    .sale-line input:not([type]) { padding: .4rem .5rem; border: 1px solid var(--line-strong); border-radius: .4rem; color: var(--fg); background: var(--field); font: inherit; }
    .inline { display: inline-flex; gap: .4rem; align-items: center; }
    .waiting { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; padding: .45rem .6rem; border: 1px dashed var(--gold); border-radius: .5rem; color: var(--fg); font-size: .84rem; }
  `]
})
export class SaleDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly reference = input.required<MarketReference>();
  readonly suggestions = input<SaleSuggestions | null>(null);
  readonly sale = input<SessionSale | null>(null);
  readonly saved = output<SessionSheet>();
  /** La fiche a changé sans fermer la fenêtre (ordre marqué remis). */
  readonly changed = output<SessionSheet>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly current = signal<SessionSheet>(null as unknown as SessionSheet);
  seller = '';
  lines: SaleLineForm[] = [];
  terminalId: number | null = null;
  otherLabel = '';
  amount = '';

  readonly scu = formatScu;
  readonly group = groupDigits;
  readonly color = oreColor;
  readonly sellerName = computed(() => this.current().participants.find(p => p.user.id === this.sellerId())?.user.username ?? 'vous');
  private readonly sellerId = signal('');
  readonly waitingOrders = computed(() => this.current().orders.filter(order => order.recipient.id === this.sellerId() && order.ready && !order.handedOverAt));

  ngOnInit(): void {
    this.current.set(this.sheet());
    const sale = this.sale();
    this.seller = sale ? sale.seller.id : this.sheet().permissions.currentUserId;
    if (sale) {
      this.terminalId = sale.terminalId;
      this.otherLabel = sale.terminalId === null ? sale.terminalLabel : '';
      this.amount = groupDigits(sale.amount);
    }
    this.rebuild();
    // Nouvelle vente : meilleur lieu suggéré pour le premier minerai, modifiable.
    if (!sale) {
      const first = this.lines[0];
      const best = first ? this.suggestions()?.commodities.find(item => item.commodityId === first.commodityId)?.points[0] : undefined;
      this.terminalId = best?.terminalId ?? null;
    }
  }

  /** Lignes = stock du vendeur ; en modification, les quantités de cette vente redeviennent disponibles. */
  rebuild(): void {
    this.sellerId.set(this.seller);
    const previous = new Map(this.lines.map(line => [line.commodityId, line]));
    const sale = this.sale();
    const own = sale && sale.seller.id === this.seller ? new Map(sale.lines.map(line => [line.commodityId, line.quantityCscu])) : new Map<number, number>();
    const stock = this.current().stock.find(entry => entry.seller.id === this.seller)?.lines ?? [];
    const names = new Map<number, string>();
    stock.forEach(line => names.set(line.commodityId, line.commodityName));
    sale?.lines.forEach(line => names.set(line.commodityId, line.commodityName));
    const ids = new Set<number>([...stock.filter(line => line.inStockCscu > 0).map(line => line.commodityId), ...own.keys()]);
    this.lines = [...ids].map(id => {
      const available = (stock.find(line => line.commodityId === id)?.inStockCscu ?? 0) + (own.get(id) ?? 0);
      const kept = previous.get(id);
      return kept ? { ...kept, availableCscu: available }
        : { commodityId: id, name: names.get(id) ?? `Minerai ${id}`, availableCscu: available, scu: scuInput(own.get(id) ?? available), include: sale ? own.has(id) : true };
    }).filter(line => line.availableCscu > 0);
  }

  estimateLabel(): string {
    const suggestions = this.suggestions();
    if (this.terminalId === null || !suggestions) return '';
    let total = 0;
    let known = false;
    for (const line of this.lines.filter(item => item.include)) {
      const cscu = parseScu(line.scu) ?? 0;
      const point = suggestions.commodities.find(item => item.commodityId === line.commodityId)?.points.find(p => p.terminalId === this.terminalId);
      if (point) { known = true; total += point.pricePerScu * cscu / 100; }
    }
    return known ? `Estimation UEX pour ce lieu : ${formatAuec(total)} aUEC.` : 'Pas d’estimation UEX pour ce lieu.';
  }

  handOver(order: RefineryOrder): void {
    this.busy.set(true);
    this.error.set('');
    this.sessions.handOver(this.current().id, order.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.current.set(sheet); this.rebuild(); this.changed.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'La remise n’a pas pu être enregistrée.')); }
    });
  }

  save(): void {
    const amount = parseAmount(this.amount);
    if (!amount) { this.error.set('Indiquez le montant reçu en jeu, supérieur à zéro.'); return; }
    const chosen = this.lines.filter(line => line.include);
    if (!chosen.length) { this.error.set('Cochez au moins un minerai vendu.'); return; }
    const lines = [];
    for (const line of chosen) {
      const quantityCscu = parseScu(line.scu);
      if (!quantityCscu) { this.error.set(`Quantité invalide pour ${line.name}.`); return; }
      if (quantityCscu > line.availableCscu) { this.error.set(`${line.name} : ${formatScu(quantityCscu)} SCU demandés, ${formatScu(line.availableCscu)} disponibles.`); return; }
      lines.push({ commodityId: line.commodityId, quantityCscu });
    }
    if (this.terminalId === null && !this.otherLabel.trim()) { this.error.set('Indiquez le lieu de vente.'); return; }
    const payload = {
      sellerUserId: this.current().permissions.organizer ? this.seller : null,
      terminalId: this.terminalId, terminalLabel: this.terminalId === null ? this.otherLabel.trim() : null, amount, lines
    };
    const sale = this.sale();
    this.run(sale ? this.sessions.updateSale(this.current().id, sale.id, payload) : this.sessions.addSale(this.current().id, payload));
  }

  remove(): void {
    const sale = this.sale();
    if (sale) this.run(this.sessions.deleteSale(this.current().id, sale.id));
  }

  private run(request: ReturnType<MiningSessionService['addSale']>): void {
    this.busy.set(true);
    this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.saved.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'La vente n’a pas pu être enregistrée.')); }
    });
  }
}
