import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MarketReference, MiningSessionService, OreDestination, OrderPayload, RefineryOrder, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { HintComponent } from './hint.component';
import { SearchOption, SearchSelectComponent } from './search-select.component';
import { parseScu, scuInput } from './session-input';

interface LineForm { commodityId: number | null; scu: string; destination: OreDestination; }

/**
 * Cargaison de salvage (docs/salvage/SPEC.md) : ce qu'un membre ramène à bord, RMC du grattage de coque ou matériau
 * de construction du démantèlement. Pas de raffinerie ni de durée : la cargaison est prête dès sa saisie.
 * Le salvage n'a pas de qualité. Gardée par son détenteur pour qu'il la vende lui-même, elle est déjà dans son stock.
 */
@Component({
  selector: 'app-haul-dialog',
  standalone: true,
  imports: [FormsModule, HintComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--s-refine)" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="haul-title">
        <h2 id="haul-title">{{ order() ? 'Modifier la cargaison' : 'Nouvelle cargaison' }}</h2>
        @if (!options().length) {
          <p class="alert" role="alert">Aucun matériau de salvage dans les données UEX : un administrateur doit rafraîchir le cache UEX avant de saisir une cargaison.</p>
        }
        <div class="pair">
          <div class="field">
            <span>Récupérée par</span>
            @if (editHolder) {
              <select name="holder" [(ngModel)]="form.holder" aria-label="Récupérée par">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
            } @else {
              <div class="locked-field"><span>{{ nameOf(form.holder) }}</span>
                @if (sheet().permissions.organizer) { <button type="button" class="link" (click)="editHolder = true">Changer</button> }
              </div>
            }
          </div>
          <label class="field"><span>Emplacement de la cargaison<app-hint label="Emplacement de la cargaison" text="Vaisseau qui la transporte ou station où elle est déposée : le vendeur la récupère à cet endroit." /></span>
            <input name="location" [(ngModel)]="form.location" maxlength="200" placeholder="Vulture de Torin, Port Tressler" required>
          </label>
        </div>

        <label class="field">Vendu par
          <select name="recipient" [(ngModel)]="form.recipient">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}{{ p.user.id === form.holder ? ' (détenteur, la vend lui-même)' : '' }}</option> }</select>
          <small>{{ form.recipient === form.holder ? 'Déjà dans le stock du détenteur : la vente est possible immédiatement.' : 'À remettre à ce vendeur, qui confirme la remise sur la fiche.' }}</small>
        </label>

        <section class="block">
          <h3>Matériaux récupérés<app-hint label="Matériaux récupérés" text="Quantités en SCU. RMC : grattage de coque. Construction Rubble, Pieces ou Salvage : démantèlement, à raffiner en CMAT ou à vendre bruts. Un matériau conservé reste à son propriétaire : il ne compte ni dans les ventes ni dans le partage." /></h3>
          @for (line of form.lines; track $index; let i = $index) {
            <div class="line-row">
              <div class="field">
                <label [for]="'haul-material-' + i">Matériau</label>
                <app-search-select [inputId]="'haul-material-' + i" [name]="'commodity' + i" [(ngModel)]="line.commodityId" [options]="options()" placeholder="RMC, Construction…" />
              </div>
              <label class="field">SCU<input [name]="'scu' + i" inputmode="decimal" autocomplete="off" [(ngModel)]="line.scu" placeholder="16" required></label>
              <div class="dest" role="radiogroup" [attr.aria-label]="'Destination de la ligne ' + (i + 1)">
                <button type="button" role="radio" class="dest__sell" [attr.aria-checked]="line.destination === 'SELL'" (click)="line.destination = 'SELL'">À vendre</button>
                <button type="button" role="radio" class="dest__keep" [attr.aria-checked]="line.destination === 'KEEP'" (click)="line.destination = 'KEEP'">Conserver</button>
              </div>
              <button type="button" class="btn small" [disabled]="form.lines.length === 1" (click)="form.lines.splice(i, 1)" [attr.aria-label]="'Retirer la ligne ' + (i + 1)">×</button>
            </div>
          }
          <button type="button" class="btn small" style="justify-self: start" [disabled]="form.lines.length >= 20" (click)="addLine()">+ Matériau</button>
          <p class="note">Les composants démontés (armes, boucliers…) ne sont pas des marchandises UEX : déclarez leur vente comme une vente directe, sans cargaison.</p>
        </section>
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          @if (order()) { <button type="button" class="btn danger" [disabled]="busy()" (click)="remove()">Supprimer</button> }
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy() || !options().length">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog { width: min(42rem, 100%); }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
    .locked-field { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 2.6rem; padding: .45rem .65rem;
      border: 1px dashed var(--line-strong); border-radius: .4rem; color: var(--muted); background: rgba(18, 34, 53, .45); }
    .block { display: grid; gap: .55rem; padding: .8rem; border: 1px solid var(--line); border-radius: .65rem; background: var(--panel-2); }
    .block h3 { display: flex; align-items: center; margin: 0; color: var(--s-refine); font-size: .98rem; font-weight: 700; }
    .line-row { grid-template-columns: minmax(0, 2fr) minmax(0, .9fr) auto auto; }
    .dest { display: inline-flex; min-height: 2.5rem; border: 1px solid var(--line-strong); border-radius: .45rem; overflow: hidden; }
    .dest button { padding: .3rem .65rem; border: 0; color: var(--muted); background: var(--field); font: inherit; font-size: .82rem; white-space: nowrap; cursor: pointer; }
    .dest button + button { border-left: 1px solid var(--line-strong); }
    .dest button:hover { color: var(--fg); }
    .dest .dest__sell[aria-checked="true"] { color: #042f2e; background: var(--s-sell); font-weight: 700; }
    .dest .dest__keep[aria-checked="true"] { color: #2a1d05; background: var(--gold); font-weight: 700; }
    @media (max-width: 640px) {
      .pair { grid-template-columns: 1fr; }
      .line-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .line-row > .field:first-child { grid-column: 1 / -1; }
    }
  `]
})
export class HaulDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly reference = input.required<MarketReference>();
  readonly order = input<RefineryOrder | null>(null);
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  form = { holder: '', location: '', recipient: '', lines: [] as LineForm[] };
  /** « Récupérée par » : le membre connecté ; l'organisateur peut le changer s'il le demande. */
  editHolder = false;
  readonly options = computed<SearchOption<number>[]>(() => (this.reference().salvageCommodities ?? []).map(c => ({ value: c.id, label: c.name })));

  nameOf(userId: string): string {
    return this.sheet().participants.find(p => p.user.id === userId)?.user.username ?? 'Vous';
  }

  ngOnInit(): void {
    const order = this.order();
    const me = this.sheet().permissions.currentUserId;
    if (order) {
      this.form = {
        holder: order.launcher.id, location: order.terminalLabel, recipient: order.recipient.id,
        lines: order.lines.map(line => ({ commodityId: line.commodityId, scu: scuInput(line.quantityCscu), destination: line.destination }))
      };
    } else {
      this.form = { holder: me, location: '', recipient: me, lines: [] };
      this.addLine();
    }
  }

  addLine(): void {
    this.form.lines.push({ commodityId: null, scu: '', destination: 'SELL' });
  }

  save(): void {
    const location = this.form.location.trim();
    if (!location) { this.error.set('Indiquez où se trouve la cargaison (vaisseau ou station).'); return; }
    const lines: OrderPayload['lines'] = [];
    for (const line of this.form.lines) {
      const quantityCscu = parseScu(line.scu);
      if (!line.commodityId) { this.error.set('Choisissez le matériau de chaque ligne.'); return; }
      if (!quantityCscu) { this.error.set('Quantité invalide : en SCU, deux décimales au plus (ex. 16 ou 0,5).'); return; }
      lines.push({ commodityId: line.commodityId, quantityCscu, quality: null, destination: line.destination });
    }
    const payload: OrderPayload = {
      launcherUserId: this.sheet().permissions.organizer ? this.form.holder : null,
      kind: 'HAUL', terminalId: null, locationLabel: location, cost: this.order()?.cost ?? 0, remainingMinutes: null,
      recipientUserId: this.form.recipient || null, lines
    };
    const order = this.order();
    this.run(order ? this.sessions.updateOrder(this.sheet().id, order.id, payload) : this.sessions.addOrder(this.sheet().id, payload));
  }

  remove(): void {
    const order = this.order();
    if (order) this.run(this.sessions.deleteOrder(this.sheet().id, order.id));
  }

  private run(request: ReturnType<MiningSessionService['addOrder']>): void {
    this.busy.set(true);
    this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sheet => { this.busy.set(false); this.saved.emit(sheet); },
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'La cargaison n’a pas pu être enregistrée.')); }
    });
  }
}
