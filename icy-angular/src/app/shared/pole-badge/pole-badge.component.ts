import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { specialtyLabel } from '../../core/services/user/member-rank';
import { PoleIconComponent } from '../pole-icon/pole-icon.component';

/** Pastille du pôle auquel une activité est rattachée, à la couleur du pôle. N'affiche rien sans pôle connu. */
@Component({
  selector: 'app-pole-badge',
  standalone: true,
  imports: [PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-pole]': 'label() ? pole() : null', '[class.pole-badge--small]': 'small()', '[hidden]': '!label()' },
  template: `@if (label(); as name) { <app-pole-icon [key]="pole()!" [size]="small() ? 'h-3 w-3' : 'h-3.5 w-3.5'" /> {{ name }} }`,
  styles: `
    :host { display: inline-flex; align-items: center; gap: .3rem; width: fit-content; padding: .16rem .55rem; border: 1px solid rgb(var(--pole-tone) / .55); border-radius: 999px; background: rgb(var(--pole-tone) / .14); color: rgb(var(--pole-tone)); font-size: .72rem; font-weight: 600; vertical-align: middle; white-space: nowrap; }
    :host([hidden]) { display: none; }
    :host([data-pole=LOGISTIQUE]) { --pole-tone: 251 146 60; }
    :host([data-pole=MILITAIRE]) { --pole-tone: 248 113 113; }
    :host([data-pole=INDUSTRIE]) { --pole-tone: 52 211 153; }
    :host(.pole-badge--small) { padding: .04rem .4rem; font-size: .6rem; }
  `
})
export class PoleBadgeComponent {
  readonly pole = input<string | null | undefined>(null);
  readonly small = input(false);
  readonly label = computed(() => specialtyLabel(this.pole()));
}
