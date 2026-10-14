import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Valeur échangée : « AAAA-MM-JJTHH:mm », heure locale, comme un champ datetime-local. */
const pad = (value: number): string => String(value).padStart(2, '0');
const toDate = (day: Date): string => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

/**
 * Date et heure en deux champs lisibles, avec des raccourcis de jour et d'heure et un rappel en toutes lettres.
 * Remplace le sélecteur datetime-local natif ; s'utilise avec [(ngModel)].
 */
@Component({
  selector: 'app-date-time-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-time-field.component.html',
  styleUrl: './date-time-field.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimeFieldComponent), multi: true }]
})
export class DateTimeFieldComponent implements ControlValueAccessor {
  /** Nom lu par les lecteurs d'écran : « Début », « Fin »… */
  readonly label = input('Date et heure');
  readonly invalid = input(false);
  /** Identifiant du message d'erreur ou d'aide associé aux deux champs. */
  readonly describedBy = input<string | null>(null);
  /** Heures proposées en raccourci. */
  readonly hours = input<number[]>([20, 21, 22]);

  private readonly changeDetector = inject(ChangeDetectorRef);
  date = '';
  time = '';
  disabled = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly days: ReadonlyArray<{ label: string; offset: () => Date }> = [
    { label: 'Aujourd’hui', offset: () => new Date() },
    { label: 'Demain', offset: () => { const day = new Date(); day.setDate(day.getDate() + 1); return day; } },
    { label: 'Samedi', offset: () => { const day = new Date(); day.setDate(day.getDate() + ((6 - day.getDay() + 7) % 7 || 7)); return day; } }
  ];

  writeValue(value: string | null | undefined): void {
    const text = (value ?? '').slice(0, 16);
    const [date, time] = text.includes('T') ? text.split('T') : ['', ''];
    this.date = date ?? '';
    this.time = time ?? '';
    this.changeDetector.markForCheck();
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; this.changeDetector.markForCheck(); }

  setDate(value: string): void { this.date = value; this.emit(); }
  setTime(value: string): void { this.time = value; this.emit(); }
  pickDay(day: Date): void { this.date = toDate(day); if (!this.time) this.time = '21:00'; this.emit(); }
  pickHour(hour: number): void { this.time = `${pad(hour)}:00`; if (!this.date) this.date = toDate(new Date()); this.emit(); }
  touched(): void { this.onTouched(); }

  isDay(day: Date): boolean { return this.date === toDate(day); }
  isHour(hour: number): boolean { return this.time === `${pad(hour)}:00`; }

  /** « mardi 14 octobre à 21:00 », ou rien tant que la date et l'heure ne sont pas complètes. */
  get summary(): string {
    if (!this.date || !this.time) return '';
    const value = new Date(`${this.date}T${this.time}`);
    if (Number.isNaN(value.getTime())) return '';
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(value);
    return `${day} à ${this.time}`;
  }

  /** Date et heure toutes deux saisies, ou toutes deux vides : jamais une valeur à moitié remplie. */
  private emit(): void {
    this.onChange(this.date && this.time ? `${this.date}T${this.time}` : '');
    this.onTouched();
    this.changeDetector.markForCheck();
  }
}
