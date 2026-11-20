import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SPECIALTIES } from '../../core/services/user/member-rank';
import { PoleIconComponent } from '../pole-icon/pole-icon.component';

/** Filtre par pôle : « Tous » ou l'un des trois pôles. La valeur est la clé du pôle, vide pour tous. */
@Component({
  selector: 'app-pole-filter',
  standalone: true,
  imports: [PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', 'aria-label': 'Filtrer par pôle' },
  template: `
    <button type="button" [attr.aria-pressed]="!value()" (click)="valueChange.emit('')">Tous</button>
    @for (pole of poles; track pole.key) {
      <button type="button" [attr.data-pole]="pole.key" [attr.aria-pressed]="value() === pole.key" (click)="valueChange.emit(pole.key)">
        <app-pole-icon [key]="pole.key" size="h-4 w-4" /> {{ pole.label }}
      </button>
    }
  `,
  styles: `
    :host { display: inline-flex; flex-wrap: wrap; gap: .4rem; }
    [data-pole=LOGISTIQUE] { --pole-tone: 251 146 60; }
    [data-pole=MILITAIRE] { --pole-tone: 248 113 113; }
    [data-pole=INDUSTRIE] { --pole-tone: 52 211 153; }
    button { display: inline-flex; align-items: center; gap: .4rem; padding: .5rem .9rem; border: 1px solid #294253; border-radius: 999px; background: #081421; color: #a9bdcf; font-size: .8rem; font-weight: 600; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
    button:hover { border-color: rgb(var(--pole-tone, 105 182 203) / .7); color: #e7f3fb; }
    button[aria-pressed=true] { border-color: rgb(var(--pole-tone, 105 182 203)); background: rgb(var(--pole-tone, 105 182 203) / .16); color: rgb(var(--pole-tone, 216 248 255)); }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  `
})
export class PoleFilterComponent {
  readonly poles = SPECIALTIES;
  readonly value = input('');
  readonly valueChange = output<string>();
}
