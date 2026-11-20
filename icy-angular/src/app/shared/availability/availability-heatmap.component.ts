import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AvailabilityService } from '../../core/services/availability/availability.service';
import {
  AVAILABILITY_DAYS, AVAILABILITY_PERIODS, AvailabilityMember, AvailabilityPeriod,
  bestSlots, membersBySlot, slotKey, slotLabel
} from '../../core/services/availability/availability';
import { PeriodIconComponent } from './period-icon.component';

/**
 * Grille commune des disponibilités : plus une case est vive, plus il y a de membres disponibles.
 * Survol, focus ou appui sur une case : la liste des membres s'affiche dans le panneau.
 * Un membre choisi dans la liste éclaire ses propres créneaux.
 */
@Component({
  selector: 'app-availability-heatmap',
  standalone: true,
  imports: [PeriodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './availability-heatmap.component.html',
  styleUrl: './availability-grid.css'
})
export class AvailabilityHeatmapComponent implements OnInit {
  private readonly service = inject(AvailabilityService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly days = AVAILABILITY_DAYS;
  readonly periods = AVAILABILITY_PERIODS;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly members = signal<AvailabilityMember[]>([]);
  /** Case dont le panneau montre les membres (survol, focus ou appui). */
  readonly active = signal<{ day: number; period: AvailabilityPeriod } | null>(null);
  /** Case fixée par un appui : le survol ne la remplace pas. */
  readonly pinned = signal<string | null>(null);
  readonly focusedMember = signal<string | null>(null);

  readonly bySlot = computed(() => membersBySlot(this.members()));
  readonly filled = computed(() => this.members().filter(member => member.slots.length > 0));
  readonly max = computed(() => Math.max(1, ...[...this.bySlot().values()].map(list => list.length)));
  readonly best = computed(() => bestSlots(this.members(), 3));
  readonly bestKeys = computed(() => new Set(this.best().map(slot => slotKey(slot.day, slot.period))));
  readonly focusedSlots = computed(() => {
    const id = this.focusedMember();
    const member = id ? this.members().find(item => item.userId === id) : null;
    return member ? new Set(member.slots.map(slot => slotKey(slot.day, slot.period))) : null;
  });
  readonly activePeople = computed(() => {
    const cell = this.active();
    return cell ? this.bySlot().get(slotKey(cell.day, cell.period)) ?? [] : [];
  });

  ngOnInit(): void {
    if (!this.browser) return;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.members().subscribe({
      next: members => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  count(day: number, period: AvailabilityPeriod): number {
    return this.bySlot().get(slotKey(day, period))?.length ?? 0;
  }

  /** Intensité de 0 à 1, avec un plancher pour qu'une case à un membre se distingue d'une case vide. */
  level(day: number, period: AvailabilityPeriod): number {
    const count = this.count(day, period);
    return count === 0 ? 0 : 0.22 + 0.78 * (count / this.max());
  }

  isBest(day: number, period: AvailabilityPeriod): boolean {
    return this.bestKeys().has(slotKey(day, period));
  }

  isActive(day: number, period: AvailabilityPeriod): boolean {
    const cell = this.active();
    return !!cell && cell.day === day && cell.period === period;
  }

  isDimmed(day: number, period: AvailabilityPeriod): boolean {
    const slots = this.focusedSlots();
    return !!slots && !slots.has(slotKey(day, period));
  }

  isMine(day: number, period: AvailabilityPeriod): boolean {
    return !!this.focusedSlots()?.has(slotKey(day, period));
  }

  cellLabel(day: number, period: AvailabilityPeriod): string {
    const count = this.count(day, period);
    return `${slotLabel(day, period)} : ${count === 0 ? 'personne' : count === 1 ? '1 membre' : `${count} membres`}`;
  }

  label(day: number, period: AvailabilityPeriod): string {
    return slotLabel(day, period);
  }

  hover(day: number, period: AvailabilityPeriod): void {
    if (!this.pinned()) this.active.set({ day, period });
  }

  leave(): void {
    if (!this.pinned()) this.active.set(null);
  }

  pin(day: number, period: AvailabilityPeriod): void {
    const key = slotKey(day, period);
    if (this.pinned() === key) {
      this.pinned.set(null);
      return;
    }
    this.pinned.set(key);
    this.active.set({ day, period });
  }

  toggleMember(userId: string): void {
    this.focusedMember.set(this.focusedMember() === userId ? null : userId);
  }

  initial(name: string | null | undefined): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }
}
