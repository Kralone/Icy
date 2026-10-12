import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService, CatalogEntry } from '../../core/services/catalog/catalog.service';
import { UserService } from '../../core/services/user/user.service';
import { User } from '../../model/user.model';
import { HotToastService } from '@ngxpert/hot-toast';
import { DraftAutosave } from './operation-autosave';

export interface OperationObjective {
  kind: 'PRINCIPAL' | 'SECONDAIRE';
  text: string;
}

interface OperationFormPayload {
  briefing: string;
  objectives: string;
  meetingPoint: string;
  imageUrl: string;
  allowShipProposals: boolean;
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
export class OperationEditorComponent implements OnDestroy {
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
    // Un brouillon ne garde pas de saisie en attente derrière un onglet.
    if (this.autosave.auto) this.autosave.flush();
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
    tap(state => { if (state.kind === 'READY') this.adoptServerState(state.operation); })
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
  private operationId: string | null = null;
  private currentOperation: any = null;
  /** Dernière adresse d'image valide : une adresse en cours de saisie ne bloque pas l'enregistrement du reste. */
  private lastValidImageUrl = '';
  /** Brouillon : autosauvegarde serveur. Opération publiée : enregistrement sur demande, pour ne pas diffuser chaque frappe. */
  readonly autosave = new DraftAutosave<OperationFormPayload>({
    delayMs: 1500,
    save: (payload, revision, options) => this.eventService.updateOperation(
      this.operationId!,
      { ...payload, expectedRevision: revision },
      // Au-delà de 64 Ko le navigateur refuse une requête keepalive.
      { keepalive: options.keepalive && new Blob([JSON.stringify(payload)]).size < 60000 }
    ),
    describeError: error => this.describeSaveError(error),
    onChange: () => this.changeDetector.markForCheck()
  });
  get saving(): boolean { return this.autosave.status === 'saving'; }
  get saveError(): boolean { return this.autosave.status === 'error'; }

  private adoptServerState(operation: any): void {
    this.operationId = operation.id;
    this.currentOperation = operation;
    this.lastValidImageUrl = operation.imageUrl || '';
    this.form = { briefing: operation.briefing || '', objectives: this.parseObjectives(operation.objectives), meetingPoint: operation.meetingPoint || '', imageUrl: operation.imageUrl || '', allowShipProposals: operation.allowShipProposals ?? false };
    this.autosave.auto = operation.publicationStatus !== 'PUBLISHED';
    this.autosave.reset(this.payload(), operation.revision ?? null, operation.updatedAt ? new Date(operation.updatedAt) : null);
  }

  /** Vrai tant que l'adresse saisie n'est pas une adresse http(s) complète : elle n'est alors pas envoyée. */
  get imageUrlPending(): boolean {
    const value = this.form.imageUrl.trim();
    if (!value) return false;
    if (/\s/.test(value)) return true;
    try {
      const url = new URL(value);
      return !(url.protocol === 'http:' || url.protocol === 'https:') || !url.hostname;
    } catch { return true; }
  }

  private payload(): OperationFormPayload {
    if (!this.imageUrlPending) this.lastValidImageUrl = this.form.imageUrl.trim();
    return { ...this.form, imageUrl: this.lastValidImageUrl, objectives: JSON.stringify(this.form.objectives.filter(item => item.text.trim()).map(item => ({ kind: item.kind, text: item.text.trim() }))) };
  }

  private describeSaveError(error: unknown): string {
    const response = error as { status?: number; error?: { message?: unknown } };
    if (response?.status === 409) return 'Cette opération a été modifiée depuis un autre onglet ou par un autre organisateur. « Garder ma version » remplace la version du serveur par vos saisies ; « Charger la version du serveur » les abandonne.';
    if (response?.status === 0 || response?.status === undefined) return 'Serveur injoignable. Vos saisies restent sur cette page ; elles partiront au prochain essai.';
    return (typeof response.error?.message === 'string' && response.error.message) || 'Enregistrement refusé. Vos saisies restent sur cette page.';
  }

  /** À appeler à chaque modification du formulaire. */
  touch(): void {
    if (this.operationId) this.autosave.update(this.payload());
  }

