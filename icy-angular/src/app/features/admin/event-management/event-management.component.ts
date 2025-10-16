import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {Router, RouterModule} from '@angular/router';
import { EventService } from '../../../core/services/event/event.service';
import { EventType } from '../../../model/event-type.model';

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './event-management.component.html',
})
export class EventManagementComponent implements OnInit {
  // 🧱 Gestion des événements
  newEvent = {
    title: '',
    type: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
  };
  types: EventType[] = [];
  isSubmitting = false;
  isLoadingTypes = false;

  editingType: any = null;
  isTypeUpdating = false;

  // 🧱 Gestion des types d'événements
  newType: EventType = { name: '', textColor: '', backgroundColor: '', imageUrl: '' };
  isTypeSubmitting = false;

  constructor(private eventService: EventService, private router: Router) {}

  ngOnInit() {
    this.loadTypes();
    this.loadEventTypes();
  }

  loadEventTypes() {
    this.isLoadingTypes = true;
    this.eventService.getAllTypes().subscribe({
      next: (types) => {
        this.types = types;
        this.isLoadingTypes = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des types', err);
        this.isLoadingTypes = false;
      }
    });
  }


  // === Événements ===
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
        this.router.navigate(['/events']);
      },
      error: (err) => {
        console.error('Erreur création événement', err);
        this.isSubmitting = false;
      },
    });
  }

  // === Types d'événements ===
  loadTypes() {
    this.eventService.getAllTypes().subscribe({
      next: (response) => (this.types = response),
      error: (err) => console.error('Erreur chargement des types', err),
    });
  }

  createType() {
    if (!this.newType.name.trim()) return;
    this.isTypeSubmitting = true;

    this.eventService.createType(this.newType).subscribe({
      next: () => {
        this.isTypeSubmitting = false;
        this.loadEventTypes();
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
    this.editingType = { ...type }; // clone pour éviter de modifier directement la liste
  }

  cancelEdit() {
    this.editingType = null;
  }

  updateType() {
    if (!this.editingType) return;
    this.isTypeUpdating = true;

    this.eventService.updateEventType(this.editingType).subscribe({
      next: () => {
        console.log('✅ Type modifié avec succès');
        this.isTypeUpdating = false;

        // 🔄 Recharge proprement la liste depuis le backend
        this.loadEventTypes();

        // 🔒 Ferme le modal s’il est ouvert
        const modal = document.getElementById('editTypeModal') as HTMLDialogElement;
        if (modal) modal.close();

        // 🧹 Réinitialise l’état local
        this.editingType = null;
      },
      error: (err) => {
        console.error('❌ Erreur mise à jour type', err);
        this.isTypeUpdating = false;
      },
    });
  }

}
