import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, switchMap, tap } from 'rxjs';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService, CatalogEntry } from '../../core/services/catalog/catalog.service';

export interface OperationObjective {
  kind: 'PRINCIPAL' | 'SECONDAIRE';
  text: string;
}

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
  private readonly catalogService = inject(CatalogService);
  readonly catalogResults = signal<CatalogEntry[]>([]);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');
  catalogQuery = '';
  selectedRequirementModel = signal<CatalogEntry | null>(null);

  searchRequirementModels(): void {
    this.catalogLoading.set(true);
    this.catalogError.set('');
    this.catalogService.browse({ query: this.catalogQuery, family: 'SHIP', catalogGroup: 'ALL', status: 'ACTIVE', image: 'ALL', sort: 'name', page: 0, pageSize: 60 }).subscribe({
      next: response => { this.catalogResults.set(response.data.items); this.catalogLoading.set(false); },
      error: () => { this.catalogError.set('Le catalogue ne peut pas être chargé. Réessayez.'); this.catalogLoading.set(false); }
    });
  }

  selectRequirementModel(model: CatalogEntry): void {
    this.requirementForm.shipModelId = model.id;
    this.selectedRequirementModel.set(model);
  }

  clearRequirementModel(): void {
    this.requirementForm.shipModelId = null;
    this.selectedRequirementModel.set(null);
  }

  editShipRequirement(requirement: any): void {
    this.editingRequirementId = requirement.id;
    this.requirementForm = { groupId: requirement.groupId ?? null, shipModelId: requirement.shipModelId ?? null, quantity: requirement.quantity, notes: requirement.notes || '', status: requirement.status || 'OPEN' };
    this.selectedRequirementModel.set(null);
    this.catalogQuery = '';
  }

  cancelShipRequirementEdit(): void {
    this.editingRequirementId = null;
    this.clearRequirementModel();
    this.requirementForm = { groupId: null, shipModelId: null, quantity: 1, notes: '', status: 'OPEN' };
  }
  readonly operation$ = this.route.paramMap.pipe(
    switchMap(params => this.eventService.getOperationForEdit(params.get('id')!)),
    catchError(() => of(null)),
    tap(operation => { if (operation) this.form = { briefing: operation.briefing || '', objectives: this.parseObjectives(operation.objectives), meetingPoint: operation.meetingPoint || '', imageUrl: operation.imageUrl || '', allowShipProposals: operation.allowShipProposals ?? false }; })
  );
  readonly groups$ = this.route.paramMap.pipe(switchMap(params => this.eventService.getOperationGroupsForEdit(params.get('id')!)), catchError(() => of({ data: [] })), tap(response => this.groups = response.data));
  private readonly assignmentRefresh = new BehaviorSubject<void>(undefined);
  private readonly requirementRefresh = new BehaviorSubject<void>(undefined);
  private readonly shipRefresh = new BehaviorSubject<void>(undefined);
  readonly shipRequirements$ = this.route.paramMap.pipe(switchMap(params => this.requirementRefresh.pipe(switchMap(() => this.eventService.getOperationShipRequirements(params.get('id')!)))), map(response => response.data), catchError(() => of([])));
  readonly ships$ = this.route.paramMap.pipe(switchMap(params => this.shipRefresh.pipe(switchMap(() => this.eventService.getOperationShips(params.get('id')!)))), map(response => response.data), catchError(() => of([])));
  readonly assignmentRequests$ = this.route.paramMap.pipe(switchMap(params => this.assignmentRefresh.pipe(switchMap(() => this.eventService.getOperationAssignmentRequests(params.get('id')!)))), map(response => response.data), catchError(() => of([])));
  private readonly groupState = signal<any[]>([]);
  get groups(): any[] { return this.groupState(); }
  set groups(value: any[]) { this.groupState.set(value); }
  groupForm = { name: '', description: '', capacity: null as number | null, parentId: null as number | null, assignmentMode: 'INHERITED', sortOrder: 0, responsibleUserId: null as string | null };
  requirementForm = { groupId: null as number | null, shipModelId: null as number | null, quantity: 1, notes: '', status: 'OPEN' };
  editingRequirementId: string | null = null;
  editingGroupId: number | null = null;
  form = { briefing: '', objectives: [] as OperationObjective[], meetingPoint: '', imageUrl: '', allowShipProposals: false };
  tab: 'briefing' | 'objectifs' | 'organisation' | 'permissions' | 'publication' = 'briefing';
  private readonly savingState = signal(false);
  get saving(): boolean { return this.savingState(); }
  set saving(value: boolean) { this.savingState.set(value); }
  private readonly messageState = signal('');
  get message(): string { return this.messageState(); }
  set message(value: string) { this.messageState.set(value); }

  parseObjectives(value?: string | null): OperationObjective[] {
    if (!value?.trim()) return [{ kind: 'PRINCIPAL', text: '' }];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(item => item && typeof item.text === 'string').map(item => ({ kind: item.kind === 'SECONDAIRE' ? 'SECONDAIRE' : 'PRINCIPAL', text: item.text }));
    } catch { /* Legacy plain text is preserved as one principal objective. */ }
    return [{ kind: 'PRINCIPAL', text: value }];
  }

  addObjective(kind: OperationObjective['kind'] = 'PRINCIPAL'): void { this.form.objectives.push({ kind, text: '' }); }
  removeObjective(index: number): void { if (this.form.objectives.length > 1) this.form.objectives.splice(index, 1); }
  moveObjective(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.form.objectives.length) return;
    const [item] = this.form.objectives.splice(index, 1);
    this.form.objectives.splice(target, 0, item);
  }

  save(id: string) {
    this.saving = true;
    this.message = '';
    const payload = { ...this.form, objectives: JSON.stringify(this.form.objectives.filter(item => item.text.trim()).map(item => ({ kind: item.kind, text: item.text.trim() }))) };
    this.eventService.updateOperation(id, payload).subscribe({ next: () => { this.saving = false; this.message = 'Brouillon enregistré.'; }, error: () => { this.saving = false; this.message = 'Impossible d’enregistrer le brouillon.'; } });
  }

  publish(id: string) {
    this.eventService.publishOperation(id).subscribe({ next: () => this.message = 'Opération publiée.', error: () => this.message = 'Publication impossible.' });
  }

  createGroup(operationId: string) {
    const request = this.editingGroupId ? this.eventService.updateOperationGroup(operationId, this.editingGroupId, this.groupForm) : this.eventService.createOperationGroup(operationId, this.groupForm);
    request.subscribe({ next: () => {
      this.message = this.editingGroupId ? 'Groupe mis à jour.' : 'Groupe créé.';
      this.eventService.getOperationGroupsForEdit(operationId).subscribe(response => this.groups = response.data);
      this.editingGroupId = null;
      this.groupForm = { name: '', description: '', capacity: null, parentId: null, assignmentMode: 'INHERITED', sortOrder: 0, responsibleUserId: null };
    }, error: error => this.message = error?.error?.message || 'Création impossible.' });
  }

  editGroup(group: any): void { this.editingGroupId = group.id; this.groupForm = { name: group.name, description: group.description || '', capacity: group.capacity ?? null, parentId: group.parentId ?? null, assignmentMode: group.assignmentMode, sortOrder: group.sortOrder ?? 0, responsibleUserId: group.responsibleUserId ?? null }; }
  moveGroup(operationId: string, index: number, delta: number): void {
    const current = this.groups[index];
    const siblings = this.groups.filter(group => (group.parentId ?? null) === (current.parentId ?? null)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const siblingIndex = siblings.findIndex(group => group.id === current.id);
    const target = siblingIndex + delta;
    if (siblingIndex < 0 || target < 0 || target >= siblings.length) return;
    [siblings[siblingIndex], siblings[target]] = [siblings[target], siblings[siblingIndex]];
    this.eventService.reorderOperationGroups(operationId, siblings.map(group => group.id)).subscribe({ next: () => { const orderById = new Map(siblings.map((group, order) => [group.id, order])); this.groups = this.groups.map(group => orderById.has(group.id) ? { ...group, sortOrder: orderById.get(group.id) } : group).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)); this.message = 'Ordre des groupes mis à jour.'; }, error: () => this.message = 'Impossible de réordonner les groupes.' });
  }
  deleteGroup(operationId: string, group: any): void { if (!confirm(`Supprimer « ${group.name} » ? Les sous-groupes ou affectations existants doivent être traités avant cette action.`)) return; this.eventService.deleteOperationGroup(operationId, group.id).subscribe({ next: () => { this.message = 'Groupe supprimé.'; this.eventService.getOperationGroupsForEdit(operationId).subscribe(response => this.groups = response.data); }, error: error => this.message = error?.error?.message || 'Suppression impossible.' }); }
  decideAssignment(requestId: string, approve: boolean): void {
    const action = approve ? this.eventService.approveOperationAssignment(requestId) : this.eventService.refuseOperationAssignment(requestId);
    action.subscribe({ next: () => { this.message = approve ? 'Demande approuvée.' : 'Demande refusée.'; this.assignmentRefresh.next(); }, error: error => this.message = error?.error?.message || 'Décision impossible.' });
  }
  createShipRequirement(operationId: string): void {
    const request = this.editingRequirementId ? this.eventService.updateOperationShipRequirement(operationId, this.editingRequirementId, this.requirementForm) : this.eventService.createOperationShipRequirement(operationId, this.requirementForm);
    request.subscribe({ next: () => { this.message = this.editingRequirementId ? 'Besoin de vaisseau mis à jour.' : 'Besoin de vaisseau créé.'; this.cancelShipRequirementEdit(); this.requirementRefresh.next(); }, error: error => this.message = error?.error?.message || 'Enregistrement du besoin impossible.' });
  }
  deleteShipRequirement(operationId: string, requirementId: string): void {
    this.eventService.deleteOperationShipRequirement(operationId, requirementId).subscribe({ next: () => { this.message = 'Besoin de vaisseau supprimé.'; this.requirementRefresh.next(); }, error: error => this.message = error?.error?.message || 'Suppression du besoin impossible.' });
  }
  markShipUnavailable(operationId: string, proposalId: string): void {
    this.eventService.markOperationShipProposalUnavailable(operationId, proposalId).subscribe({
      next: () => { this.message = 'Proposition marquée indisponible.'; this.shipRefresh.next(); },
      error: error => this.message = error?.error?.message || 'Impossible de marquer la proposition indisponible.'
    });
  }
}
