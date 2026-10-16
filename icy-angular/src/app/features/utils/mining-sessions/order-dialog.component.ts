import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MarketReference, MiningSessionService, OreDestination, RefineryOrder, SessionSheet, serverMessage } from '../../../core/services/mining/mining-session.service';
import { parseAmountOrZero, parseScu, scuInput } from './session-input';

interface LineForm { commodityId: number | null; scu: string; quality: string; destination: OreDestination; }

/**
 * Ordre de raffinage : un par lancement. La durée restante est celle que la raffinerie affiche ;
 * la qualité est obligatoire sur chaque minerai ; un minerai conservé sort du partage.
 */
@Component({
  selector: 'app-order-dialog',
  standalone: true,
  imports: [FormsModule],
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
        <div class="fields">
          @if (sheet().permissions.organizer) {
            <label class="field">Lancé par
              <select name="launcher" [(ngModel)]="form.launcher">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}</option> }</select>
            </label>
          }
          <label class="field">Raffinerie
            <select name="terminal" [(ngModel)]="form.terminalId" required>
              <option [ngValue]="null" disabled>Choisir</option>
              @for (t of reference().refineries; track t.id) { <option [ngValue]="t.id">{{ t.name }}@if (t.location) { · {{ t.location }} }</option> }
            </select>
          </label>
          <label class="field">Méthode
            <select name="method" [(ngModel)]="form.methodCode">
              <option [ngValue]="null">Non précisée</option>
              @for (m of reference().methods; track m.code) { <option [ngValue]="m.code">{{ m.name }}</option> }
            </select>
          </label>
          <label class="field">Coût payé (aUEC)<input name="cost" inputmode="numeric" autocomplete="off" [(ngModel)]="form.cost" placeholder="0"><small>Remboursé au lanceur avant le partage.</small></label>
        </div>
        <fieldset class="fields duration" [disabled]="!!order() && !form.changeTime">
          <legend class="field">Durée restante affichée par la raffinerie
            @if (order()) { <label class="inline"><input type="checkbox" name="changeTime" [(ngModel)]="form.changeTime"> Modifier l’heure de fin</label> }
          </legend>
          <label class="field">Heures<input name="hours" type="number" min="0" max="720" [(ngModel)]="form.hours"></label>
          <label class="field">Minutes<input name="minutes" type="number" min="0" max="59" [(ngModel)]="form.minutes"></label>
        </fieldset>
        <label class="field">À remettre à
          <select name="recipient" [(ngModel)]="form.recipient">@for (p of sheet().participants; track p.user.id) { <option [ngValue]="p.user.id">{{ p.user.username }}{{ p.user.id === form.launcher ? ' (lanceur)' : '' }}</option> }</select>
          <small>Le vendeur qui recevra ce minerai.</small>
        </label>
        <div class="field">
          <span>Minerais raffinés</span>
          @for (line of form.lines; track $index; let i = $index) {
            <div class="line-row">
              <label class="field">Minerai
                <select [name]="'commodity' + i" [(ngModel)]="line.commodityId" required>
                  <option [ngValue]="null" disabled>Choisir</option>
                  @for (c of reference().commodities; track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select>
              </label>
              <label class="field">SCU<input [name]="'scu' + i" inputmode="decimal" autocomplete="off" [(ngModel)]="line.scu" placeholder="14,8" required></label>
              <label class="field">Qualité<input [name]="'quality' + i" type="number" min="0" max="1000" [(ngModel)]="line.quality" placeholder="0 à 1000" required></label>
              <button type="button" class="toggle" [attr.aria-pressed]="line.destination === 'KEEP'" (click)="line.destination = line.destination === 'SELL' ? 'KEEP' : 'SELL'">{{ line.destination === 'SELL' ? 'À vendre' : 'Conservé' }}</button>
              <button type="button" class="btn small" [disabled]="form.lines.length === 1" (click)="form.lines.splice(i, 1)" [attr.aria-label]="'Retirer la ligne ' + (i + 1)">×</button>
            </div>
          }
          <button type="button" class="btn small" style="justify-self: start" [disabled]="form.lines.length >= 20" (click)="addLine()">+ Minerai</button>
          <small>Quantité raffinée, en SCU. Un minerai « conservé » sort du partage et des stocks à vendre.</small>
        </div>
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
    .duration { border: 0; padding: 0; margin: 0; }
    .duration legend { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; padding: 0; margin-bottom: .3rem; }
    .duration .inline { display: inline-flex; gap: .35rem; align-items: center; font-size: .84rem; color: var(--sky); }
    .duration:disabled .field input { opacity: .5; }
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
  form = { launcher: '', terminalId: null as number | null, methodCode: null as string | null, cost: '', hours: 0, minutes: 0, changeTime: false, recipient: '', lines: [] as LineForm[] };

  ngOnInit(): void {
    const order = this.order();
    const me = this.sheet().permissions.currentUserId;
    if (order) {
      const left = Math.max(0, new Date(order.finishesAt).getTime() - new Date(this.sheet().serverTime).getTime());
      const minutes = Math.ceil(left / 60000);
      this.form = {
        launcher: order.launcher.id, terminalId: order.terminalId, methodCode: order.methodCode, cost: order.cost ? String(order.cost) : '',
        hours: Math.floor(minutes / 60), minutes: minutes % 60, changeTime: false, recipient: order.recipient.id,
        lines: order.lines.map(line => ({ commodityId: line.commodityId, scu: scuInput(line.quantityCscu), quality: String(line.quality), destination: line.destination }))
      };
    } else {
      this.form = { launcher: me, terminalId: null, methodCode: null, cost: '', hours: 0, minutes: 0, changeTime: true, recipient: me, lines: [] };
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
    const minutes = Math.max(0, Math.floor(Number(this.form.hours) || 0)) * 60 + Math.max(0, Math.floor(Number(this.form.minutes) || 0));
    const payload = {
      launcherUserId: this.sheet().permissions.organizer ? this.form.launcher : null,
      terminalId: this.form.terminalId, methodCode: this.form.methodCode, cost,
      remainingMinutes: this.order() && !this.form.changeTime ? null : minutes,
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
