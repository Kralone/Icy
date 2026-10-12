import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, debounceTime, forkJoin, map, Observable, of, shareReplay, startWith, Subject, switchMap, tap } from 'rxjs';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService, CatalogEntry } from '../../core/services/catalog/catalog.service';
import { UserService } from '../../core/services/user/user.service';
import { User } from '../../model/user.model';
import { HotToastService } from '@ngxpert/hot-toast';
import { DraftAutosave } from './operation-autosave';
import { OperationConfirmService } from './operation-confirm.service';
import { EffectiveAssignmentMode, GroupMember } from './operation-group.model';
import { GroupSettings, OperationOrganization, OrganizationGroup, sortedChildren } from './organization/operation-organization.model';
import { OperationStructureTreeComponent } from './organization/operation-structure-tree.component';
import { GroupPanelTab, OperationGroupPanelComponent } from './organization/operation-group-panel.component';
import { OperationOverviewComponent } from './organization/operation-overview.component';
import { OperationCoordination, OperationCoordinationBoardComponent } from './organization/operation-coordination-board.component';
import { FleetRequirement, FleetShip, OperationFleetCardsComponent } from './organization/operation-fleet-cards.component';
import { OperationPreviewComponent } from './briefing/operation-preview.component';
import { OperationCrew } from './organization/operation-crew.model';
import { OperationCrewBuilderComponent } from './organization/operation-crew-builder.component';
import { OperationCrewPanelComponent } from './organization/operation-crew-panel.component';
import { OperationSheet } from './briefing/operation-sheet.model';
import { OperationIconComponent, OperationIconName } from './briefing/operation-icon.component';
import { eventColor, eventImage } from '../events/event-appearance';
import { ParticipationsByStatus } from '../../shared/participation-panel/participation-panel.component';

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
  defaultAssignmentMode: EffectiveAssignmentMode;
}

type OperationEditorState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'READY'; operation: any };

