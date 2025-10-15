import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {CollectionsService} from '../../../core/services/collection/collection.service';


type AxisItem = { label: string };

@Component({
  selector: 'app-collection-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './collection-management.component.html',
})
export class CollectionManagementComponent {

  // État local identique à l'ancien modal (avec {label:string})
  newTemplate: {
    name: string;
    archetype: string;
    axisX: AxisItem[];
    axisY: AxisItem[];
  } = {
    name: '',
    archetype: '',
    axisX: [{ label: '' }], // un champ vide par défaut pour UX
    axisY: [{ label: '' }],
  };

  isSubmitting = false;

  constructor(
    private service: CollectionsService,
    private router: Router
  ) {}

  // --- Gestion des axes ---

  addAxisValue(axis: 'x' | 'y') {
    const list = axis === 'x' ? this.newTemplate.axisX : this.newTemplate.axisY;
    list.push({ label: '' });
  }

  removeAxisValue(axis: 'x' | 'y', index: number) {
    const list = axis === 'x' ? this.newTemplate.axisX : this.newTemplate.axisY;
    if (list.length > 1) {
      list.splice(index, 1);
    } else {
      // on garde au moins une ligne pour UX : on vide simplement
      list[0].label = '';
    }
  }

  trackByIndex = (_: number, __: unknown) => _;

  get canCreate(): boolean {
    const nameOk = this.newTemplate.name.trim().length > 0;
    const archetypeOk = this.newTemplate.archetype.trim().length > 0;
    const axisXOk = this.newTemplate.axisX.some(a => a.label.trim().length > 0);
    const axisYOk = this.newTemplate.axisY.some(a => a.label.trim().length > 0);
    return nameOk && archetypeOk && axisXOk && axisYOk && !this.isSubmitting;
  }

  // --- Création ---

  async createTemplate() {
    if (!this.canCreate) return;

    this.isSubmitting = true;

    // Conversion {label}[] -> string[]
    const payload = {
      name: this.newTemplate.name.trim(),
      archetype: this.newTemplate.archetype.trim(),
      axisX: this.newTemplate.axisX
        .map(a => a.label.trim())
        .filter(Boolean),
      axisY: this.newTemplate.axisY
        .map(a => a.label.trim())
        .filter(Boolean),
    };

    try {
      await this.service.createTemplate(payload);
      // retour à la liste
      await this.router.navigate(['/collections']);
    } catch (error) {
      console.error('Erreur lors de la création du template :', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  cancel() {
    this.router.navigate(['/collections']);
  }
}
