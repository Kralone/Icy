import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScWorldEventService, ScWorldEvent, ScWorldEventType, Page } from '../../../../../core/services/scworldevent/sc-world-event.service';

@Component({
  selector: 'app-scwe-events-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './scwe-events-admin.component.html',
})
export class ScweEventsAdminComponent implements OnInit, OnChanges {
  @Input() types: ScWorldEventType[] = [];
  @Output() message = new EventEmitter<{ type: 'success' | 'error', text: string } | null>();

  loading = false;

  eventsPage: Page<ScWorldEvent> | null = null;
  events: ScWorldEvent[] = [];
  currentPage = 0;
  pageSize = 10;

  // SUPPRIMÉ : fromDateTimeLocal

  editingEvent: ScWorldEvent | null = null;
  eventForm = {
    title: '',
    description: '',
    startAtLocal: this.toDatetimeLocal(new Date()),
    endAtLocal: '',
    typeName: '',
    bannerImageUrl: '',
    gallery: '[]',
  };

  constructor(private api: ScWorldEventService) {}

  ngOnInit(): void {
    this.loadEvents(0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['types']) {
      if (!this.eventForm.typeName && this.types.length) this.eventForm.typeName = this.types[0].name;
    }
  }

  loadEvents(page = this.currentPage) {
    this.message.emit(null);
    this.loading = true;
    this.currentPage = page;

    this.api.getAll(this.currentPage, this.pageSize).subscribe({
      next: (p) => {
        this.eventsPage = p;
        this.events = p?.content ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible de charger les SC World Events.' });
      }
    });
  }

  createNew() {
    this.editingEvent = null;
    this.eventForm = {
      title: '',
      description: '',
      startAtLocal: this.toDatetimeLocal(new Date()),
      endAtLocal: '',
      typeName: this.types[0]?.name ?? '',
      bannerImageUrl: '',
      gallery: '[]',
    };
    this.message.emit(null);
  }

  editEvent(e: ScWorldEvent) {
    this.message.emit(null);
    this.editingEvent = e;

    this.eventForm = {
      title: e.title ?? '',
      description: e.description ?? '',
      startAtLocal: this.isoToLocal(e.startAt),
      endAtLocal: e.endAt ? this.isoToLocal(e.endAt) : '',
      typeName: e.typeName ?? (this.types[0]?.name ?? ''),
      bannerImageUrl: e.bannerImageUrl ?? '',
      gallery: this.prettyJson(e.gallery ?? '[]'),
    };
  }

  closeEvent(e: ScWorldEvent) {
    this.message.emit(null);
    if (!confirm(`Clôturer l'événement "${e.title}" maintenant ?\nCela définira la date de fin à l'instant présent.`)) {
      return;
    }

    const payload = {
      title: e.title,
      description: e.description || undefined,
      startAt: e.startAt,
      endAt: new Date().toISOString(),
      typeName: e.typeName,
      bannerImageUrl: e.bannerImageUrl || undefined,
      gallery: e.gallery || '[]'
    };

    this.loading = true;

    this.api.updateEvent(e.id, payload as any).subscribe({
      next: () => {
        this.loading = false;
        this.message.emit({ type: 'success', text: 'Événement clôturé avec succès.' });
        // Si on était en train d'éditer cet event, on vide le formulaire
        if (this.editingEvent?.id === e.id) {
          this.createNew();
        }
        this.loadEvents(this.currentPage);
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible de clôturer l\'événement.' });
      }
    });
  }

  saveEvent() {
    this.message.emit(null);

    if (!this.eventForm.title.trim()) {
      this.message.emit({ type: 'error', text: 'Le titre est requis.' });
      return;
    }
    if (!this.eventForm.startAtLocal) {
      this.message.emit({ type: 'error', text: 'startAt est requis.' });
      return;
    }
    if (!this.eventForm.typeName) {
      this.message.emit({ type: 'error', text: 'typeName est requis.' });
      return;
    }
    if (!this.isValidJson(this.eventForm.gallery || '[]')) {
      this.message.emit({ type: 'error', text: 'gallery doit être un JSON valide (tableau).' });
      return;
    }

    const payload = {
      title: this.eventForm.title.trim(),
      description: this.eventForm.description?.trim() || undefined,
      startAt: this.fromLocalToIso(this.eventForm.startAtLocal),
      endAt: this.eventForm.endAtLocal ? this.fromLocalToIso(this.eventForm.endAtLocal) : null,
      typeName: this.eventForm.typeName,
      bannerImageUrl: this.eventForm.bannerImageUrl?.trim() || undefined,
      gallery: this.eventForm.gallery?.trim() || '[]',
    };

    this.loading = true;
    const req = this.editingEvent
      ? this.api.updateEvent(this.editingEvent.id, payload)
      : this.api.createEvent(payload as any);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.message.emit({ type: 'success', text: this.editingEvent ? 'Event mis à jour.' : 'Event créé.' });
        this.createNew();
        this.loadEvents(0);
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible d’enregistrer le SC World Event.' });
      }
    });
  }

  deleteEvent(e: ScWorldEvent) {
    this.message.emit(null);
    if (!confirm(`Supprimer "${e.title}" ?`)) return;

    this.loading = true;
    this.api.deleteEvent(e.id).subscribe({
      next: () => {
        this.loading = false;
        this.message.emit({ type: 'success', text: 'Event supprimé.' });
        this.loadEvents(Math.max(0, this.currentPage));
        if (this.editingEvent?.id === e.id) this.createNew();
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible de supprimer le SC World Event.' });
      }
    });
  }

  prevPage() {
    if (!this.eventsPage || this.currentPage <= 0) return;
    this.loadEvents(this.currentPage - 1);
  }

  nextPage() {
    if (!this.eventsPage) return;
    if (this.currentPage + 1 >= this.eventsPage.totalPages) return;
    this.loadEvents(this.currentPage + 1);
  }

  // Helpers
  isEventActive(e: ScWorldEvent): boolean {
    if (!e.endAt) return true; // Pas de fin définie = actif
    return new Date(e.endAt).getTime() > Date.now();
  }

  isValidJson(str: string): boolean {
    try { JSON.parse(str); return true; } catch { return false; }
  }

  prettyJson(str: string): string {
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
  }

  toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  fromLocalToIso(local: string): string {
    return new Date(local).toISOString();
  }

  isoToLocal(iso: string): string {
    const d = new Date(iso);
    return this.toDatetimeLocal(d);
  }
}
