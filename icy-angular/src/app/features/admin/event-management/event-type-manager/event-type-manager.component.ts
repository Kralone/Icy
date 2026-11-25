import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { HotToastService } from '@ngxpert/hot-toast';
import { EventService } from '../../../../core/services/event/event.service';
import { EventType, EventTypeRequest } from '../../../../model/event-type.model';
import { ColorFieldComponent } from '../../../../shared/color-field/color-field.component';
import { contrastRatio, normalizeHex } from '../../../../shared/color-field/color-math';
import { eventImage } from '../../../events/event-appearance';

/** Couleurs d'accent proposées : teintes soutenues, lisibles sous un texte clair. */
export const ACCENT_PRESETS = [
  '#27647c', '#0e7490', '#0f766e', '#15803d', '#4d7c0f', '#a16207', '#b45309', '#c2410c',
  '#b91c1c', '#be123c', '#a21caf', '#7e22ce', '#4338ca', '#1d4ed8', '#334155', '#1e293b',
] as const;
/** Couleurs d'étiquette proposées : claires pour les accents soutenus, sombres pour les accents clairs. */
export const LABEL_PRESETS = [
  '#ffffff', '#e3f4fb', '#aeeeff', '#bbf7d0', '#fde68a', '#fed7aa', '#fecdd3', '#e9d5ff',
  '#0b1220', '#1e293b',
] as const;

const DEFAULT_ACCENT = '#27647c';
const DEFAULT_LABEL = '#e3f4fb';
const READABLE = 4.5;

interface TypeForm { name: string; textColor: string; backgroundColor: string; imageUrl: string; }

