import { UserService } from '../../../core/services/user/user.service';
import { DateTimeFieldComponent } from '../../../shared/date-time-field/date-time-field.component';
import { SPECIALTIES, isOrganizer, referentPole } from '../../../core/services/user/member-rank';
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EventService, EventDTO } from '../../../core/services/event/event.service';
import { EventType } from '../../../model/event-type.model';

import { AvailabilityHintComponent } from '../../../shared/availability/availability-hint.component';
import { EventTypeManagerComponent } from './event-type-manager/event-type-manager.component';
@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [DateTimeFieldComponent, CommonModule, FormsModule, RouterModule, AvailabilityHintComponent, EventTypeManagerComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
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
    pole: '',
  };

  /** Pôles auxquels un événement peut être rattaché. */
  readonly poles = SPECIALTIES;

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
  isViewMode = false;

  // === Filtre par type ===
  selectedTypeFilter: string = 'ALL';
  filteredEvents: EventDTO[] = [];

  /** Types proposés à la création : les types archivés n'y figurent plus. */
  get activeTypes(): EventType[] {
    return this.types.filter(type => !type.archived);
  }

  /** Types proposés en modification : les types actifs, plus le type actuel de l'événement s'il est archivé. */
  get typesForEdit(): EventType[] {
    const current = this.editingEvent?.type?.name;
    return this.types.filter(type => !type.archived || type.name === current);
  }

  get previewType(): EventType | undefined {
    return this.types.find(t => t.name === this.newEvent.type);
  }


  /** Pôle imposé à un référent : il ne crée et ne gère que les événements de son pôle. Vide pour un organisateur. */
  lockedPole = '';
  private readonly userService = inject(UserService);

  constructor(private eventService: EventService) {}

  ngOnInit() {
    this.userService.getMyProfile().subscribe({
      next: response => {
        const roles = response?.data?.roles;
        this.lockedPole = isOrganizer(roles) ? '' : referentPole(roles, response?.data?.specialty) ?? '';
        if (this.lockedPole) this.newEvent.pole = this.lockedPole;
      },
      error: () => undefined
    });
    this.loadTypes();
    this.loadAllEvents();
  }

  // === Charger tous les événements ===
  loadAllEvents() {
    this.isLoadingEvents = true;
    this.eventService.getAll({ includeDrafts: true }).subscribe({
      next: (response) => {
        // tri : plus récent en premier
        this.events = response.sort(
          (a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
        );

        this.applyEventFilter(); // ⬅️ IMPORTANT
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
    return Math.max(1, Math.ceil(this.filteredEvents.length / this.itemsPerPageEvents));
  }

  updateEventsPagination(): void {
    const start = (this.currentPageEvents - 1) * this.itemsPerPageEvents;
    const end = start + this.itemsPerPageEvents;
    this.paginatedEvents = this.filteredEvents.slice(start, end);
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
        this.newEvent = { title: '', type: '', description: '', startDateTime: '', endDateTime: '', pole: this.lockedPole };
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
    this.isViewMode = false;
    this.editingEvent = {
      ...event,
      startDateTime: event.startDateTime.slice(0, 16),
      endDateTime: event.endDateTime.slice(0, 16),
    };
    this.originalDates = { start: this.editingEvent.startDateTime, end: this.editingEvent.endDateTime };
    this.keepParticipants = true;
  }

  /** Dates à l'ouverture de la modification : un changement propose de garder ou d'effacer les inscriptions. */
  private originalDates: { start: string; end: string } | null = null;
  /** Par défaut, les réponses déjà données sont gardées. */
  keepParticipants = true;
  /** Vrai pour un événement classique dont la date a été modifiée ; une opération garde toujours ses inscrits. */
  get datesChanged(): boolean {
    const editing = this.editingEvent;
    if (!editing || !this.originalDates || (editing as any).activityType === 'OPERATION') return false;
    return editing.startDateTime !== this.originalDates.start || editing.endDateTime !== this.originalDates.end;
  }

  openViewEventModal(event: EventDTO) {
    this.isViewMode = true;
    this.editingEvent = {
      ...event,
      startDateTime: event.startDateTime.slice(0, 16),
      endDateTime: event.endDateTime.slice(0, 16),
    };
  }

  cancelEditEvent() {
    this.editingEvent = null;
    this.isViewMode = false;
  }

  updateEvent() {
    if (!this.editingEvent || this.isViewMode) return;
    this.isUpdatingEvent = true;

    const payload = {
      id: this.editingEvent.id,
      title: this.editingEvent.title,
      description: this.editingEvent.description,
      startDateTime: this.editingEvent.startDateTime,
      endDateTime: this.editingEvent.endDateTime,
      finished: this.editingEvent.finished ?? false,
      type: this.editingEvent.type?.name || (this.editingEvent as any).type,
      keepParticipants: this.keepParticipants,
      pole: this.editingEvent.pole || null
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

  replanifyEventFromView() {
    if (!this.editingEvent) return;

    const confirmed = confirm(
      `Replanifier l'événement \"${this.editingEvent.title}\" ? Le formulaire d'ajout sera prérempli, avec les dates à renseigner.`
    );
    if (!confirmed) return;

    this.newEvent = {
      title: this.editingEvent.title || '',
      // Un type archivé n'est plus proposé : il faut en choisir un autre.
      type: this.activeTypes.some(type => type.name === this.editingEvent?.type?.name) ? this.editingEvent.type.name : '',
      description: this.editingEvent.description || '',
      startDateTime: '',
      endDateTime: '',
      pole: this.editingEvent.pole || '',
    };

    this.cancelEditEvent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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



  applyEventFilter(): void {
    if (this.selectedTypeFilter === 'ALL') {
      this.filteredEvents = [...this.events];
    } else {
      this.filteredEvents = this.events.filter(
        e => e.type?.name === this.selectedTypeFilter
      );
    }

    this.currentPageEvents = 1;
    this.updateEventsPagination();
  }

}
