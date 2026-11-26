import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NavIconKey =
  | 'dashboard'
  | 'scwe'
  | 'hangar'
  | 'fleet'
  | 'events'
  | 'goals'
  | 'poles'
  | 'bank'
  | 'guides'
  | 'tools'
  | 'admin';

/**
 * Icône du menu latéral, au trait sur une grille 24 px. Le trait prend la couleur du texte ;
 * les étoiles du logo IceForge prennent `--nav-icon-accent` (la couleur du texte à défaut).
 */
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  styles: `
    .nav-icon__star { stroke: var(--nav-icon-accent, currentColor); }
    .nav-icon__star-fill { fill: var(--nav-icon-accent, currentColor); }
  `,
  template: `
    <svg viewBox="0 0 24 24" [class]="size()" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" overflow="visible" aria-hidden="true">
      @switch (key()) {
        @case ('dashboard') {
          <path d="M12 2L20.66 7L20.66 17L12 22L3.34 17L3.34 7Z" />
          <path class="nav-icon__star" stroke-width="1.4" d="M12 7.4Q12.92 11.08 16.6 12Q12.92 12.92 12 16.6Q11.08 12.92 7.4 12Q11.08 11.08 12 7.4Z" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        }
        @case ('scwe') {
          <g transform="rotate(-20 12 12)">
            <path d="M1.4 12A10.6 3.6 0 0 1 7.17 8.8M16.83 8.8A10.6 3.6 0 0 1 22.6 12" />
            <path d="M1.4 12a10.6 3.6 0 0 0 21.2 0" />
          </g>
          <path class="nav-icon__star" stroke-width="1.4" d="M12 6.6Q13.08 10.92 17.4 12Q13.08 13.08 12 17.4Q10.92 13.08 6.6 12Q10.92 10.92 12 6.6Z" />
        }
        @case ('hangar') {
          <path d="M12 1.8L20.83 6.9L20.83 17.1L12 22.2L3.17 17.1L3.17 6.9Z" />
          <path d="M6.8 11.6 12 15l5.2-3.4" />
          <path d="M8.4 15.2 12 17.6l3.6-2.4" stroke-width="1.3" />
          <path class="nav-icon__star-fill" stroke="none" d="M12 5.4Q12.44 7.16 14.2 7.6Q12.44 8.04 12 9.8Q11.56 8.04 9.8 7.6Q11.56 7.16 12 5.4Z" />
        }
        @case ('fleet') {
          <path d="M12 2.8l3.2 7.6L12 8.9l-3.2 1.5Z" />
          <path d="M5.5 11.24l2.5 5.92-2.5-1.17-2.5 1.17Z" />
          <path d="M18.5 11.24l2.5 5.92-2.5-1.17-2.5 1.17Z" />
          <path d="M12 11.4v6.4M4.4 18.4v3.4M6.6 18.4v3.4M17.4 18.4v3.4M19.6 18.4v3.4" stroke-dasharray="2.2 1.6" stroke-width="1.4" />
        }
        @case ('events') {
          <rect x="3" y="4.8" width="18" height="16.2" rx="2.2" />
          <path d="M3 9.8h18M8 2.8v4M16 2.8v4" />
          <path class="nav-icon__star-fill" stroke="none" d="M12 12.8Q12.56 15.04 14.8 15.6Q12.56 16.16 12 18.4Q11.44 16.16 9.2 15.6Q11.44 15.04 12 12.8Z" />
          <path class="nav-icon__star-fill" stroke="none" d="M7.2 12.2Q7.44 13.16 8.4 13.4Q7.44 13.64 7.2 14.6Q6.96 13.64 6 13.4Q6.96 13.16 7.2 12.2Z" />
          <path class="nav-icon__star-fill" stroke="none" d="M16.8 12.2Q17.04 13.16 18 13.4Q17.04 13.64 16.8 14.6Q16.56 13.64 15.6 13.4Q16.56 13.16 16.8 12.2Z" />
        }
        @case ('goals') {
          <path d="M3.8 20 9 13.5l4.2 3.2 5-7" />
          <circle cx="3.8" cy="20" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="9" cy="13.5" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="13.2" cy="16.7" r="1.7" fill="currentColor" stroke="none" />
          <path class="nav-icon__star-fill" stroke="none" d="M19.6 1.8Q20.28 4.52 23 5.2Q20.28 5.88 19.6 8.6Q18.92 5.88 16.2 5.2Q18.92 4.52 19.6 1.8Z" />
        }
        @case ('poles') {
          <path d="M9.4 4.4A8.4 8.4 0 0 0 3.8 12.6M20.2 12.6A8.4 8.4 0 0 0 14.6 4.4M6.1 18.5a8.4 8.4 0 0 0 11.8 0" stroke-width="1.4" />
          <circle cx="12" cy="3.6" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="4.4" cy="15.8" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="19.6" cy="15.8" r="2.4" fill="currentColor" stroke="none" />
          <path class="nav-icon__star" stroke-width="1.4" d="M12 9.4Q12.6 11.8 15 12.4Q12.6 13 12 15.4Q11.4 13 9 12.4Q11.4 11.8 12 9.4Z" />
        }
        @case ('bank') {
          <circle cx="12" cy="12" r="10" />
          <path d="M6.6 10 9.2 6.8h5.6l2.6 3.2L12 17.2Z" stroke-width="1.5" />
          <path d="M6.6 10h10.8M10.4 10 12 17.2l1.6-7.2" stroke-width="1.2" />
        }
        @case ('guides') {
          <path d="M12 6.2C10 4.7 7 4 3 4v14.2c4 0 7 .7 9 2.2 2-1.5 5-2.2 9-2.2V4c-4 0-7 .7-9 2.2Z" />
          <path d="M12 6.2v14.2" />
          <path d="M6 8.5c1.5.1 2.8.4 3.8.9M6 12c1.5.1 2.8.4 3.8.9" />
        }
        @case ('tools') {
          <path d="M9.02 4.79L10.48 4.35L10.82 2.07L13.18 2.07L13.52 4.35L14.98 4.79L16.33 5.51L18.19 4.15L19.85 5.81L18.49 7.67L19.21 9.02L19.65 10.48L21.93 10.82L21.93 13.18L19.65 13.52L19.21 14.98L18.49 16.33L19.85 18.19L18.19 19.85L16.33 18.49L14.98 19.21L13.52 19.65L13.18 21.93L10.82 21.93L10.48 19.65L9.02 19.21L7.67 18.49L5.81 19.85L4.15 18.19L5.51 16.33L4.79 14.98L4.35 13.52L2.07 13.18L2.07 10.82L4.35 10.48L4.79 9.02L5.51 7.67L4.15 5.81L5.81 4.15L7.67 5.51Z" />
          <circle cx="12" cy="12" r="5.2" stroke-width="1.3" />
          <path class="nav-icon__star-fill" stroke="none" d="M12 9.2Q12.56 11.44 14.8 12Q12.56 12.56 12 14.8Q11.44 12.56 9.2 12Q11.44 11.44 12 9.2Z" />
        }
        @case ('admin') {
          <path d="M12 2.2l8.2 3v6.2c0 5.1-3.5 8.8-8.2 10.4-4.7-1.6-8.2-5.3-8.2-10.4V5.2Z" />
          <path d="M6.8 15.6l3.3-4.2 1.9 2 2.3-3.2 3 5.4" />
          <path class="nav-icon__star-fill" stroke="none" d="M12 5Q12.44 6.76 14.2 7.2Q12.44 7.64 12 9.4Q11.56 7.64 9.8 7.2Q11.56 6.76 12 5Z" />
        }
      }
    </svg>
  `,
})
export class NavIconComponent {
  readonly key = input.required<NavIconKey>();
  /** Classes de taille de l'icône. */
  readonly size = input('h-6 w-6');
}
