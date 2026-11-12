import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvailabilityPeriod } from '../../core/services/availability/availability';

/** Pictogramme d'un créneau : lever de soleil, soleil, coucher, lune. */
@Component({
  selector: 'app-period-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      @switch (period()) {
        @case ('MORNING') {
          <path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 5v3M5.6 9.6l1.8 1.4M18.4 9.6l-1.8 1.4M9 21h6" />
        }
        @case ('AFTERNOON') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        }
        @case ('EVENING') {
          <path d="M4 16h16M7 16a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 9l2.5-2.5M8 20h8" />
        }
        @default {
          <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
          <path d="M17 4.5v2M16 5.5h2" />
        }
      }
    </svg>
  `
})
export class PeriodIconComponent {
  readonly period = input.required<AvailabilityPeriod>();
  readonly size = input(18);
}
