import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CatalogIconKey =
  | 'catalog'
  | 'ship'
  | 'vehicle'
  | 'weapon'
  | 'armor'
  | 'component'
  | 'module'
  | 'tool'
  | 'item'
  | 'system'
  | 'planet'
  | 'moon'
  | 'station'
  | 'city'
  | 'outpost'
  | 'jump'
  | 'location'
  | 'ore'
  | 'refinery'
  | 'price'
  | 'drill'
  | 'image'
  | 'watch'
  | 'sync'
  | 'link';

/**
 * Icône du catalogue et des ressources de minage, dessinée comme celles du menu latéral :
 * trait 24 px à la couleur du texte, étoile du logo en `--nav-icon-accent`.
 * La classe `catalog-icon-halo` applique la palette Halo (bleu glacé, halo cyan).
 */
@Component({
  selector: 'app-catalog-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  styles: `
    :host(.catalog-icon-halo) {
      flex: none;
      color: #e0f2fe;
      --nav-icon-accent: #22d3ee;
      filter: drop-shadow(0 0 1.5px rgb(103 232 249 / 0.47)) drop-shadow(0 0 5px rgb(103 232 249 / 0.35));
    }
    svg { width: var(--catalog-icon-size, 1.4rem); height: var(--catalog-icon-size, 1.4rem); }
    .star { stroke: var(--nav-icon-accent, currentColor); }
    .star-fill { fill: var(--nav-icon-accent, currentColor); }
  `,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" overflow="visible" aria-hidden="true">
      @switch (key()) {
        @case ('catalog') {
          <rect x="3" y="3" width="7.6" height="7.6" rx="1.8" /><rect x="13.4" y="3" width="7.6" height="7.6" rx="1.8" />
          <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.8" />
          <path class="star-fill" stroke="none" d="M17.2 12.6Q17.88 15.52 20.8 16.2Q17.88 16.88 17.2 19.8Q16.52 16.88 13.6 16.2Q16.52 15.52 17.2 12.6Z" />
        }
        @case ('ship') {
          <path d="M12 2.4l3.6 8.4v4.6L12 13.6l-3.6 1.8v-4.6Z" />
          <path d="M8.4 11.6 3 15.6v2.2l5.4-1.6M15.6 11.6l5.4 4v2.2l-5.4-1.6" />
          <path d="M10.4 17.4 12 21.4l1.6-4" stroke-width="1.4" />
          <path class="star-fill" stroke="none" d="M12 6.6Q12.32 7.88 13.6 8.2Q12.32 8.52 12 9.8Q11.68 8.52 10.4 8.2Q11.68 7.88 12 6.6Z" />
        }
        @case ('vehicle') {
          <path d="M3 15.2V11l2.4-4.4h9.4L18 11h3v4.2" /><path d="M3 15.2h18" />
          <circle cx="7" cy="17.6" r="2.2" /><circle cx="17" cy="17.6" r="2.2" />
          <path d="M7.2 11h8.2" stroke-width="1.3" />
        }
        @case ('weapon') {
          <circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="3.4" />
          <path d="M12 1.6v4.2M12 18.2v4.2M1.6 12h4.2M18.2 12h4.2" />
        }
        @case ('armor') {
          <path d="M12 2.4c2 1.6 4.6 2.4 7.6 2.4v6.4c0 5-3.3 8.8-7.6 10.4-4.3-1.6-7.6-5.4-7.6-10.4V4.8c3 0 5.6-.8 7.6-2.4Z" />
          <path d="M8.4 10.6h7.2M9.6 14.2h4.8" stroke-width="1.3" />
        }
        @case ('component') {
          <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" stroke-width="1.3" />
          <path d="M9 2v3.4M15 2v3.4M9 18.6V22M15 18.6V22M2 9h3.4M2 15h3.4M18.6 9H22M18.6 15H22" stroke-width="1.4" />
        }
        @case ('module') {
          <path d="M12 2.6 20.4 7.3v9.4L12 21.4l-8.4-4.7V7.3Z" /><path d="M3.6 7.3 12 12l8.4-4.7M12 12v9.4" stroke-width="1.4" />
        }
        @case ('tool') {
          <path d="M14.6 2.8a4.6 4.6 0 0 0-1.2 4.6L3.6 17.2a2 2 0 0 0 2.8 2.8l9.8-9.8a4.6 4.6 0 0 0 4.6-1.2l-2.6-.4-.6-2.6Z" />
        }
        @case ('item') {
          <path d="M4 8.2 12 4l8 4.2v8.4L12 20.8 4 16.6Z" /><path d="M4 8.2 12 12.4l8-4.2M12 12.4v8.4" stroke-width="1.4" />
          <path class="star-fill" stroke="none" d="M16.6 1.2Q16.96 2.64 18.4 3Q16.96 3.36 16.6 4.8Q16.24 3.36 14.8 3Q16.24 2.64 16.6 1.2Z" />
        }
        @case ('system') {
          <circle cx="12" cy="12" r="2.6" />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-18 12 12)" stroke-width="1.4" />
          <ellipse cx="12" cy="12" rx="6.4" ry="2.6" transform="rotate(-18 12 12)" stroke-width="1.2" />
          <circle cx="20.6" cy="9.2" r="1.3" fill="currentColor" stroke="none" />
        }
        @case ('planet') {
          <circle cx="12" cy="12" r="6.6" />
          <path d="M5.9 9.6C2.6 11 1 12.6 1.6 13.8c.9 1.9 6.4 1.2 12.2-1.6s9.8-6.4 8.9-8.3c-.5-1.1-2.6-1.3-5.4-.7" stroke-width="1.4" />
          <path class="star-fill" stroke="none" d="M19.4 15.6Q19.76 17.04 21.2 17.4Q19.76 17.76 19.4 19.2Q19.04 17.76 17.6 17.4Q19.04 17.04 19.4 15.6Z" />
        }
        @case ('moon') {
          <path d="M20.4 14.6A8.6 8.6 0 1 1 9.4 3.6a6.8 6.8 0 0 0 11 11Z" />
          <circle cx="9" cy="14" r="1.3" stroke-width="1.2" /><circle cx="13.6" cy="17.4" r="0.9" stroke-width="1.2" />
        }
        @case ('station') {
          <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8.4" stroke-dasharray="3.2 2.4" stroke-width="1.4" />
          <path d="M12 3.6V9M12 15v5.4M3.6 12H9M15 12h5.4" stroke-width="1.4" />
        }
        @case ('city') {
          <path d="M3 21h18M5 21V10.4l4-2.4V21M9 21V4.6l6 2.8V21M15 21v-8.6l4 2V21" />
          <path d="M11.4 9.6h1.2M11.4 13h1.2M11.4 16.4h1.2" stroke-width="1.3" />
        }
        @case ('outpost') {
          <path d="M3 20.4h18" /><path d="M5 20.4v-5.6a7 7 0 0 1 14 0v5.6" /><path d="M10 20.4v-3.6h4v3.6" stroke-width="1.4" />
          <path d="M12 7.8V3.2l3.4 1.4L12 6" stroke-width="1.4" />
        }
        @case ('jump') {
          <ellipse cx="12" cy="12" rx="9.4" ry="9.4" stroke-width="1.4" />
          <ellipse cx="12" cy="12" rx="5.6" ry="7.2" stroke-width="1.3" /><ellipse cx="12" cy="12" rx="2" ry="4.4" />
        }
        @case ('location') {
          <path d="M12 21.4s-6.8-6.1-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5.5-6.8 11.6-6.8 11.6Z" />
          <path class="star" stroke-width="1.3" d="M12 6.4Q12.68 9.12 15.4 9.8Q12.68 10.48 12 13.2Q11.32 10.48 8.6 9.8Q11.32 9.12 12 6.4Z" />
        }
        @case ('ore') {
          <path d="M7.2 3.4h9.6l4.6 6.4L12 21 2.6 9.8Z" /><path d="M2.6 9.8h18.8M9.4 3.4 7.8 9.8 12 21l4.2-11.2-1.6-6.4" stroke-width="1.3" />
        }
        @case ('refinery') {
          <path d="M4 21V9.6l4.4 2.6V9.6l4.4 2.6V4h4.4l1.2 17Z" /><path d="M2.6 21h18.8" />
          <path d="M14.6 1.4c1.4.6 1.6 1.6.8 2.6" stroke-width="1.3" />
          <path d="M7.6 16.4h1.6M11.6 16.4h1.6" stroke-width="1.3" />
        }
        @case ('price') {
          <path d="M3 12.6V4.2A1.2 1.2 0 0 1 4.2 3h8.4l8.4 8.4-9.6 9.6Z" />
          <circle cx="7.8" cy="7.8" r="1.6" />
          <path class="star-fill" stroke="none" d="M13.2 10.6Q13.6 12.2 15.2 12.6Q13.6 13 13.2 14.6Q12.8 13 11.2 12.6Q12.8 12.2 13.2 10.6Z" />
        }
        @case ('drill') {
          <path d="M3.4 20.6 10 14" /><path d="M8.2 12.2 11.8 15.8l3.6-1.2 6.2-6.2-4-4-6.2 6.2Z" />
          <path d="M14.2 6.8l3 3" stroke-width="1.3" />
          <path class="star-fill" stroke="none" d="M5.4 3.4Q5.84 5.16 7.6 5.6Q5.84 6.04 5.4 7.8Q4.96 6.04 3.2 5.6Q4.96 5.16 5.4 3.4Z" />
        }
        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2.2" /><path d="m3.6 17.4 5.2-5.4 4 4 2.6-2.6 4.8 4.6" />
          <path class="star-fill" stroke="none" d="M15.8 6.6Q16.24 8.36 18 8.8Q16.24 9.24 15.8 11Q15.36 9.24 13.6 8.8Q15.36 8.36 15.8 6.6Z" />
        }
        @case ('watch') {
          <path d="M1.8 12S5.6 5 12 5s10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12Z" /><circle cx="12" cy="12" r="3.2" />
          <path class="star-fill" stroke="none" d="M12 10.2Q12.36 11.64 13.8 12Q12.36 12.36 12 13.8Q11.64 12.36 10.2 12Q11.64 11.64 12 10.2Z" />
        }
        @case ('sync') {
          <path d="M20.4 11a8.4 8.4 0 0 0-15-4.6L3.4 8.6" /><path d="M3.4 3.6v5h5" />
          <path d="M3.6 13a8.4 8.4 0 0 0 15 4.6l2-2.2" /><path d="M20.6 20.4v-5h-5" />
        }
        @case ('link') {
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        }
      }
    </svg>
  `,
})
export class CatalogIconComponent {
  readonly key = input.required<CatalogIconKey>();
}

/** Icône de chaque famille du catalogue. */
export const FAMILY_ICONS: Record<string, CatalogIconKey> = {
  SHIP: 'ship', GROUND_VEHICLE: 'vehicle', POWER_SUIT: 'armor',
  FPS_WEAPON: 'weapon', SHIP_WEAPON: 'weapon', ARMOR: 'armor',
  SHIP_COMPONENT: 'component', MODULE: 'module', TOOL: 'tool', ITEM: 'item',
  SYSTEM: 'system', PLANET: 'planet', MOON: 'moon', CITY: 'city', STATION: 'station',
  JUMP_POINT: 'jump', OUTPOST: 'outpost', LOCATION: 'location', COMMODITY: 'ore'
};
