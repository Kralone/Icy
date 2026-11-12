import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AvailabilityService } from '../../core/services/availability/availability.service';
import {
  AvailabilityMember, AVAILABILITY_DAYS, bestSlots, membersBySlot, periodLabel, slotKey, slotOfDateTime
} from '../../core/services/availability/availability';
import { PeriodIconComponent } from './period-icon.component';

/**
 * Indicateur discret pour planifier : les créneaux où le plus de membres sont habituellement là,
 * et, une fois la date choisie, combien le sont sur ce créneau. Rien ne s'affiche sans données.
 */
@Component({
  selector: 'app-availability-hint',
  standalone: true,
  imports: [PeriodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (best().length) {
      <p class="hint" aria-live="polite">
        <span class="hint-dot" aria-hidden="true"></span>
        <span class="hint-label">Membres dispo</span>
        @for (slot of best(); track $index) {
          <span class="hint-slot" [attr.data-period]="slot.period" [title]="slot.count + (slot.count > 1 ? ' membres' : ' membre') + ' habituellement disponibles'">
            <app-period-icon [period]="slot.period" [size]="12" />{{ shortDay(slot.day) }} {{ period(slot.period) }} <b>{{ slot.count }}</b>
          </span>
        }
        @if (chosen(); as chosen) {
          <span class="hint-chosen" [class.is-good]="chosen.good">
            · ce créneau : <b>{{ chosen.count }}</b>
          </span>
        }
      </p>
    }
  `,
  styles: [`
    :host { display: block; }
    .hint { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; margin: .4rem 0 0; font-size: .75rem; line-height: 1.4; color: rgba(148, 163, 184, .85); }
    .hint-dot { width: .4rem; height: .4rem; border-radius: 999px; background: #22d3ee; box-shadow: 0 0 6px #22d3ee; }
    .hint-label { color: rgba(148, 163, 184, .7); }
    .hint-slot { display: inline-flex; align-items: center; gap: .25rem; color: #cbd5e1; }
    .hint-slot app-period-icon { color: var(--p-ink, #67e8f9); }
    .hint-slot b, .hint-chosen b { font-weight: 600; color: #e2e8f0; font-variant-numeric: tabular-nums; }
    .hint-chosen.is-good b { color: #67e8f9; }
    [data-period='MORNING'] { --p-ink: #fcd34d; }
    [data-period='AFTERNOON'] { --p-ink: #7dd3fc; }
    [data-period='EVENING'] { --p-ink: #fdba74; }
    [data-period='NIGHT'] { --p-ink: #a5b4fc; }
  `]
})
export class AvailabilityHintComponent implements OnInit {
  private readonly service = inject(AvailabilityService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Date de début saisie, « AAAA-MM-JJTHH:mm ». */
  readonly startDateTime = input<string | null | undefined>('');

  private readonly members = signal<AvailabilityMember[]>([]);
  readonly best = computed(() => bestSlots(this.members(), 3));
  readonly chosen = computed(() => {
    const slot = slotOfDateTime(this.startDateTime());
    if (!slot || !this.best().length) return null;
    const count = membersBySlot(this.members()).get(slotKey(slot.day, slot.period))?.length ?? 0;
    return { count, good: count > 0 && count >= this.best()[this.best().length - 1].count };
  });

  ngOnInit(): void {
    if (!this.browser) return;
    // Indicateur facultatif : une erreur le laisse simplement masqué.
    this.service.members().subscribe({ next: members => this.members.set(members), error: () => undefined });
  }

  shortDay(day: number): string {
    return AVAILABILITY_DAYS.find(item => item.day === day)?.short ?? '';
  }

  period(value: Parameters<typeof periodLabel>[0]): string {
    return periodLabel(value).toLowerCase();
  }
}
