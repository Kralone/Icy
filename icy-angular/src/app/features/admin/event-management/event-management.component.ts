import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EventService, EventDTO } from '../../../core/services/event/event.service';
import { EventType } from '../../../model/event-type.model';

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './event-management.component.html',
})
export class EventManagementComponent implements OnInit {
  // === Création d’événement ===
  newEvent = {
    title: '',
    type: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
  };

  // === Liste des événements ===
  events: EventDTO[] = [];
  paginatedEvents: EventDTO[] = [];
  isLoadingEvents = false;

  // === Pagination Events ===
  currentPageEvents = 1;
  itemsPerPageEvents = 10;

  // === Types ===
  types: EventType[] = [];
  isLoadingTypes = false;

  // === État de création / édition ===
  isSubmitting = false;
  editingEvent: EventDTO | null = null;
  isUpdatingEvent = false;

  // === Types d’événements ===
  newType: EventType = { name: '', textColor: '', backgroundColor: '', imageUrl: '' };
  isTypeSubmitting = false;
  editingType: any = null;
  isTypeUpdating = false;

  constructor(private eventService: EventService, private router: Router) {}

  ngOnInit() {
    this.loadTypes();
    this.loadAllEvents();
  }

  // === Charger tous les événements ===
  loadAllEvents() {
    this.isLoadingEvents = true;
    this.eventService.getAll().subscribe({
      next: (response) => {
        // tri : plus récent en premier
        this.events = response.sort(
          (a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
        );

        // reset pagination si page out-of-range
        this.currentPageEvents = 1;
        this.updateEventsPagination();

        this.isLoadingEvents = false;
      },
      error: (err) => {
        console.error('Erreur chargement événements', err);
        this.isLoadingEvents = false;
      },
    });
  }

  // === Pagination helpers ===
  get totalPagesEvents(): number {
    return Math.max(1, Math.ceil(this.events.length / this.itemsPerPageEvents));
  }

  updateEventsPagination(): void {
    // clamp page
    if (this.currentPageEvents > this.totalPagesEvents) this.currentPageEvents = this.totalPagesEvents;
    if (this.currentPageEvents < 1) this.currentPageEvents = 1;

    const start = (this.currentPageEvents - 1) * this.itemsPerPageEvents;
    const end = start + this.itemsPerPageEvents;
    this.paginatedEvents = this.events.slice(start, end);
  }

  prevPageEvents(): void {
    if (this.currentPageEvents > 1) {
      this.currentPageEvents--;
      this.updateEventsPagination();
    }
  }

  nextPageEvents(): void {
    if (this.currentPageEvents < this.totalPagesEvents) {
      this.currentPageEvents++;
      this.updateEventsPagination();
    }
  }

  onItemsPerPageEventsChange(): void {
    this.currentPageEvents = 1;
    this.updateEventsPagination();
  }

  // === Charger les types ===
  loadTypes() {
    this.isLoadingTypes = true;
    this.eventService.getAllTypes().subscribe({
      next: (response) => {
        this.types = response;
        this.isLoadingTypes = false;
      },
      error: (err) => {
        console.error('Erreur chargement des types', err);
        this.isLoadingTypes = false;
      },
    });
  }

  // === Création ===
  get isFormInvalid(): boolean {
    const e = this.newEvent;
    return (
      !e.title.trim() ||
      !e.type.trim() ||
      !e.startDateTime ||
      !e.endDateTime ||
      this.isSubmitting
    );
  }

  createEvent() {
    if (this.isFormInvalid) return;
    this.isSubmitting = true;

    this.eventService.createEvent(this.newEvent).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.newEvent = { title: '', type: '', description: '', startDateTime: '', endDateTime: '' };
        this.loadAllEvents();
      },
      error: (err) => {
        console.error('Erreur création événement', err);
        this.isSubmitting = false;
      },
    });
  }

  // === Modifier un événement ===
  openEditEventModal(event: EventDTO) {
    this.editingEvent = {
      ...event,
      startDateTime: event.startDateTime.slice(0, 16),
      endDateTime: event.endDateTime.slice(0, 16),
    };
  }

  cancelEditEvent() {
    this.editingEvent = null;
  }

  updateEvent() {
    if (!this.editingEvent) return;
    this.isUpdatingEvent = true;

    const payload = {
      id: this.editingEvent.id,
      title: this.editingEvent.title,
      description: this.editingEvent.description,
      startDateTime: this.editingEvent.startDateTime,
      endDateTime: this.editingEvent.endDateTime,
      finished: this.editingEvent.finished ?? false,
      type: this.editingEvent.type?.name || (this.editingEvent as any).type
    };

    this.eventService.updateEvent(payload).subscribe({
      next: () => {
        this.isUpdatingEvent = false;
        this.editingEvent = null;
        this.loadAllEvents();
      },
      error: (err) => {
        console.error('Erreur mise à jour événement', err);
        this.isUpdatingEvent = false;
      },
    });
  }

  confirmDeleteEvent() {
    if (!this.editingEvent?.id) return;

    const confirmed = confirm(
      `Voulez-vous vraiment supprimer l’événement “${this.editingEvent.title}” ?`
    );
    if (!confirmed) return;

    this.isLoadingEvents = true;
    this.eventService.deleteEvent(this.editingEvent.id).subscribe({
      next: () => {
        this.isLoadingEvents = false;
        this.cancelEditEvent();
        this.loadAllEvents();
      },
      error: (err) => {
        console.error('Erreur suppression :', err);
        this.isLoadingEvents = false;
      },
    });
  }

  // === Types ===
  createType() {
    if (!this.newType.name.trim()) return;
    this.isTypeSubmitting = true;

    this.eventService.createType(this.newType).subscribe({
      next: () => {
        this.isTypeSubmitting = false;
        this.newType = { name: '', textColor: '', backgroundColor: '', imageUrl: '' };
        this.loadTypes();
      },
      error: (err) => {
        console.error('Erreur création type', err);
        this.isTypeSubmitting = false;
      },
    });
  }

  deleteType(name: string) {
    if (!confirm(`Supprimer le type "${name}" ?`)) return;

    this.eventService.deleteType(name).subscribe({
      next: () => this.loadTypes(),
      error: (err) => console.error('Erreur suppression type', err),
    });
  }

  editType(type: any) {
    this.editingType = { ...type };
  }

  cancelEditType() {
    this.editingType = null;
  }

  updateType() {
    if (!this.editingType) return;
    this.isTypeUpdating = true;

    this.eventService.updateEventType(this.editingType).subscribe({
      next: () => {
        this.isTypeUpdating = false;
        this.editingType = null;
        this.loadTypes();
      },
      error: (err) => {
        console.error('Erreur mise à jour type', err);
        this.isTypeUpdating = false;
      },
    });
  }
}
