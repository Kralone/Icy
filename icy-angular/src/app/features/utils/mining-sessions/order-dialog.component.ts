import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MarketReference, MiningSessionService, OreDestination, RefineryOrder, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { HintComponent } from './hint.component';
import { hourLabel } from './mining-session-view';
import { SearchOption, SearchSelectComponent } from './search-select.component';
import { Duration, clampQuality, groupDigits, parseAmountOrZero, parseScu, scuInput, stepDuration, toDuration, typedDuration } from './session-input';

interface LineForm { commodityId: number | null; scu: string; quality: string; destination: OreDestination; }

/**
 * Ordre de raffinage : un par lancement. La durée restante est celle que la raffinerie affiche ;
 * la qualité est obligatoire sur chaque minerai ; un minerai conservé sort du partage.
 */
@Component({
  selector: 'app-order-dialog',
  standalone: true,
  imports: [FormsModule, HintComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  styleUrls: ['./mining-session-shared.css'],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <form class="dialog" style="--section: var(--s-refine)" (click)="$event.stopPropagation()" (ngSubmit)="save()" aria-labelledby="order-title">
        <h2 id="order-title">{{ order() ? 'Modifier l’ordre de raffinage' : 'Nouvel ordre de raffinage' }}</h2>
        @if (!reference().refineries.length) {
          <p class="alert" role="alert">La liste des raffineries UEX est vide : un administrateur doit rafraîchir le cache UEX avant de saisir un ordre.</p>
        }
        <div class="pair">
          <div class="field">
            <span>Lancé par</span>
            @if (editLauncher) {
              <select name="launcher" [(ngModel)]="form.launcher" aria-label="Lancé par">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
            } @else {
              <div class="locked-field"><span>{{ nameOf(form.launcher) }}</span>
                @if (sheet().permissions.organizer) { <button type="button" class="link" (click)="editLauncher = true">Changer</button> }
              </div>
            }
          </div>
          <div class="field">
            <label for="order-refinery">Raffinerie</label>
            <app-search-select inputId="order-refinery" name="terminal" [(ngModel)]="form.terminalId" [options]="refineryOptions()" placeholder="Rechercher une raffinerie" />
          </div>
          <label class="field">Méthode
            <select name="method" [(ngModel)]="form.methodCode">
              <option [ngValue]="null">Non précisée</option>
              @for (m of reference().methods; track m.code) { <option [ngValue]="m.code">{{ m.name }}</option> }
            </select>
          </label>
          <label class="field"><span>Coût payé (aUEC)<app-hint label="Coût payé" text="Compté dans les frais avancés et remboursé au lanceur avant le partage." /></span>
            <input name="cost" inputmode="numeric" autocomplete="off" [ngModel]="form.cost" (ngModelChange)="form.cost = group($event)" placeholder="0">
          </label>
        </div>

        <section class="block time" [class.time--off]="!!order() && !form.changeTime">
          <h3>Durée restante<app-hint label="Durée restante" text="Celle qu’affiche la raffinerie au lancement. Les flèches du clavier ajoutent ou retirent 1." /></h3>
          <div class="clock">
            <div class="unit">
              <button type="button" class="arrow" [disabled]="locked()" (click)="step('hours', 1)" aria-label="Ajouter une heure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
              <input name="hours" inputmode="numeric" autocomplete="off" [disabled]="locked()" [attr.aria-label]="'Heures'" [ngModel]="pad(form.duration.hours)"
                (ngModelChange)="type('hours', $event)" (focus)="$any($event.target).select()" (blur)="$any($event.target).value = pad(form.duration.hours)"
                (keydown.arrowup)="step('hours', 1); $event.preventDefault()" (keydown.arrowdown)="step('hours', -1); $event.preventDefault()">
              <button type="button" class="arrow" [disabled]="locked()" (click)="step('hours', -1)" aria-label="Retirer une heure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
              <small>heures</small>
            </div>
            <span class="colon" aria-hidden="true">:</span>
            <div class="unit">
              <button type="button" class="arrow" [disabled]="locked()" (click)="step('minutes', 1)" aria-label="Ajouter une minute"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
              <input name="minutes" inputmode="numeric" autocomplete="off" [disabled]="locked()" [attr.aria-label]="'Minutes'" [ngModel]="pad(form.duration.minutes)"
                (ngModelChange)="type('minutes', $event)" (focus)="$any($event.target).select()" (blur)="$any($event.target).value = pad(form.duration.minutes)"
                (keydown.arrowup)="step('minutes', 1); $event.preventDefault()" (keydown.arrowdown)="step('minutes', -1); $event.preventDefault()">
              <button type="button" class="arrow" [disabled]="locked()" (click)="step('minutes', -1)" aria-label="Retirer une minute"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
              <small>minutes</small>
            </div>
          </div>
          @if (durationPreview(); as end) { <span class="time__end">{{ end }}</span> }
          @if (order()) { <label class="inline"><input type="checkbox" name="changeTime" [(ngModel)]="form.changeTime"> Modifier l’heure de fin</label> }
        </section>

        <label class="field">À remettre à
          <select name="recipient" [(ngModel)]="form.recipient">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}{{ p.user.id === form.launcher ? ' (lanceur)' : '' }}</option> }</select>
        </label>

        <section class="block">
          <div class="block__head">
            <h3>Minerais raffinés<app-hint label="Minerais raffinés" text="Quantités en SCU, qualité de 0 à 1000. Un minerai conservé reste à son propriétaire : il ne compte ni dans les ventes ni dans le partage." /></h3>
          </div>
          @for (line of form.lines; track $index; let i = $index) {
            <div class="line-row">
              <div class="field">
                <label [for]="'order-ore-' + i">Minerai</label>
                <app-search-select [inputId]="'order-ore-' + i" [name]="'commodity' + i" [(ngModel)]="line.commodityId" [options]="commodityOptions()" placeholder="Minerai" />
              </div>
              <label class="field">SCU<input [name]="'scu' + i" inputmode="decimal" autocomplete="off" [(ngModel)]="line.scu" placeholder="14,8" required></label>
              <label class="field">Qualité<input [name]="'quality' + i" inputmode="numeric" autocomplete="off" [ngModel]="line.quality" (ngModelChange)="line.quality = clamp($event)" placeholder="0 à 1000" required></label>
              <div class="dest" role="radiogroup" [attr.aria-label]="'Destination de la ligne ' + (i + 1)">
                <button type="button" role="radio" class="dest__sell" [attr.aria-checked]="line.destination === 'SELL'" (click)="line.destination = 'SELL'">À vendre</button>
                <button type="button" role="radio" class="dest__keep" [attr.aria-checked]="line.destination === 'KEEP'" (click)="line.destination = 'KEEP'">Conserver</button>
              </div>
              <button type="button" class="btn small" [disabled]="form.lines.length === 1" (click)="form.lines.splice(i, 1)" [attr.aria-label]="'Retirer la ligne ' + (i + 1)">×</button>
            </div>
          }
          <button type="button" class="btn small" style="justify-self: start" [disabled]="form.lines.length >= 20" (click)="addLine()">+ Minerai</button>
        </section>
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
        <div class="dialog-actions">
          @if (order()) { <button type="button" class="btn danger" [disabled]="busy()" (click)="remove()">Supprimer</button> }
          <button type="button" class="btn" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="busy() || !reference().refineries.length">{{ busy() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog { width: min(46rem, 100%); }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
    .locked-field { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-height: 2.6rem; padding: .45rem .65rem;
      border: 1px dashed var(--line-strong); border-radius: .4rem; color: var(--muted); background: rgba(18, 34, 53, .45); }
    .block { display: grid; gap: .55rem; padding: .8rem; border: 1px solid var(--line); border-radius: .65rem; background: var(--panel-2); }
    .block__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4rem 1rem; }
    .block h3 { display: flex; align-items: center; margin: 0; color: var(--s-refine); font-size: .98rem; font-weight: 700; }
    .inline { display: inline-flex; gap: .35rem; align-items: center; color: var(--sky); font-size: .84rem; }
    /* Durée restante : le champ central de l'ordre, centré, avec l'heure de fin en pastille. */
    .time { justify-items: center; gap: .65rem; padding: 1rem .8rem 1.1rem; text-align: center;
      background: radial-gradient(ellipse at 50% 0%, rgba(253, 186, 116, .12), transparent 70%), var(--panel-2); }
    .time h3 { justify-content: center; }
    .clock { display: flex; align-items: flex-start; justify-content: center; gap: .35rem; }
    .unit { display: grid; justify-items: center; gap: .2rem; }
    .unit input { width: 4.6rem; padding: .35rem .2rem; border: 1px solid rgba(253, 186, 116, .55); border-radius: .7rem; color: var(--fg-strong); background: var(--field);
      font-family: "Space Mono", ui-monospace, monospace; font-size: 2rem; font-weight: 700; text-align: center; box-shadow: 0 0 0 4px rgba(253, 186, 116, .08); }
    .unit input:focus { outline: none; border-color: var(--s-refine); box-shadow: 0 0 0 4px rgba(253, 186, 116, .22); }
    .unit small { color: var(--muted); font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; }
    .colon { padding-top: 2.5rem; color: var(--s-refine); font-family: "Space Mono", ui-monospace, monospace; font-size: 2rem; font-weight: 700; line-height: 1; }
    .arrow { display: grid; place-items: center; width: 4.6rem; height: 1.7rem; padding: 0; border: 1px solid var(--line-strong); border-radius: .45rem; color: var(--s-refine);
      background: var(--field); cursor: pointer; }
    .arrow svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .arrow:hover:not(:disabled) { border-color: var(--s-refine); background: rgba(253, 186, 116, .14); }
    .arrow:disabled { opacity: .4; cursor: not-allowed; }
    .time__end { padding: .25rem .8rem; border: 1px solid rgba(253, 186, 116, .6); border-radius: 999px; color: var(--s-refine); background: rgba(253, 186, 116, .1); font-size: .84rem; font-weight: 600; }
    .time--off .clock { opacity: .55; }
    .line-row { grid-template-columns: minmax(0, 2fr) minmax(0, .9fr) minmax(0, .9fr) auto auto; }
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
export class OrderDialogComponent implements OnInit {
  private readonly sessions = inject(MiningSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sheet = input.required<SessionSheet>();
  readonly reference = input.required<MarketReference>();
  readonly order = input<RefineryOrder | null>(null);
  readonly saved = output<SessionSheet>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  form = { launcher: '', terminalId: null as number | null, methodCode: null as string | null, cost: '', duration: { hours: 0, minutes: 0 } as Duration, changeTime: false, recipient: '', lines: [] as LineForm[] };
  /** « Lancé par » : le membre connecté ; l'organisateur peut le changer s'il le demande. */
  editLauncher = false;
  readonly group = groupDigits;
  readonly clamp = clampQuality;
  readonly refineryOptions = computed<SearchOption<number>[]>(() => this.reference().refineries.map(t => ({ value: t.id, label: t.name, detail: t.location })));
  readonly commodityOptions = computed<SearchOption<number>[]>(() => this.reference().commodities.map(c => ({ value: c.id, label: c.name })));

  nameOf(userId: string): string {
    return this.sheet().participants.find(p => p.user.id === userId)?.user.username ?? 'Vous';
  }

  durationMinutes(): number {
    return this.form.duration.hours * 60 + this.form.duration.minutes;
  }

  /** Heure de fin d'un ordre existant non modifié : la durée n'est pas éditable. */
  locked(): boolean {
    return !!this.order() && !this.form.changeTime;
  }

  pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  step(unit: 'hours' | 'minutes', delta: 1 | -1): void {
    if (!this.locked()) this.form.duration = stepDuration(this.form.duration, unit, delta);
  }

  type(unit: 'hours' | 'minutes', text: string): void {
    this.form.duration = typedDuration(this.form.duration, unit, text);
  }

  /** Heure de fin calculée pendant la saisie. */
  durationPreview(): string {
    const order = this.order();
    if (order && !this.form.changeTime) return `Prêt à ${hourLabel(order.finishesAt)}`;
    const minutes = this.durationMinutes();
    return minutes > 0 ? `Prêt vers ${hourLabel(new Date(Date.now() + minutes * 60_000).toISOString())}` : '';
  }

  ngOnInit(): void {
    const order = this.order();
    const me = this.sheet().permissions.currentUserId;
    if (order) {
      const left = Math.max(0, new Date(order.finishesAt).getTime() - new Date(this.sheet().serverTime).getTime());
      const minutes = Math.ceil(left / 60000);
      this.form = {
        launcher: order.launcher.id, terminalId: order.terminalId, methodCode: order.methodCode, cost: order.cost ? groupDigits(order.cost) : '',
        duration: toDuration(minutes), changeTime: false, recipient: order.recipient.id,
        lines: order.lines.map(line => ({ commodityId: line.commodityId, scu: scuInput(line.quantityCscu), quality: String(line.quality), destination: line.destination }))
      };
    } else {
      this.form = { launcher: me, terminalId: null, methodCode: null, cost: '', duration: { hours: 0, minutes: 0 }, changeTime: true, recipient: me, lines: [] };
      this.addLine();
    }
  }

  addLine(): void {
    this.form.lines.push({ commodityId: null, scu: '', quality: '', destination: 'SELL' });
  }

  save(): void {
    const cost = parseAmountOrZero(this.form.cost);
    if (cost === null) { this.error.set('Coût invalide.'); return; }
    if (!this.form.terminalId) { this.error.set('Choisissez la raffinerie.'); return; }
    const lines = [];
    for (const line of this.form.lines) {
      const quantityCscu = parseScu(line.scu);
      const quality = line.quality === '' || line.quality === null ? null : Number(line.quality);
      if (!line.commodityId) { this.error.set('Choisissez le minerai de chaque ligne.'); return; }
      if (!quantityCscu) { this.error.set('Quantité invalide : en SCU, deux décimales au plus (ex. 14,8).'); return; }
      if (quality === null || !Number.isInteger(quality) || quality < 0 || quality > 1000) { this.error.set('La qualité est obligatoire, de 0 à 1000.'); return; }
      lines.push({ commodityId: line.commodityId, quantityCscu, quality, destination: line.destination });
    }
    const timeChanged = !this.order() || this.form.changeTime;
    const minutes = this.durationMinutes();
    const payload = {
      launcherUserId: this.sheet().permissions.organizer ? this.form.launcher : null,
      terminalId: this.form.terminalId, methodCode: this.form.methodCode, cost,
      remainingMinutes: timeChanged ? minutes : null,
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
      error: error => { this.busy.set(false); this.error.set(serverMessage(error, 'L’ordre n’a pas pu être enregistré.')); }
    });
  }
}
