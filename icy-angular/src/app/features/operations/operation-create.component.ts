import { ChangeDetectorRef, Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { EventService } from '../../core/services/event/event.service';
import { EventType } from '../../model/event-type.model';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './operation-create.component.html',
  styleUrl: './operation-create.component.css'
})
export class OperationCreateComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly toast = inject(HotToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  types: EventType[] = [];
  typesLoading = false;
  typesError = '';
  saving = false;
  error = '';
  form = { title: '', type: '', description: '', startDateTime: '', endDateTime: '', imageUrl: '', allowShipProposals: false };

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadTypes();
  }

  /** Liste fermée : uniquement les types enregistrés côté serveur, sans reconstruction à partir des événements. */
  loadTypes(): void {
    this.typesLoading = true;
    this.typesError = '';
    this.eventService.getAllTypes().subscribe({
      next: types => {
        this.typesLoading = false;
        this.types = types ?? [];
        if (!this.types.length) this.typesError = 'Aucun type d’opération n’est configuré. Ajoutez-en un dans la gestion des événements.';
        if (this.form.type && !this.isKnownType(this.form.type)) this.form.type = '';
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.typesLoading = false;
        this.types = [];
        this.typesError = 'Impossible de charger les types d’opération.';
        this.changeDetector.markForCheck();
      }
    });
  }

  get previewType(): EventType | undefined { return this.types.find(type => type.name === this.form.type); }

  isKnownType(name: string): boolean { return this.types.some(type => type.name === name); }

  get datesInvalid(): boolean {
    return !!this.form.startDateTime && !!this.form.endDateTime && this.form.endDateTime <= this.form.startDateTime;
  }

  get invalid(): boolean {
    return !this.form.title.trim() || !this.isKnownType(this.form.type) || !this.form.startDateTime || !this.form.endDateTime || this.datesInvalid || this.saving;
  }

  create(): void {
    if (this.invalid) return;
    this.saving = true;
    this.error = '';
    this.eventService.createOperation({ ...this.form, title: this.form.title.trim() }).subscribe({
      next: operation => {
        this.saving = false;
        this.toast.success('Brouillon d’opération créé.');
        this.router.navigate(['/icy/operations', operation.eventId || operation.id, 'edit']);
      },
      error: error => {
        this.saving = false;
        // Sans réponse du serveur (status 0), error.error porte le message technique du navigateur, pas un message métier.
        const serverMessage = error?.status !== 0 && typeof error?.error?.message === 'string' ? error.error.message : '';
        this.error = serverMessage
          || (error?.status === 0 ? 'Serveur injoignable : l’opération n’a pas été créée. Vérifiez votre connexion puis réessayez.'
            : error?.status === 403 ? 'Vous n’avez pas les droits pour créer une opération.'
            : 'La création de l’opération a échoué. Rien n’a été enregistré ; réessayez.');
        this.toast.error(this.error);
        this.changeDetector.markForCheck();
      }
    });
  }
}