  /** Vrai si quitter la page maintenant ne perd rien : tout est confirmé, ou un brouillon peut encore partir. */
  private get leavingIsSafe(): boolean {
    if (this.imageUrlPending) return false;
    if (!this.autosave.hasUnsavedChanges) return true;
    return this.autosave.auto && (this.autosave.status === 'dirty' || this.autosave.status === 'saving');
  }

  /** Garde de navigation interne : l'envoi des saisies en attente est fait par ngOnDestroy. */
  canLeave(): boolean {
    return this.leavingIsSafe || confirm('Des modifications ne sont pas enregistrées. Quitter l’éditeur quand même ?');
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.autosave.auto) this.autosave.flush({ keepalive: true });
    if (!this.leavingIsSafe) event.preventDefault();
  }

  @HostListener('window:pagehide')
  @HostListener('document:visibilitychange')
  onPageHidden(): void {
    if (this.autosave.auto && document.visibilityState === 'hidden') this.autosave.flush({ keepalive: true });
  }

  ngOnDestroy(): void {
    // Navigation interne : la requête se termine après la destruction du composant.
    if (this.autosave.auto) this.autosave.flush();
  }

  reloadFromServer(): void {
    if (!this.operationId) return;
    this.eventService.getOperationForEdit(this.operationId).subscribe({
      next: operation => { this.adoptServerState(Object.assign(this.currentOperation, operation)); this.changeDetector.markForCheck(); },
      // L'éditeur et les saisies restent en place tant que la version du serveur n'est pas arrivée.
      error: () => this.notify('error', 'Serveur injoignable. Vos saisies sont toujours sur cette page.')
    });
  }

  keepLocalVersion(): void {
    if (!this.operationId) return;
    this.eventService.getOperationForEdit(this.operationId).subscribe({
      next: operation => {
        // Publiée entre-temps : la version locale part une fois, puis l'enregistrement redevient manuel.
        this.currentOperation.publicationStatus = operation.publicationStatus;
        this.autosave.auto = operation.publicationStatus !== 'PUBLISHED';
        this.autosave.overwriteFrom(operation.revision ?? null);
        this.changeDetector.markForCheck();
      },
      error: () => this.notify('error', 'Serveur injoignable. Réessayez dans un instant.')
    });
  }

  parseObjectives(value?: string | null): OperationObjective[] {
    if (!value?.trim()) return [{ kind: 'PRINCIPAL', text: '' }];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const objectives: OperationObjective[] = parsed.filter(item => item && typeof item.text === 'string').map(item => ({ kind: item.kind === 'SECONDAIRE' ? 'SECONDAIRE' : 'PRINCIPAL', text: item.text }));
        // Un brouillon enregistré sans objectif garde une ligne vide à remplir.
        return objectives.length ? objectives : [{ kind: 'PRINCIPAL', text: '' }];
      }
    } catch { /* Legacy plain text is preserved as one principal objective. */ }
    return [{ kind: 'PRINCIPAL', text: value }];
  }

  addObjective(kind: OperationObjective['kind'] = 'PRINCIPAL'): void { this.form.objectives.push({ kind, text: '' }); this.touch(); }
  removeObjective(index: number): void { if (this.form.objectives.length > 1) { this.form.objectives.splice(index, 1); this.touch(); } }
  moveObjective(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.form.objectives.length) return;
    const [item] = this.form.objectives.splice(index, 1);
    this.form.objectives.splice(target, 0, item);
    this.touch();
  }

  /** Enregistrement immédiat, sans attendre la temporisation. */
  save(): void {
    this.touch();
    this.autosave.flush();
  }

  retrySave(): void {
    this.autosave.retry();
  }

  publishing = false;

  publish(operation: { id: string; publicationStatus?: string }) {
    // On ne publie que ce que le serveur a confirmé.
    if (this.publishing || this.autosave.hasUnsavedChanges || this.imageUrlPending) return;
    this.publishing = true;
    this.eventService.publishOperation(operation.id).subscribe({
      next: updated => {
        this.publishing = false;
        operation.publicationStatus = updated?.publicationStatus ?? 'PUBLISHED';
        this.autosave.setRevision(updated?.revision);
        this.autosave.auto = false;
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
