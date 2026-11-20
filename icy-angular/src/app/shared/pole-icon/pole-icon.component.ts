import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Icône d'un pôle (caisse de fret, viseur, usine) ou de la fonction de trésorier (banque). Prend la couleur du texte. */
@Component({
  selector: 'app-pole-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg viewBox="0 0 24 24" [class]="size()" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (key()) {
        @case ('LOGISTIQUE') {
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12M7.5 4.27l9 5.15" />
        }
        @case ('MILITAIRE') {
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
        }
        @case ('INDUSTRIE') {
          <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M7 18h1M12 18h1M17 18h1" />
        }
        @case ('TRESORIER') {
          <path d="M11.12 2.2a2 2 0 0 1 1.76 0l7.87 3.85c.47.23.3.95-.22.95H3.47c-.53 0-.7-.72-.22-.95z" />
          <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 22h18" />
        }
      }
    </svg>
  `
})
export class PoleIconComponent {
  readonly key = input.required<string>();
  /** Classes de taille de l'icône. */
  readonly size = input('h-6 w-6');
}