/** Liste des types d'événement avec formulaire de création et d'édition, aperçu et archivage. */
@Component({
  selector: 'app-event-type-manager',
  standalone: true,
  imports: [ColorFieldComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-type-manager.component.html',
  styleUrl: './event-type-manager.component.css',
})
export class EventTypeManagerComponent {
  readonly types = input<EventType[]>([]);
  readonly loading = input(false);
  /** Émis après chaque création, modification, archivage ou suppression : le parent recharge la liste. */
  readonly changed = output<void>();

  readonly accentPresets = ACCENT_PRESETS;
  readonly labelPresets = LABEL_PRESETS;

  /** Type en cours d'édition ; null : création. */
  readonly editing = signal<EventType | null>(null);
  readonly form = signal<TypeForm>(emptyForm());
  readonly busy = signal(false);
  readonly formError = signal('');
  readonly submitted = signal(false);
  readonly imageFailed = signal(false);
  /** Nom du type dont la suppression attend confirmation. */
  readonly confirmDelete = signal<string | null>(null);
  /** Nom du type sur lequel une action est en cours. */
  readonly pending = signal<string | null>(null);
  readonly showArchived = signal(false);

  readonly activeTypes = computed(() => this.types().filter(type => !type.archived));
  readonly archivedTypes = computed(() => this.types().filter(type => type.archived));

  readonly nameError = computed(() => {
    const name = this.form().name.trim();
    if (!name) return 'Donnez un nom au type.';
    if (name.length > 100) return '100 caractères au plus.';
    if (/[\\/]/.test(name)) return 'Le nom ne peut pas contenir de barre oblique.';
    const original = this.editing()?.name;
    const duplicate = this.types().some(type => type.name !== original && type.name.toLowerCase() === name.toLowerCase());
    return duplicate ? 'Un type porte déjà ce nom.' : '';
  });
  readonly colorsValid = computed(() => !!normalizeHex(this.form().textColor) && !!normalizeHex(this.form().backgroundColor));
  readonly previewImage = computed(() => eventImage(this.form().imageUrl));
  readonly imageError = computed(() => {
    const url = this.form().imageUrl.trim();
    if (!url) return '';
    if (!this.previewImage()) return 'Adresse invalide : utilisez une adresse http(s) ou un chemin /img/…';
    if (url.length > 255) return '255 caractères au plus.';
    return this.imageFailed() ? 'L’image ne se charge pas à cette adresse.' : '';
  });
  readonly contrast = computed(() => {
    const text = normalizeHex(this.form().textColor), background = normalizeHex(this.form().backgroundColor);
    return text && background ? contrastRatio(text, background) : null;
  });
  readonly readable = computed(() => (this.contrast() ?? READABLE) >= READABLE);
  /** Couleur d'étiquette la plus lisible sur l'accent choisi. */
  readonly suggestedLabel = computed(() => {
    const background = normalizeHex(this.form().backgroundColor) ?? DEFAULT_ACCENT;
    return contrastRatio('#ffffff', background) >= contrastRatio('#0b1220', background) ? '#ffffff' : '#0b1220';
  });
  readonly canSubmit = computed(() => !this.busy() && !this.nameError() && this.colorsValid()
    && !(this.form().imageUrl.trim() && !this.previewImage()));
  readonly renaming = computed(() => {
    const editing = this.editing();
    return !!editing && editing.name !== this.form().name.trim() && !!this.form().name.trim();
  });

  readonly renameNote = computed(() => {
    const count = this.renaming() ? this.editing()?.usageCount ?? 0 : 0;
    if (!count) return '';
    return count === 1 ? 'L’activité qui l’utilise suivra le nouveau nom.' : `Les ${count} activités qui l’utilisent suivront le nouveau nom.`;
  });

  private readonly eventService = inject(EventService);
  private readonly toast = inject(HotToastService);

  update(field: keyof TypeForm, value: string): void {
    this.form.update(form => ({ ...form, [field]: value }));
    if (field === 'imageUrl') this.imageFailed.set(false);
    this.formError.set('');
  }

  inputValue(event: Event): string { return (event.target as HTMLInputElement).value; }

  /** {@code focus} : place le curseur dans le nom, utile sur mobile où le formulaire suit la liste. */
  startCreate(focus = false): void {
    this.editing.set(null);
    this.form.set(emptyForm());
    this.resetFormState();
    if (focus) this.focusName();
  }

  startEdit(type: EventType): void {
    this.editing.set(type);
    this.form.set({
      name: type.name,
      textColor: normalizeHex(type.textColor) ?? DEFAULT_LABEL,
      backgroundColor: normalizeHex(type.backgroundColor) ?? DEFAULT_ACCENT,
      imageUrl: type.imageUrl ?? '',
    });
    this.resetFormState();
    this.focusName();
  }

  submit(event?: Event): void {
    event?.preventDefault();
    this.submitted.set(true);
    if (!this.canSubmit()) return;
    const form = this.form();
    const request: EventTypeRequest = {
      name: form.name.trim(),
      textColor: normalizeHex(form.textColor)!,
      backgroundColor: normalizeHex(form.backgroundColor)!,
      imageUrl: form.imageUrl.trim() || null,
    };
    const editing = this.editing();
    this.busy.set(true);
    const call = editing ? this.eventService.updateEventType(editing.name, request) : this.eventService.createType(request);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(editing ? `Type « ${request.name} » enregistré.` : `Type « ${request.name} » créé.`);
        this.startCreate();
        this.changed.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(serverMessage(error, 'Enregistrement impossible.'));
      },
    });
  }

  askDelete(type: EventType): void { this.confirmDelete.set(type.name); }
  cancelDelete(): void { this.confirmDelete.set(null); }

  delete(type: EventType): void {
    this.pending.set(type.name);
    this.eventService.deleteType(type.name).subscribe({
      next: () => {
        this.pending.set(null);
        this.confirmDelete.set(null);
        if (this.editing()?.name === type.name) this.startCreate();
        this.toast.success(`Type « ${type.name} » supprimé.`);
        this.changed.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(null);
        this.confirmDelete.set(null);
        this.toast.error(serverMessage(error, 'Suppression impossible.'));
        // Un 409 signale que des activités l'utilisent : la liste à jour propose alors l'archivage.
        this.changed.emit();
      },
    });
  }

  setArchived(type: EventType, archived: boolean): void {
    this.pending.set(type.name);
    this.eventService.setTypeArchived(type.name, archived).subscribe({
      next: () => {
        this.pending.set(null);
        if (archived && this.editing()?.name === type.name) this.startCreate();
        this.toast.success(archived
          ? `« ${type.name} » archivé : il n’est plus proposé à la création.`
          : `« ${type.name} » est de nouveau proposé.`);
        this.changed.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(null);
        this.toast.error(serverMessage(error, archived ? 'Archivage impossible.' : 'Restauration impossible.'));
      },
    });
  }

  usageLabel(type: EventType): string {
    const count = type.usageCount ?? 0;
    if (!count) return 'Aucune activité';
    return count === 1 ? '1 activité' : `${count} activités`;
  }

  accent(type: EventType): string { return normalizeHex(type.backgroundColor) ?? DEFAULT_ACCENT; }
  label(type: EventType): string { return normalizeHex(type.textColor) ?? DEFAULT_LABEL; }
  image(type: EventType): string | null { return eventImage(type.imageUrl); }

  private focusName(): void {
    queueMicrotask(() => {
      const input = document.getElementById('event-type-name');
      input?.focus({ preventScroll: true });
      input?.closest('form')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  private resetFormState(): void {
    this.submitted.set(false);
    this.formError.set('');
    this.imageFailed.set(false);
  }
}

function emptyForm(): TypeForm {
  return { name: '', textColor: DEFAULT_LABEL, backgroundColor: DEFAULT_ACCENT, imageUrl: '' };
}

function serverMessage(error: HttpErrorResponse, fallback: string): string {
  if (error?.status === 401 || error?.status === 403) return 'Seuls les officiers et les administrateurs gèrent les types.';
  const message = error?.error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
