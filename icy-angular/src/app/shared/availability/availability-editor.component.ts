import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HotToastService } from '@ngxpert/hot-toast';
import { AvailabilityService } from '../../core/services/availability/availability.service';
import {
  AVAILABILITY_DAYS, AVAILABILITY_PERIODS, AvailabilityPeriod, AvailabilitySlot, slotKey, slotLabel
} from '../../core/services/availability/availability';
import { PeriodIconComponent } from './period-icon.component';

/**
 * Grille de saisie des disponibilités habituelles du joueur connecté.
 * Un appui sur une case l'active ou la désactive ; en glissant, les cases survolées prennent le même état.
 * Un appui sur un jour ou un créneau bascule toute la ligne ou toute la colonne.
 */
@Component({
  selector: 'app-availability-editor',
  standalone: true,
  imports: [PeriodIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './availability-editor.component.html',
  styleUrl: './availability-grid.css'
})
export class AvailabilityEditorComponent implements OnInit {
  private readonly service = inject(AvailabilityService);
  private readonly toast = inject(HotToastService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly days = AVAILABILITY_DAYS;
  readonly periods = AVAILABILITY_PERIODS;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly saved = signal<ReadonlySet<string>>(new Set());

  readonly count = computed(() => this.selected().size);
  readonly dirty = computed(() => {
    const current = this.selected();
    const saved = this.saved();
    return current.size !== saved.size || [...current].some(key => !saved.has(key));
  });

  /** État appliqué aux cases survolées pendant un glissement, null hors glissement. */
  private paintValue: boolean | null = null;

  ngOnInit(): void {
    if (!this.browser) return;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.mine().subscribe({
      next: slots => {
        const keys = new Set(slots.map(slot => slotKey(slot.day, slot.period)));
        this.selected.set(keys);
        this.saved.set(new Set(keys));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  key(day: number, period: AvailabilityPeriod): string {
    return slotKey(day, period);
  }

  isOn(day: number, period: AvailabilityPeriod): boolean {
    return this.selected().has(slotKey(day, period));
  }

  cellLabel(day: number, period: AvailabilityPeriod): string {
    return slotLabel(day, period);
  }

  rowFull(day: number): boolean {
    return this.periods.every(period => this.isOn(day, period.key));
  }

  columnFull(period: AvailabilityPeriod): boolean {
    return this.days.every(day => this.isOn(day.day, period));
  }

  onPointerDown(event: PointerEvent, day: number, period: AvailabilityPeriod): void {
    if (event.button !== 0 || this.saving()) return;
    event.preventDefault();
    this.paintValue = !this.isOn(day, period);
    this.set([slotKey(day, period)], this.paintValue);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.paintValue === null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
    const key = target?.dataset['slot'];
    if (key && this.selected().has(key) !== this.paintValue) this.set([key], this.paintValue);
  }

  endPaint(): void {
    this.paintValue = null;
  }

  /** Clavier : Entrée ou Espace sur une case (le pointeur est déjà traité à l'appui). */
  onKeyboardToggle(event: MouseEvent, day: number, period: AvailabilityPeriod): void {
    if (event.detail !== 0 || this.saving()) return;
    this.set([slotKey(day, period)], !this.isOn(day, period));
  }

  toggleDay(day: number): void {
    this.set(this.periods.map(period => slotKey(day, period.key)), !this.rowFull(day));
  }

  togglePeriod(period: AvailabilityPeriod): void {
    this.set(this.days.map(day => slotKey(day.day, period)), !this.columnFull(period));
  }

  clear(): void {
    this.selected.set(new Set());
  }

  reset(): void {
    this.selected.set(new Set(this.saved()));
  }

  save(): void {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    const slots: AvailabilitySlot[] = [];
    for (const day of this.days) {
      for (const period of this.periods) {
        if (this.isOn(day.day, period.key)) slots.push({ day: day.day, period: period.key });
      }
    }
    this.service.save(slots).subscribe({
      next: savedSlots => {
        const keys = new Set(savedSlots.map(slot => slotKey(slot.day, slot.period)));
        this.selected.set(keys);
        this.saved.set(new Set(keys));
        this.saving.set(false);
        this.toast.success('Disponibilités enregistrées.');
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || err?.error?.messageDetail?.message || 'Enregistrement impossible.');
      }
    });
  }

  private set(keys: string[], value: boolean): void {
    const next = new Set(this.selected());
    for (const key of keys) {
      if (value) next.add(key); else next.delete(key);
    }
    this.selected.set(next);
  }
}