@Component({
  standalone: true,
  imports: [FormsModule, AsyncPipe, DatePipe, RouterLink, NgTemplateOutlet, OperationIconComponent, OperationStructureTreeComponent, OperationGroupPanelComponent, OperationCrewBuilderComponent, OperationCrewPanelComponent, OperationOverviewComponent, OperationCoordinationBoardComponent, OperationFleetCardsComponent, OperationPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-editor.component.html',
  styleUrls: ['./operation-editor.component.css', './operation-requirement-form.css']
})
export class OperationEditorComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly toast = inject(HotToastService);
  private readonly confirmService = inject(OperationConfirmService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** Retour d'action ponctuel : toast lié à l'action, jamais un message persistant dans un autre onglet. */
  private notify(kind: 'success' | 'error', text: string): void {
    if (kind === 'success') this.toast.success(text); else this.toast.error(text);
  }

  readonly tabs: ReadonlyArray<{ id: OperationEditorComponent['tab']; label: string; icon: OperationIconName }> = [
    { id: 'briefing', label: 'Général / briefing', icon: 'briefing' },
    { id: 'objectifs', label: 'Objectifs', icon: 'target' },
    { id: 'organisation', label: 'Organisation', icon: 'groups' },
    { id: 'permissions', label: 'Coordination', icon: 'assignment' },
    { id: 'publication', label: 'Aperçu / publication', icon: 'presence' }
  ];

  /** Couleurs du type d'événement : la paire par défaut s'applique si l'une des deux est invalide. */
  typeColors(operation: any): { accent: string; label: string } {
    const invalid = '#000000ff';
    const accent = eventColor(operation?.typeBackgroundColor, invalid);
    const label = eventColor(operation?.typeTextColor, invalid);
    return accent === invalid || label === invalid ? { accent: '#27647c', label: '#e3f4fb' } : { accent, label };
  }

  /** Image de la bannière : celle de la mission en cours de saisie, à défaut celle du type. */
  readonly bannerFailed = signal<ReadonlySet<string>>(new Set());
  bannerImage(operation: any): string | null {
    return [this.form.imageUrl, operation?.typeImageUrl].map(url => eventImage(url)).find(url => !!url && !this.bannerFailed().has(url)) ?? null;
  }
  bannerImageFailed(url: string): void { this.bannerFailed.update(failed => new Set(failed).add(url)); }

  selectTab(tab: OperationEditorComponent['tab']): void {
    if (this.crewBusy()) return;
    const open = () => {
      this.tab = tab;
      // Les inscriptions changent sans l'organisateur : la coordination est relue à chaque ouverture.
      if (tab === 'permissions' && this.operationId) this.loadCoordination(this.operationId);
      if (tab === 'publication') this.loadPreviewParticipations();
      // Un brouillon ne garde pas de saisie en attente derrière un onglet.
      if (this.autosave.auto) this.autosave.flush();
    };
    if (tab === this.tab) open(); else this.afterGroupSettings(open);
  }

  // --- Aperçu : la fiche telle que la verront les participants, sans aucune écriture.
  /** Réponses déjà données, pour une opération publiée ; null pour un brouillon ou tant qu'elles ne sont pas lues. */
  readonly previewParticipations = signal<ParticipationsByStatus | null>(null);
  readonly previewParticipationsState = signal<'none' | 'loading' | 'error' | 'ready'>('none');
  private previewLoadSeq = 0;

  private loadPreviewParticipations(): void {
    const seq = ++this.previewLoadSeq;
    this.previewParticipations.set(null);
    if (!this.operationId || this.currentOperation?.publicationStatus !== 'PUBLISHED') { this.previewParticipationsState.set('none'); return; }
    this.previewParticipationsState.set('loading');
    this.eventService.getParticipations(this.operationId).subscribe({
      next: (response: any) => {
        if (seq !== this.previewLoadSeq) return;
        const rows = (response?.data ?? []) as Array<{ status: number }>;
        this.previewParticipations.set({ confirmed: rows.filter(row => row.status === 1), maybe: rows.filter(row => row.status === 0), refused: rows.filter(row => row.status === -1) });
        this.previewParticipationsState.set('ready');
      },
      // Sans les réponses, l'aperçu le dit : ni listes vides ni compteur à zéro inventés.
      error: () => { if (seq === this.previewLoadSeq) this.previewParticipationsState.set('error'); }
    });
  }

  private previewCache: { key: string; sheet: OperationSheet } | null = null;

  /** L'opération avec les saisies en cours, enregistrées ou non : c'est elles que l'organisateur veut relire. */
  previewSheet(operation: any): OperationSheet {
    const payload = this.payload();
    const key = JSON.stringify([operation.id, operation.title, operation.startDateTime, operation.endDateTime, operation.revision, operation.publicationStatus, operation.locked, operation.started, payload]);
    if (this.previewCache?.key !== key) {
      this.previewCache = { key, sheet: { ...operation, briefing: payload.briefing, objectives: payload.objectives, meetingPoint: payload.meetingPoint, imageUrl: payload.imageUrl, allowShipProposals: payload.allowShipProposals } };
    }
    return this.previewCache.sheet;
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
  readonly members$ = this.userService.getAllUsers().pipe(map(response => response.data as User[]), catchError(() => of([] as User[])), shareReplay({ bufferSize: 1, refCount: true }));

  hasMember(members: User[], id: string | null): boolean {
    return !!id && members.some(member => member.id === id);
  }

  /** Recherche au fil de la frappe : la dernière saisie l'emporte, une réponse plus ancienne est ignorée. */
  private readonly catalogSearch$ = new Subject<string>();
  /** Vrai une fois qu'une recherche a abouti : « Aucun modèle » n'est dit qu'à ce moment-là. */
  readonly catalogSearched = signal(false);
  private readonly catalogSearchSubscription = this.catalogSearch$.pipe(
    map(query => query.trim()),
    tap(query => { this.catalogError.set(''); this.catalogSearched.set(false); this.catalogLoading.set(query.length >= 2); if (query.length < 2) this.catalogResults.set([]); }),
    debounceTime(250),
    switchMap(query => query.length < 2 ? of(null) : this.catalogService.browse({ query, family: 'SHIP', catalogGroup: 'ALL', status: 'ACTIVE', image: 'ALL', sort: 'name', page: 0, pageSize: 24 }).pipe(
      map(response => response.data.items),
      catchError(() => { this.catalogError.set('Le catalogue ne peut pas être chargé.'); return of(null); })))
  ).subscribe(items => {
    this.catalogLoading.set(false);
    if (items) { this.catalogResults.set(items); this.catalogSearched.set(true); }
  });

  searchRequirementModels(): void { this.catalogSearch$.next(this.catalogQuery); }

  selectRequirementModel(model: CatalogEntry): void {
    this.requirementForm.shipModelId = model.id;
    this.selectedRequirementModel.set(model);
    // Le choix est fait : la liste de résultats se referme.
    this.catalogQuery = '';
    this.catalogResults.set([]);
    this.catalogSearched.set(false);
  }

  clearRequirementModel(): void {
    this.requirementForm.shipModelId = null;
    this.selectedRequirementModel.set(null);
  }

  editShipRequirement(requirement: any): void {
    this.editingRequirementId = requirement.id;
    this.requirementForm = { groupId: requirement.groupId ?? null, shipModelId: requirement.shipModelId ?? null, quantity: requirement.quantity, notes: requirement.notes || '', status: requirement.status || 'OPEN' };
    // Le modèle déjà demandé reste affiché, avec son image, pendant la modification.
    this.selectedRequirementModel.set(requirement.shipModelId == null ? null : { id: requirement.shipModelId, name: requirement.shipModelName || 'Modèle inconnu', imageUrl: requirement.shipModelImageUrl ?? null } as CatalogEntry);
    this.catalogQuery = '';
    this.catalogResults.set([]);
    this.catalogSearched.set(false);
  }

  cancelShipRequirementEdit(): void {
    this.editingRequirementId = null;
    this.clearRequirementModel();
    this.catalogQuery = '';
    this.catalogSearch$.next('');
    this.requirementForm = { groupId: null, shipModelId: null, quantity: 1, notes: '', status: 'OPEN' };
  }
  readonly operationState$ = this.route.paramMap.pipe(
    switchMap(params => this.eventService.getOperationForEdit(params.get('id')!)),
    map(operation => ({ kind: 'READY', operation } as OperationEditorState)),
    startWith({ kind: 'LOADING' } as OperationEditorState),
    catchError(() => of({ kind: 'ERROR', message: 'Impossible de charger le brouillon.' } as OperationEditorState)),
    tap(state => { if (state.kind === 'READY') this.adoptServerState(state.operation); })
  );
  private readonly requirementRefresh = new BehaviorSubject<void>(undefined);
  private readonly shipRefresh = new BehaviorSubject<void>(undefined);
  /** Une lecture en échec ne doit ni passer pour une flotte vide, ni empêcher les lectures suivantes. */
  readonly fleetLoadError = signal(false);
  private fleetRead<T>(read: Observable<{ data: any[] }>): Observable<T[]> {
    return read.pipe(map(response => response.data as T[]), tap(() => this.fleetLoadError.set(false)), catchError(() => { this.fleetLoadError.set(true); return of([] as T[]); }));
  }
  readonly shipRequirements$ = this.route.paramMap.pipe(switchMap(params => this.requirementRefresh.pipe(switchMap(() => this.fleetRead<FleetRequirement>(this.eventService.getOperationShipRequirements(params.get('id')!))))), shareReplay({ bufferSize: 1, refCount: true }));
  readonly ships$ = this.route.paramMap.pipe(switchMap(params => this.shipRefresh.pipe(switchMap(() => this.fleetRead<FleetShip>(this.eventService.getOperationShips(params.get('id')!))))), shareReplay({ bufferSize: 1, refCount: true }));
  requirementForm = { groupId: null as number | null, shipModelId: null as number | null, quantity: 1, notes: '', status: 'OPEN' };
  editingRequirementId: string | null = null;
  form = { briefing: '', objectives: [] as OperationObjective[], meetingPoint: '', imageUrl: '', allowShipProposals: false, defaultAssignmentMode: 'FREE' as EffectiveAssignmentMode };

  // --- Organisation : structure lue sur le serveur, un seul groupe édité à la fois.
  readonly organization = signal<OperationOrganization | null>(null);
  readonly organizationGroups = computed<OrganizationGroup[]>(() => this.organization()?.groups ?? []);
  /** Groupes qui peuvent recevoir un besoin ou un membre : ceux qui n'ont pas de sous-groupes. */
  readonly leafGroups = computed(() => this.organizationGroups().filter(group => !group.container));
  readonly selectedGroupId = signal<number | null>(null);
  readonly selectedGroup = computed(() => this.organizationGroups().find(group => group.id === this.selectedGroupId()) ?? null);
  readonly groupPanelTab = signal<GroupPanelTab>('equipage');
  readonly organizationBusy = signal(false);
  readonly organizationError = signal('');
  /** Sur mobile, la fiche du groupe remplace l'arborescence. */
  readonly groupOpenOnMobile = signal(false);

  // --- Coordination : présents, affectations et demandes, relus sur le serveur après chaque action.
  readonly coordination = signal<OperationCoordination | null>(null);
  readonly coordinationBusy = signal(false);
  readonly coordinationError = signal('');
  private coordinationLoadSeq = 0;

  /** `afterAction` : la lecture qui suit une action, seule autorisée à rendre la main aux boutons. */
  loadCoordination(operationId: string, afterAction = false): void {
    const seq = ++this.coordinationLoadSeq;
    this.eventService.getOperationCoordination(operationId).subscribe({
      next: coordination => { if (afterAction) this.coordinationBusy.set(false); if (seq !== this.coordinationLoadSeq) return; this.coordination.set(coordination); this.coordinationError.set(''); },
      error: () => { if (afterAction) this.coordinationBusy.set(false); if (seq !== this.coordinationLoadSeq) return; this.coordinationError.set('La coordination n’a pas pu être chargée.'); }
    });
  }

  /** Une action de coordination : l'écran n'annonce le résultat qu'après la réponse du serveur, puis relit les effectifs. */
  private coordinate(operationId: string, action: import('rxjs').Observable<unknown>, success: string, failure: string): void {
    if (this.coordinationBusy()) return;
    this.coordinationBusy.set(true);
    action.subscribe({
      next: () => { this.notify('success', success); this.loadCoordination(operationId, true); this.loadOrganization(operationId); },
      error: error => {
        this.notify('error', this.organizationErrorMessage(error, failure));
        // L'état a pu changer entre-temps (place prise, demande déjà traitée) : on relit.
        this.loadCoordination(operationId, true);
      }
    });
  }

  assignMember(operationId: string, userId: string, groupId: number): void {
    this.coordinate(operationId, this.eventService.assignOperationMember(operationId, userId, groupId), 'Affectation enregistrée.', 'Affectation impossible.');
  }

  async removeMember(operationId: string, member: GroupMember): Promise<void> {
    if (!await this.confirmService.ask({ title: `Retirer ${member.username} de son groupe ?`, message: 'Ce membre reste inscrit Présent.', confirmLabel: 'Retirer du groupe', danger: true })) return;
    this.coordinate(operationId, this.eventService.removeOperationMember(operationId, member.userId), 'Membre retiré du groupe.', 'Retrait impossible.');
  }

  decideRequest(operationId: string, requestId: string, approve: boolean): void {
    const action = approve ? this.eventService.approveOperationAssignment(requestId) : this.eventService.refuseOperationAssignment(requestId);
    this.coordinate(operationId, action, approve ? 'Demande acceptée.' : 'Demande refusée.', 'Décision impossible.');
  }

  /** Réglages d'un groupe saisis mais pas encore enregistrés. */
  readonly groupSettingsDirty = signal(false);
  private organizationLoadSeq = 0;

  /** Équipages de vaisseau de l'opération, lus avec la structure : un groupe absent de cette liste est un groupe ordinaire. */
  readonly crews = signal<OperationCrew[]>([]);
  readonly crewsError = signal(false);
  readonly crewByGroup = computed(() => new Map(this.crews().map(crew => [crew.groupId, crew])));
  readonly crewIds = computed<ReadonlySet<number>>(() => new Set(this.crews().map(crew => crew.groupId)));
  readonly crewModels = computed<ReadonlyMap<number, string | null>>(() => new Map(this.crews().map(crew => [crew.groupId, crew.shipModelName])));
  /** undefined : constructeur fermé ; null : équipage autonome ; sinon le groupe principal proposé. */
  readonly crewBuilderParent = signal<number | null | undefined>(undefined);
  /** Équipage tout juste créé avec des postes personnalisés : son formulaire de poste s'ouvre d'emblée. */
  readonly crewPositionsFor = signal<number | null>(null);
  private crewsLoadSeq = 0;

  /** Une création ou une écriture d'équipage est en cours : son écran reste ouvert jusqu'à la réponse. */
  readonly crewBusy = signal(false);

  /** Nouvel essai après un échec : tant que les équipages ne sont pas lus, l'organisation reste en consultation. */
  loadCrews(operationId: string): void {
    const seq = ++this.crewsLoadSeq;
    this.eventService.getOperationCrews(operationId).subscribe({
      next: crews => { if (seq !== this.crewsLoadSeq) return; this.crews.set(crews); this.crewsError.set(false); },
      error: () => { if (seq !== this.crewsLoadSeq) return; this.crewsError.set(true); }
    });
  }

  openCrewBuilder(parentId: number | null): void {
    if (this.organizationBusy() || this.crewBusy() || this.crewsError() || !this.organization()) return;
    this.afterGroupSettings(() => { this.crewBuilderParent.set(parentId); this.groupOpenOnMobile.set(true); });
  }

  closeCrewBuilder(): void {
    this.crewBuilderParent.set(undefined);
    this.groupOpenOnMobile.set(false);
  }

  onCrewCreated(operationId: string, result: { groupId: number; openPositions: boolean; warning?: string }): void {
    this.crewBuilderParent.set(undefined);
    this.crewPositionsFor.set(result.openPositions ? result.groupId : null);
    this.groupPanelTab.set('equipage');
    this.groupOpenOnMobile.set(true);
    this.notify(result.warning ? 'error' : 'success', result.warning ?? 'Équipage créé.');
    this.loadOrganization(operationId, result.groupId);
    this.requirementRefresh.next();
  }

  /** Une écriture sur un équipage (poste, attribution) : effectifs et postes sont relus, ainsi que la coordination si elle est ouverte. */
  onCrewChanged(operationId: string): void {
    this.loadOrganization(operationId);
    if (this.coordination()) this.loadCoordination(operationId);
  }

  loadOrganization(operationId: string, selectId?: number | null): void {
    const seq = ++this.organizationLoadSeq;
    const crewsSeq = ++this.crewsLoadSeq;
    // Structure et équipages arrivent ensemble : un équipage n'est jamais montré, même un instant, comme un groupe ordinaire.
    forkJoin({ organization: this.eventService.getOperationOrganization(operationId), crews: this.eventService.getOperationCrews(operationId).pipe(catchError(() => of(null))) }).subscribe({
      next: ({ organization, crews }) => {
        // Seule la lecture la plus récente compte.
        if (seq !== this.organizationLoadSeq) return;
        if (crewsSeq === this.crewsLoadSeq) { if (crews) this.crews.set(crews); this.crewsError.set(!crews); }
        // Un mode par défaut choisi mais pas encore reçu par le serveur reste celui affiché.
        this.organization.set(this.withDefaultMode(organization, this.form.defaultAssignmentMode));
        this.organizationError.set('');
        if (selectId !== undefined) this.selectedGroupId.set(selectId);
        else if (this.selectedGroupId() !== null && !organization.groups.some(group => group.id === this.selectedGroupId())) this.selectedGroupId.set(null);
        if (this.selectedGroupId() === null) this.groupOpenOnMobile.set(false);
        if (!this.leafGroups().some(group => group.id === this.requirementForm.groupId)) this.requirementForm.groupId = null;
        this.organizationBusy.set(false);
      },
      error: () => { if (seq !== this.organizationLoadSeq) return; this.organizationBusy.set(false); this.organizationError.set('La structure de l’opération n’a pas pu être chargée.'); }
    });
  }

  /** Exécute l'action si l'on peut quitter la fiche du groupe : tout de suite s'il n'y a rien à perdre, sinon après abandon confirmé. */
  private afterGroupSettings(action: () => void): void {
    if (!this.groupSettingsDirty()) { action(); return; }
    this.confirmService.ask({ title: 'Abandonner les réglages du groupe ?', message: 'Les réglages de ce groupe ne sont pas enregistrés.', confirmLabel: 'Abandonner les réglages', cancelLabel: 'Continuer la saisie', danger: true }).then(confirmed => {
      if (!confirmed) return;
      this.groupSettingsDirty.set(false);
      action();
      this.changeDetector.markForCheck();
    });
  }

  selectGroup(id: number | null, tab: GroupPanelTab = 'equipage'): void {
    if (this.crewBusy()) return;
    this.crewBuilderParent.set(undefined);
    if (id === this.selectedGroupId()) { this.groupOpenOnMobile.set(id !== null); return; }
    this.afterGroupSettings(() => {
      this.crewPositionsFor.set(null);
      this.groupPanelTab.set(tab);
      this.selectedGroupId.set(id);
      this.groupOpenOnMobile.set(id !== null);
      if (!this.editingRequirementId) this.requirementForm.groupId = id !== null && this.leafGroups().some(group => group.id === id) ? id : null;
    });
  }

  private withDefaultMode(organization: OperationOrganization, mode: EffectiveAssignmentMode): OperationOrganization {
    const byId = new Map(organization.groups.map(group => [group.id, group]));
    const effective = (group: OrganizationGroup): EffectiveAssignmentMode => {
      if (group.assignmentMode !== 'INHERITED') return group.assignmentMode;
      const parent = group.parentId === null ? undefined : byId.get(group.parentId);
      return parent ? effective(parent) : mode;
    };
    return { defaultAssignmentMode: mode, groups: organization.groups.map(group => ({ ...group, effectiveMode: effective(group) })) };
  }

  /** Mode par défaut choisi à l'écran mais pas encore enregistré sur une opération publiée. */
  get defaultModeUnsaved(): boolean {
    return !this.autosave.auto && !!this.currentOperation && (this.currentOperation.defaultAssignmentMode ?? 'FREE') !== this.form.defaultAssignmentMode;
  }

  /** Création rapide : le groupe existe tout de suite avec un nom provisoire, ses réglages s'ouvrent pour le nommer. */
  quickAddGroup(operationId: string, parentId: number | null): void {
    if (this.organizationBusy() || this.crewBusy() || !this.organization()) return;
    this.crewBuilderParent.set(undefined);
    this.afterGroupSettings(() => {
      if (this.organizationBusy()) return;
      const siblings = sortedChildren(this.organizationGroups(), parentId);
      const base = parentId === null ? 'Nouveau groupe' : 'Nouveau sous-groupe';
      const taken = new Set(siblings.map(group => group.name.toLocaleLowerCase()));
      let name = base;
      for (let index = 2; taken.has(name.toLocaleLowerCase()); index++) name = `${base} ${index}`;
      this.organizationBusy.set(true);
      this.eventService.createOperationGroup(operationId, { name, description: '', capacity: null, parentId, assignmentMode: 'INHERITED', sortOrder: siblings.length, responsibleUserId: null }).subscribe({
        next: (response: any) => {
          this.groupPanelTab.set('reglages');
          this.groupOpenOnMobile.set(true);
          this.loadOrganization(operationId, response?.data?.id ?? null);
        },
        error: error => { this.organizationBusy.set(false); this.notify('error', this.organizationErrorMessage(error, 'Création du groupe impossible.')); }
      });
    });
  }

  saveGroup(operationId: string, groupId: number, settings: GroupSettings): void {
    if (this.organizationBusy()) return;
    this.organizationBusy.set(true);
    this.eventService.updateOperationGroup(operationId, groupId, settings).subscribe({
      next: () => { this.groupSettingsDirty.set(false); this.notify('success', 'Groupe enregistré.'); this.loadOrganization(operationId); },
      error: error => { this.organizationBusy.set(false); this.notify('error', this.organizationErrorMessage(error, 'Enregistrement du groupe impossible.')); }
    });
  }

  setDefaultMode(mode: EffectiveAssignmentMode): void {
    this.form.defaultAssignmentMode = mode;
    // Les groupes sans mode propre suivent aussitôt le nouveau défaut à l'écran.
    this.organization.update(organization => organization ? this.withDefaultMode(organization, mode) : organization);
    this.touch();
    // Brouillon : le serveur le reçoit tout de suite, sans attendre la temporisation.
    if (this.autosave.auto) this.autosave.flush();
  }

  private organizationErrorMessage(error: any, fallback: string): string {
    if (error?.status === 0) return 'Serveur injoignable. Rien n’a été modifié.';
    const message = (typeof error?.error?.message === 'string' && error.error.message) || '';
    // L'heure de fin est passée pendant que la page était ouverte : l'éditeur passe en lecture seule.
    if (error?.status === 409 && message.startsWith('Opération terminée') && this.currentOperation && !this.currentOperation.locked) {
      this.currentOperation.locked = true;
      this.changeDetector.markForCheck();
    }
    return message || fallback;
  }

  // --- Flotte : besoins et appareils proposés, relus sur le serveur après chaque action.
  readonly fleetBusy = signal(false);

  refreshFleet(): void {
    this.shipRefresh.next();
    this.requirementRefresh.next();
  }

  private fleetAction(action: Observable<unknown>, success: string, failure: string, done?: () => void): void {
    if (this.fleetBusy()) return;
    this.fleetBusy.set(true);
    action.subscribe({
      next: () => { this.fleetBusy.set(false); this.notify('success', success); done?.(); this.refreshFleet(); },
      error: error => { this.fleetBusy.set(false); this.notify('error', this.organizationErrorMessage(error, failure)); this.refreshFleet(); }
    });
  }

  acceptShip(operationId: string, proposalId: string): void {
    this.fleetAction(this.eventService.acceptOperationShipProposal(operationId, proposalId), 'Vaisseau accepté.', 'Acceptation impossible.');
  }

  declineShip(operationId: string, proposalId: string): void {
    this.fleetAction(this.eventService.declineOperationShipProposal(operationId, proposalId), 'Vaisseau refusé.', 'Refus impossible.');
  }

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
    ).pipe(tap(() => { if (this.currentOperation) this.currentOperation.defaultAssignmentMode = payload.defaultAssignmentMode; })),
    describeError: error => this.describeSaveError(error),
    onChange: () => this.changeDetector.markForCheck()
  });
  get saving(): boolean { return this.autosave.status === 'saving'; }
  get saveError(): boolean { return this.autosave.status === 'error'; }

  private adoptServerState(operation: any): void {
    this.operationId = operation.id;
    this.currentOperation = operation;
    // Version du serveur adoptée (autre opération, rechargement) : l'aperçu repart de ses propres lectures.
    this.previewCache = null;
    if (this.tab === 'publication') this.loadPreviewParticipations();
    this.lastValidImageUrl = operation.imageUrl || '';
    this.form = { briefing: operation.briefing || '', objectives: this.parseObjectives(operation.objectives), meetingPoint: operation.meetingPoint || '', imageUrl: operation.imageUrl || '', allowShipProposals: operation.allowShipProposals ?? false, defaultAssignmentMode: operation.defaultAssignmentMode ?? 'FREE' };
    this.loadOrganization(operation.id);
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
    if (this.imageUrlPending || this.groupSettingsDirty()) return false;
    if (!this.autosave.hasUnsavedChanges) return true;
    return this.autosave.auto && (this.autosave.status === 'dirty' || this.autosave.status === 'saving');
  }

  /** Garde de navigation interne : l'envoi des saisies en attente est fait par ngOnDestroy. */
  canLeave(): boolean | Promise<boolean> {
    return this.leavingIsSafe || this.confirmService.ask({ title: 'Quitter l’éditeur ?', message: 'Des modifications ne sont pas enregistrées et seront perdues.', confirmLabel: 'Quitter sans enregistrer', cancelLabel: 'Rester dans l’éditeur', danger: true });
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
    this.catalogSearchSubscription.unsubscribe();
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

  publish(operation: { id: string; publicationStatus?: string; defaultAssignmentMode?: string }) {
    // On ne publie que ce que le serveur a confirmé.
    if (this.publishing || this.autosave.hasUnsavedChanges || this.imageUrlPending) return;
    this.publishing = true;
    this.eventService.publishOperation(operation.id).subscribe({
      next: updated => {
        this.publishing = false;
        operation.publicationStatus = updated?.publicationStatus ?? 'PUBLISHED';
        if (this.tab === 'publication') this.loadPreviewParticipations();
        operation.defaultAssignmentMode = updated?.defaultAssignmentMode ?? operation.defaultAssignmentMode;
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

  moveGroup(operationId: string, group: OrganizationGroup, delta: -1 | 1): void {
    const siblings = sortedChildren(this.organizationGroups(), group.parentId ?? null);
    const index = siblings.findIndex(candidate => candidate.id === group.id);
    const target = index + delta;
    if (this.organizationBusy() || index < 0 || target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    this.organizationBusy.set(true);
    this.eventService.reorderOperationGroups(operationId, siblings.map(candidate => candidate.id)).subscribe({
      next: () => this.loadOrganization(operationId),
      error: error => { this.organizationBusy.set(false); this.notify('error', this.organizationErrorMessage(error, 'Impossible de réordonner les groupes.')); }
    });
  }

  async deleteGroup(operationId: string, group: OrganizationGroup): Promise<void> {
    if (this.organizationBusy()) return;
    if (!await this.confirmService.ask({ title: `Supprimer « ${group.name} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer le groupe', danger: true })) return;
    if (this.organizationBusy()) return;
    this.groupSettingsDirty.set(false);
    this.organizationBusy.set(true);
    this.eventService.deleteOperationGroup(operationId, group.id).subscribe({
      next: () => { this.notify('success', 'Groupe supprimé.'); this.groupOpenOnMobile.set(false); this.loadOrganization(operationId, group.parentId ?? null); },
      error: error => { this.organizationBusy.set(false); this.notify('error', this.organizationErrorMessage(error, 'Suppression impossible.')); }
    });
  }
  createShipRequirement(operationId: string): void {
    const editing = !!this.editingRequirementId;
    const request = this.editingRequirementId ? this.eventService.updateOperationShipRequirement(operationId, this.editingRequirementId, this.requirementForm) : this.eventService.createOperationShipRequirement(operationId, this.requirementForm);
    this.fleetAction(request, editing ? 'Besoin de vaisseau mis à jour.' : 'Besoin de vaisseau créé.', 'Enregistrement du besoin impossible.', () => this.cancelShipRequirementEdit());
  }
  async deleteShipRequirement(operationId: string, requirement: FleetRequirement): Promise<void> {
    if (!await this.confirmService.ask({ title: 'Supprimer ce besoin ?', message: 'Les vaisseaux proposés pour lui restent proposés, sans besoin lié.', confirmLabel: 'Supprimer le besoin', danger: true })) return;
    this.fleetAction(this.eventService.deleteOperationShipRequirement(operationId, requirement.id), 'Besoin de vaisseau supprimé.', 'Suppression du besoin impossible.', () => { if (this.editingRequirementId === requirement.id) this.cancelShipRequirementEdit(); });
  }
  setShipPilot(operationId: string, proposalId: string, pilotUserId: string | null): void {
    this.fleetAction(this.eventService.setOperationShipPilot(operationId, proposalId, pilotUserId), pilotUserId ? 'Pilote désigné.' : 'Pilote retiré.', 'Impossible de modifier le pilote.');
  }
}
