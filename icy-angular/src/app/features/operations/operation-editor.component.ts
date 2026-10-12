import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService, CatalogEntry } from '../../core/services/catalog/catalog.service';
import { UserService } from '../../core/services/user/user.service';
import { User } from '../../model/user.model';
import { HotToastService } from '@ngxpert/hot-toast';

export interface OperationObjective {
  kind: 'PRINCIPAL' | 'SECONDAIRE';
  text: string;
}

type OperationEditorState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'READY'; operation: any };

@Component({
  standalone: true,
  imports: [FormsModule, AsyncPipe, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-editor.component.html',
  styleUrl: './operation-editor.component.css'
})
export class OperationEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly toast = inject(HotToastService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** Retour d'action ponctuel : toast lié à l'action, jamais un message persistant dans un autre onglet. */
  private notify(kind: 'success' | 'error', text: string): void {
    if (kind === 'success') this.toast.success(text); else this.toast.error(text);
  }

  selectTab(tab: OperationEditorComponent['tab']): void {
    this.tab = tab;
    // Le message inline ne concerne que l'enregistrement du formulaire de l'onglet courant.
    if (!this.saveError) this.message = '';
  }

  publicationLabel(status?: string | null): string {
    return status === 'PUBLISHED' ? 'Publiée' : status === 'DRAFT' ? 'Brouillon' : 'Statut inconnu';
  }
  private readonly catalogService = inject(CatalogService);
  private readonly userService = inject(UserService);
  readonly catalogResults = signal<CatalogEntry[]>([]);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');
  catalogQuery = '';
  selectedRequirementModel = signal<CatalogEntry | null>(null);
  readonly members$ = this.userService.getAllUsers().pipe(map(response => response.data as User[]), catchError(() => of([] as User[])));

  hasMember(members: User[], id: string | null): boolean {
    return !!id && members.some(member => member.id === id);
  }

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
  readonly operationState$ = this.route.paramMap.pipe(
    switchMap(params => this.eventService.getOperationForEdit(params.get('id')!)),
    map(operation => ({ kind: 'READY', operation } as OperationEditorState)),
    startWith({ kind: 'LOADING' } as OperationEditorState),
    catchError(() => of({ kind: 'ERROR', message: 'Impossible de charger le brouillon.' } as OperationEditorState)),
    tap(state => { if (state.kind === 'READY') this.form = { briefing: state.operation.briefing || '', objectives: this.parseObjectives(state.operation.objectives), meetingPoint: state.operation.meetingPoint || '', imageUrl: state.operation.imageUrl || '', allowShipProposals: state.operation.allowShipProposals ?? false }; })
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
  private readonly saveErrorState = signal(false);
  get saveError(): boolean { return this.saveErrorState(); }
  private lastSaveId: string | null = null;

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
    this.saveErrorState.set(false);
    this.lastSaveId = id;
    const payload = { ...this.form, objectives: JSON.stringify(this.form.objectives.filter(item => item.text.trim()).map(item => ({ kind: item.kind, text: item.text.trim() }))) };
    this.eventService.updateOperation(id, payload).subscribe({ next: () => { this.saving = false; this.message = 'Opération enregistrée.'; }, error: error => { this.saving = false; this.saveErrorState.set(true); this.message = (typeof error?.error?.message === 'string' && error.error.message) || 'Impossible d’enregistrer l’opération : vos saisies sont conservées.'; } });
  }

  retrySave(): void {
    if (this.lastSaveId) this.save(this.lastSaveId);
  }

  publishing = false;

  publish(operation: { id: string; publicationStatus?: string }) {
    if (this.publishing) return;
    this.publishing = true;
    this.eventService.publishOperation(operation.id).subscribe({
      next: updated => {
        this.publishing = false;
        operation.publicationStatus = updated?.publicationStatus ?? 'PUBLISHED';
        this.notify('success', 'Opération publiée : elle est visible dans le calendrier.');
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.publishing = false;
        this.notify('error', (typeof error?.error?.message === 'string' && error.error.message) || 'Publication impossible. L’opération reste en brouillon.');
        this.changeDetector.markForCheck();
      }
    });
  }

  createGroup(operationId: string) {
    const request = this.editingGroupId ? this.eventService.updateOperationGroup(operationId, this.editingGroupId, this.groupForm) : this.eventService.createOperationGroup(operationId, this.groupForm);
    request.subscribe({ next: () => {
      this.notify('success', this.editingGroupId ? 'Groupe mis à jour.' : 'Groupe créé.');
      this.eventService.getOperationGroupsForEdit(operationId).subscribe(response => this.groups = response.data);
      this.editingGroupId = null;
      this.groupForm = { name: '', description: '', capacity: null, parentId: null, assignmentMode: 'INHERITED', sortOrder: 0, responsibleUserId: null };
    }, error: error => this.notify('error', error?.error?.message || (this.editingGroupId ? 'Mise à jour du groupe impossible.' : 'Création du groupe impossible.')) });
  }

  editGroup(group: any): void { this.editingGroupId = group.id; this.groupForm = { name: group.name, description: group.description || '', capacity: group.capacity ?? null, parentId: group.parentId ?? null, assignmentMode: group.assignmentMode, sortOrder: group.sortOrder ?? 0, responsibleUserId: group.responsibleUserId ?? null }; }
  moveGroup(operationId: string, index: number, delta: number): void {
    const current = this.groups[index];
    const siblings = this.groups.filter(group => (group.parentId ?? null) === (current.parentId ?? null)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const siblingIndex = siblings.findIndex(group => group.id === current.id);
    const target = siblingIndex + delta;
    if (siblingIndex < 0 || target < 0 || target >= siblings.length) return;
    [siblings[siblingIndex], siblings[target]] = [siblings[target], siblings[siblingIndex]];
    this.eventService.reorderOperationGroups(operationId, siblings.map(group => group.id)).subscribe({ next: () => { const orderById = new Map(siblings.map((group, order) => [group.id, order])); this.groups = this.groups.map(group => orderById.has(group.id) ? { ...group, sortOrder: orderById.get(group.id) } : group).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)); this.notify('success', 'Ordre des groupes mis à jour.'); }, error: () => this.notify('error', 'Impossible de réordonner les groupes.') });
  }
  deleteGroup(operationId: string, group: any): void { if (!confirm(`Supprimer « ${group.name} » ? Les sous-groupes ou affectations existants doivent être traités avant cette action.`)) return; this.eventService.deleteOperationGroup(operationId, group.id).subscribe({ next: () => { this.notify('success', 'Groupe supprimé.'); this.eventService.getOperationGroupsForEdit(operationId).subscribe(response => this.groups = response.data); }, error: error => this.notify('error', error?.error?.message || 'Suppression impossible.') }); }
  decideAssignment(requestId: string, approve: boolean): void {
    const action = approve ? this.eventService.approveOperationAssignment(requestId) : this.eventService.refuseOperationAssignment(requestId);
    action.subscribe({ next: () => { this.notify('success', approve ? 'Demande approuvée.' : 'Demande refusée.'); this.assignmentRefresh.next(); }, error: error => this.notify('error', error?.error?.message || 'Décision impossible.') });
  }
  createShipRequirement(operationId: string): void {
    const request = this.editingRequirementId ? this.eventService.updateOperationShipRequirement(operationId, this.editingRequirementId, this.requirementForm) : this.eventService.createOperationShipRequirement(operationId, this.requirementForm);
    request.subscribe({ next: () => { this.notify('success', this.editingRequirementId ? 'Besoin de vaisseau mis à jour.' : 'Besoin de vaisseau créé.'); this.cancelShipRequirementEdit(); this.requirementRefresh.next(); }, error: error => this.notify('error', error?.error?.message || 'Enregistrement du besoin impossible.') });
  }
  deleteShipRequirement(operationId: string, requirementId: string): void {
    this.eventService.deleteOperationShipRequirement(operationId, requirementId).subscribe({ next: () => { this.notify('success', 'Besoin de vaisseau supprimé.'); this.requirementRefresh.next(); }, error: error => this.notify('error', error?.error?.message || 'Suppression du besoin impossible.') });
  }
  markShipUnavailable(operationId: string, proposalId: string): void {
    this.eventService.markOperationShipProposalUnavailable(operationId, proposalId).subscribe({
      next: () => { this.notify('success', 'Proposition marquée indisponible.'); this.shipRefresh.next(); },
      error: error => this.notify('error', error?.error?.message || 'Impossible de marquer la proposition indisponible.')
    });
  }
  setShipPilot(operationId: string, proposalId: string, pilotUserId: string | null): void {
    this.eventService.setOperationShipPilot(operationId, proposalId, pilotUserId).subscribe({
      next: () => { this.notify('success', pilotUserId ? 'Pilote affecté séparément du propriétaire.' : 'Pilote retiré.'); this.shipRefresh.next(); },
      error: error => this.notify('error', error?.error?.message || 'Impossible de modifier le pilote.')
    });
  }
}
