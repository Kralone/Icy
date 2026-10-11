import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
export class OperationCreateComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  types: EventType[] = [];
  saving = false;
  error = '';
  form = { title: '', type: '', description: '', startDateTime: '', endDateTime: '', imageUrl: '', allowShipProposals: false };
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.eventService.getAllTypes().subscribe({
      next: types => types?.length ? this.types = types : this.loadTypesFromEvents(),
      error: () => this.loadTypesFromEvents()
    });
  }

  private loadTypesFromEvents(): void {
    this.eventService.getAll().subscribe({
      next: events => {
        const unique = new Map<string, EventType>();
        events.forEach(event => {
          const type = typeof event.type === 'string' ? event.type : event.type?.name;
          if (type && !unique.has(type)) {
            unique.set(type, typeof event.type === 'string'
              ? { name: type, textColor: '#b8f3ff', backgroundColor: '#123047', imageUrl: '' }
              : event.type);
          }
        });
        this.types = [...unique.values()];
        if (!this.types.length) this.error = 'Aucun type d’événement disponible pour créer l’opération.';
      },
      error: () => this.error = 'Impossible de charger les types d’événement.'
    });
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
