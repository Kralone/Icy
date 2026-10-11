import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { EventService } from '../../core/services/event/event.service';

@Component({
  standalone: true,
  imports: [FormsModule, AsyncPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-editor.component.html',
  styleUrl: './operation-editor.component.css'
})
export class OperationEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  readonly operation$ = this.route.paramMap.pipe(
    switchMap(params => this.eventService.getOperationForEdit(params.get('id')!)),
    catchError(() => of(null)),
    tap(operation => { if (operation) this.form = { briefing: operation.briefing || '', objectives: operation.objectives || '', meetingPoint: operation.meetingPoint || '', imageUrl: operation.imageUrl || '', allowShipProposals: operation.allowShipProposals ?? false }; })
  );
  readonly groups$ = this.route.paramMap.pipe(switchMap(params => this.eventService.getOperationGroupsForEdit(params.get('id')!)), catchError(() => of({ data: [] })), tap(response => this.groups = response.data));
  groups: any[] = [];
  groupForm = { name: '', description: '', capacity: null as number | null, parentId: null as number | null, assignmentMode: 'INHERITED', sortOrder: 0 };
  form = { briefing: '', objectives: '', meetingPoint: '', imageUrl: '', allowShipProposals: false };
  tab: 'briefing' | 'objectifs' | 'organisation' | 'permissions' | 'publication' = 'briefing';
  saving = false;
  message = '';

  save(id: string) {
    this.saving = true;
    this.message = '';
    this.eventService.updateOperation(id, this.form).subscribe({ next: () => { this.saving = false; this.message = 'Brouillon enregistré.'; }, error: () => { this.saving = false; this.message = 'Impossible d’enregistrer le brouillon.'; } });
  }

  publish(id: string) {
    this.eventService.publishOperation(id).subscribe({ next: () => this.message = 'Opération publiée.', error: () => this.message = 'Publication impossible.' });
  }

  createGroup(operationId: string) {
    this.eventService.createOperationGroup(operationId, this.groupForm).subscribe({ next: () => {
      this.message = 'Groupe créé.';
      this.eventService.getOperationGroupsForEdit(operationId).subscribe(response => this.groups = response.data);
      this.groupForm = { name: '', description: '', capacity: null, parentId: null, assignmentMode: 'INHERITED', sortOrder: 0 };
    }, error: error => this.message = error?.error?.message || 'Création impossible.' });
  }
}
