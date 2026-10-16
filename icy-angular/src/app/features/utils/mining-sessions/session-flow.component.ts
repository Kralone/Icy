import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ShareRow, Transfer, formatAuec } from '../../../core/services/mining/mining-session.service';

interface Node { id: string; name: string; amount: string; y: number; }
interface Band { d: string; width: number; received: boolean; dashed: boolean; }

/** Flux des versements : payeurs à gauche, receveurs à droite, épaisseur proportionnelle au montant. */
@Component({
  selector: 'app-session-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (layout(); as view) {
      <svg class="flow" [attr.viewBox]="'0 0 600 ' + view.height" role="img" aria-label="Flux des versements : payeurs à gauche, receveurs à droite">
        @for (band of view.bands; track $index) {
          <path [attr.d]="band.d" fill="none" [attr.stroke]="band.received ? '#4ade80' : '#a5b4fc'" [attr.stroke-opacity]="band.received ? .6 : .45"
            [attr.stroke-width]="band.width" [attr.stroke-dasharray]="band.dashed ? '6 5' : null" />
        }
        @for (node of view.payers; track node.id) {
          <text x="158" [attr.y]="node.y - 3" text-anchor="end">{{ node.name }}</text>
          <text class="m" x="158" [attr.y]="node.y + 13" text-anchor="end">− {{ node.amount }}</text>
        }
        @for (node of view.receivers; track node.id) {
          <text x="442" [attr.y]="node.y - 3" text-anchor="start">{{ node.name }}</text>
          <text class="m" x="442" [attr.y]="node.y + 13" text-anchor="start">+ {{ node.amount }}</text>
        }
      </svg>
    }
  `,
  styles: [`
    :host { display: block; }
    .flow { display: block; width: 100%; max-width: 40rem; height: auto; margin: .4rem auto 0; }
    text { fill: #e2e8f0; font-family: "Space Grotesk", system-ui, sans-serif; font-size: 13px; }
    text.m { fill: #94a3b8; font-size: 11.5px; font-family: "Space Mono", ui-monospace, monospace; }
  `]
})
export class SessionFlowComponent {
  readonly transfers = input.required<Transfer[]>();
  readonly rows = input.required<ShareRow[]>();
  /** Fiche terminée : un versement non confirmé est en pointillé. */
  readonly closed = input(false);

  readonly layout = computed(() => {
    const transfers = this.transfers();
    if (!transfers.length) return null;
    const payers = [...new Map(transfers.map(t => [t.from.id, t.from])).values()];
    const receivers = [...new Map(transfers.map(t => [t.to.id, t.to])).values()];
    const rowH = 58;
    const count = Math.max(payers.length, receivers.length);
    const max = Math.max(...transfers.map(t => t.amount));
    // La colonne la plus courte est centrée face à l'autre.
    const y = (list: { id: string }[], id: string) => 8 + (count - list.length) * rowH / 2 + list.findIndex(item => item.id === id) * rowH + rowH / 2;
    const gapOf = (id: string) => Math.abs(this.rows().find(row => row.user.id === id)?.gap ?? 0);
    return {
      height: count * rowH + 16,
      bands: transfers.map<Band>(t => {
        const y1 = y(payers, t.from.id), y2 = y(receivers, t.to.id);
        return { d: `M168 ${y1} C 300 ${y1}, 300 ${y2}, 432 ${y2}`, width: 3 + 16 * t.amount / max, received: !!t.receivedAt, dashed: this.closed() && !t.receivedAt };
      }),
      payers: payers.map<Node>(user => ({ id: user.id, name: user.username, amount: formatAuec(gapOf(user.id)), y: y(payers, user.id) })),
      receivers: receivers.map<Node>(user => ({ id: user.id, name: user.username, amount: formatAuec(gapOf(user.id)), y: y(receivers, user.id) }))
    };
  });
}
