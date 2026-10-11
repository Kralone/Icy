import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event/event.service';
import { EventType } from '../../model/event-type.model';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './operation-create.component.html',
  styleUrl: './operation-create.component.css'
})
export class OperationCreateComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  types: EventType[] = [];
  saving = false;
  error = '';
  form = { title: '', type: '', description: '', startDateTime: '', endDateTime: '' };

  constructor() {
    this.eventService.getAllTypes().subscribe({ next: types => { this.types = types; }, error: () => this.error = 'Impossible de charger les types d’événement.' });
  }

  get previewType(): EventType | undefined { return this.types.find(type => type.name === this.form.type); }

  get invalid(): boolean { return !this.form.title.trim() || !this.form.type || !this.form.startDateTime || !this.form.endDateTime || this.saving; }

  create(): void {
    if (this.invalid) return;
    this.saving = true;
    this.error = '';
    this.eventService.createOperation(this.form).subscribe({
      next: operation => this.router.navigate(['/icy/operations', operation.eventId || operation.id, 'edit']),
      error: () => { this.saving = false; this.error = 'La création de l’opération a échoué.'; }
    });
  }
}
