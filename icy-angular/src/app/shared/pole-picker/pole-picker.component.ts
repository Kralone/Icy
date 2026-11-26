import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SPECIALTIES } from '../../core/services/user/member-rank';
import { PoleIconComponent } from '../pole-icon/pole-icon.component';

/**
 * Choix de plusieurs pôles : chaque pôle se coche ou se décoche, aucun coché signifie « aucun pôle ».
 * `locked` : pôle toujours inclus, qui ne se décoche pas (celui d'un Spécialiste référent).
 */
@Component({
  selector: 'app-pole-picker',
  standalone: true,
  imports: [PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group' },
  template: `
    @for (pole of poles; track pole.key) {
      <button type="button" [attr.data-pole]="pole.key" [attr.aria-pressed]="selected().has(pole.key)"
              [disabled]="disabled() || pole.key === locked()" [attr.data-testid]="testId() ? testId() + '-' + pole.key : null"
              [attr.title]="pole.key === locked() ? 'Votre pôle reste rattaché' : null"
              (click)="toggle(pole.key)">
        <span class="check" aria-hidden="true">{{ selected().has(pole.key) ? '✓' : '' }}</span>
        <app-pole-icon [key]="pole.key" size="h-4 w-4" /> {{ pole.label }}
      </button>
    }
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: .45rem; }
    [data-pole=LOGISTIQUE] { --pole-tone: 251 146 60; }
    [data-pole=MILITAIRE] { --pole-tone: 248 113 113; }
    [data-pole=INDUSTRIE] { --pole-tone: 52 211 153; }
    button { display: inline-flex; align-items: center; gap: .45rem; min-height: 2.5rem; padding: .45rem .9rem .45rem .55rem; border: 1px solid #294253; border-radius: 999px; background: #081421; color: #a9bdcf; font-size: .85rem; font-weight: 600; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
    button:hover:not(:disabled) { border-color: rgb(var(--pole-tone) / .7); color: #e7f3fb; }
    button:focus-visible { outline: 2px solid rgb(34 211 238); outline-offset: 2px; }
    button[aria-pressed=true] { border-color: rgb(var(--pole-tone)); background: rgb(var(--pole-tone) / .16); color: rgb(var(--pole-tone)); }
    button:disabled { cursor: default; }
    button:disabled:not([aria-pressed=true]) { opacity: .5; }
    .check { display: inline-grid; place-items: center; width: 1.1rem; height: 1.1rem; border: 1px solid currentColor; border-radius: .3rem; font-size: .7rem; line-height: 1; }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  `
})
export class PolePickerComponent {
  readonly poles = SPECIALTIES;
  readonly value = input<readonly string[] | null | undefined>([]);
  readonly locked = input<string | null | undefined>('');
  readonly disabled = input(false);
  readonly testId = input('');
  readonly valueChange = output<string[]>();

  readonly selected = computed(() => {
    const keys = new Set((this.value() ?? []).map(key => (key ?? '').trim().toUpperCase()));
    const locked = (this.locked() ?? '').trim().toUpperCase();
    if (locked) keys.add(locked);
    return keys;
  });

  toggle(key: string): void {
    if (this.disabled() || key === this.locked()) return;
    const next = new Set(this.selected());
    if (next.has(key)) next.delete(key); else next.add(key);
    // Toujours dans l'ordre d'affichage, quel que soit l'ordre des clics.
    this.valueChange.emit(this.poles.map(pole => pole.key).filter(pole => next.has(pole)));
  }
}
