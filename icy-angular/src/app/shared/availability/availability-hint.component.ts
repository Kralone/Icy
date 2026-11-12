import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AvailabilityService } from '../../core/services/availability/availability.service';
import {
  AvailabilityMember, AvailabilityPeriod, bestSlots, membersBySlot, slotKey, slotLabel, slotOfDateTime
} from '../../core/services/availability/availability';
import { PeriodIconComponent } from './period-icon.component';

/**
 * Bloc discret pour planifier, à côté du formulaire : les créneaux où le plus de membres sont habituellement là,
 * et, une fois la date choisie, combien le sont sur ce créneau. Rien ne s'affiche sans données.
 */
@Component({
  selector: 'app-availability-hint',
  standalone: true,
  imports: [PeriodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (best().length) {
      <section class="hint" aria-labelledby="availability-hint-title">
        <p id="availability-hint-title" class="hint-title">Disponibilités des membres</p>
        <ol class="hint-list">
          @for (slot of best(); track $index) {
            <li class="hint-row">
              <app-period-icon [period]="slot.period" [size]="14" />
              <span class="hint-name">{{ label(slot.day, slot.period) }}</span>
              <span class="hint-bar" aria-hidden="true"><span [style.width.%]="share(slot.count)"></span></span>
              <b>{{ slot.count }}</b>
            </li>
          }
        </ol>
        @if (chosen(); as chosen) {
          <p class="hint-chosen" [class.is-good]="chosen.good" aria-live="polite">
            Créneau choisi, {{ chosen.label }} : <b>{{ chosen.count }}</b> {{ chosen.count > 1 ? 'membres' : 'membre' }}
          </p>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .hint { border-radius: .9rem; border: 1px solid rgba(148, 163, 184, .14); background: rgba(11, 19, 36, .55); padding: .85rem 1rem; color: #cbd5e1; font-size: .78rem; }
    .hint-title { margin: 0 0 .55rem; font-size: .72rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(148, 163, 184, .85); }
    .hint-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
    .hint-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 4rem 1.5rem; align-items: center; gap: .5rem; }
    .hint-row app-period-icon { color: rgba(103, 232, 249, .75); }
    .hint-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hint-bar { height: .25rem; border-radius: 999px; background: rgba(148, 163, 184, .15); overflow: hidden; }
    .hint-bar span { display: block; height: 100%; border-radius: inherit; background: #22d3ee; }
    .hint-row b, .hint-chosen b { font-weight: 600; color: #e2e8f0; text-align: right; font-variant-numeric: tabular-nums; }
    .hint-chosen { margin: .65rem 0 0; padding-top: .6rem; border-top: 1px solid rgba(148, 163, 184, .12); color: rgba(148, 163, 184, .9); }
    .hint-chosen.is-good b { color: #67e8f9; }
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
    return { count, label: slotLabel(slot.day, slot.period).toLowerCase(), good: count > 0 && count >= this.best()[this.best().length - 1].count };
  });

  ngOnInit(): void {
    if (!this.browser) return;
    // Indicateur facultatif : une erreur le laisse simplement masqué.
    this.service.members().subscribe({ next: members => this.members.set(members), error: () => undefined });
  }

  label(day: number, period: AvailabilityPeriod): string {
    return slotLabel(day, period);
  }

  share(count: number): number {
    return Math.round((count / Math.max(1, this.best()[0]?.count ?? 1)) * 100);
  }
}
