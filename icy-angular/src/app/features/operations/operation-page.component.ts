import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, Observable, of, shareReplay, startWith, Subject, switchMap, tap, timeout } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../core/services/event/event.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { ParticipationPanelComponent, ParticipationsByStatus } from '../../shared/participation-panel/participation-panel.component';
import { CoordinationMember, OperationCoordination, OperationCoordinationBoardComponent } from './organization/operation-coordination-board.component';
import { FleetRequirement, FleetShip, OperationFleetCardsComponent } from './organization/operation-fleet-cards.component';

interface OperationPageModel {
  id: string;
  title: string;
  description?: string;
  briefing?: string;
  objectives?: string;
  meetingPoint?: string;
  imageUrl?: string;
  allowShipProposals: boolean;
  startDateTime: string;
  endDateTime: string;
  finished: boolean;
  /** Heure de fin atteinte selon le serveur : organisation et flotte en lecture seule. */
  locked?: boolean;
  /** Mode des groupes qui n'en fixent pas un eux-mêmes. */
  defaultAssignmentMode?: string;
}
interface ParticipationRow { status: number; userId?: string; user?: { id?: string; username?: string }; }
interface ObjectiveItem { kind: 'PRINCIPAL' | 'SECONDAIRE'; text: string; }
type OperationViewState =
  | { status: 'LOADING' }
  | { status: 'ERROR' }
  | { status: 'READY'; data: OperationPageModel };

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, FormsModule, ParticipationPanelComponent, OperationCoordinationBoardComponent, OperationFleetCardsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-page.component.html',
  styleUrl: './operation-page.component.css'
})
export class OperationPageComponent {
  private readonly http = inject(HttpClient);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly eventService = inject(EventService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(HotToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shipsRefresh$ = new Subject<void>();
  readonly operationState$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: OperationPageModel }>(`/api/operations/${params.get('id')}`)),
    map(response => { this.defaultAssignmentMode = response.data.defaultAssignmentMode || 'FREE'; this.currentOperation = response.data; return { status: 'READY', data: response.data } as OperationViewState; }),
    startWith({ status: 'LOADING' } as OperationViewState),
    catchError(() => of({ status: 'ERROR' } as OperationViewState)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly groups$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: Array<{ id: number; parentId?: number; name: string; description?: string; capacity?: number; assignmentMode: string; responsibleUserId?: string }> }>(`/api/operations/${params.get('id')}/groups`)),
    map(response => response.data),
    // Le tableau de coordination n'est demandé que si un groupe est délégué à l'utilisateur.
    tap(groups => { const id = this.route.snapshot.paramMap.get('id'); if (id && groups.some(group => !!this.currentUserId && group.responsibleUserId === this.currentUserId)) this.loadCoordination(id); }),
    catchError(() => of([])),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly ships$ = this.shipsRefresh$.pipe(
    startWith(undefined),
    switchMap(() => this.route.paramMap),
    switchMap(params => this.http.get<{ data: FleetShip[] }>(`/api/operations/${params.get('id')}/ships`).pipe(
      map(response => { this.fleetLoadError = false; return response.data; }),
      // Une lecture en échec ne passe pas pour une flotte vide et n'empêche pas les suivantes.
      catchError(() => { this.fleetLoadError = true; this.changeDetector.markForCheck(); return of([] as FleetShip[]); })))
  );
  /** Relus avec les vaisseaux : une proposition change ce qu'il reste à couvrir. */
  readonly shipRequirements$ = this.shipsRefresh$.pipe(
    startWith(undefined),
    switchMap(() => this.route.paramMap),
    switchMap(params => this.http.get<{ data: FleetRequirement[] }>(`/api/operations/${params.get('id')}/ship-requirements`).pipe(
      map(response => response.data.filter(requirement => requirement.status !== 'CANCELLED')),
      catchError(() => { this.fleetLoadError = true; this.changeDetector.markForCheck(); return of([] as FleetRequirement[]); })))
  );
  fleetLoadError = false;
  reloadFleet(): void { this.shipsRefresh$.next(); }
  private currentOperation: OperationPageModel | null = null;
  fleetBusy = false;
  readonly hangar$ = this.eventService.getMyHangar().pipe(map(response => response.data), catchError(() => of([])));
  private defaultAssignmentMode = 'FREE';
  selectedShipId: number | null = null;
  selectedShipGroupId: number | null = null;
  selectedShipRequirementId: string | null = null;
  /** Présence : état issu du serveur uniquement (même logique que la modale historique du calendrier). */
  participationsByStatus: ParticipationsByStatus = { confirmed: [], maybe: [], refused: [] };
  participationStatus: number | null = null;
  participationLoading = false;
  participationSaving = false;
  participationError = '';
  private participationOperationId: string | null = null;
  private participationLoadSeq = 0;
  private static readonly STATUS_LABELS: Record<number, string> = { 1: 'Présent', 0: 'Peut-être', [-1]: 'Indisponible' };

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      // Une autre opération : le tableau de coordination de la précédente ne doit ni rester ni revenir par une réponse tardive.
      this.coordinationLoadSeq++;
      this.coordination = null;
      this.coordinationError = '';
      this.coordinationBusy = false;
      if (id) this.loadParticipations(id);
    });
  }

  loadParticipations(operationId: string): void {
    const seq = ++this.participationLoadSeq;
    this.participationOperationId = operationId;
    this.participationLoading = true;
    this.participationError = '';
    this.changeDetector.markForCheck();
    this.eventService.getParticipations(operationId).subscribe({
      next: (response: any) => {
        if (seq !== this.participationLoadSeq) return;
        const participations = (response?.data ?? []) as ParticipationRow[];
        const currentUserId = this.authService.getUserIdFromToken();
        const own = currentUserId ? participations.find(item => String(item.user?.id ?? item.userId) === String(currentUserId)) : undefined;
        this.participationStatus = own?.status ?? null;
        this.participationsByStatus = {
          confirmed: participations.filter(item => item.status === 1),
          maybe: participations.filter(item => item.status === 0),
          refused: participations.filter(item => item.status === -1)
        };
        this.participationLoading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (seq !== this.participationLoadSeq) return;
        this.participationLoading = false;
        this.participationError = 'Impossible de charger les participations.';
        this.changeDetector.markForCheck();
      }
    });
  }

  // --- Coordination déléguée : uniquement les groupes dont l'utilisateur est responsable.
  coordination: OperationCoordination | null = null;
  coordinationBusy = false;
  coordinationError = '';
  private coordinationLoadSeq = 0;

  loadCoordination(operationId: string): void {
    const seq = ++this.coordinationLoadSeq;
    this.eventService.getOperationCoordination(operationId).subscribe({
      next: coordination => { if (seq !== this.coordinationLoadSeq) return; this.coordination = coordination; this.coordinationError = ''; this.coordinationBusy = false; this.changeDetector.markForCheck(); },
      // Le dernier tableau lu reste affiché, avec l'erreur et un moyen de relire.
      error: () => { if (seq !== this.coordinationLoadSeq) return; this.coordinationError = 'La coordination n’a pas pu être relue.'; this.coordinationBusy = false; this.changeDetector.markForCheck(); }
    });
  }

  private coordinate(operationId: string, action: Observable<unknown>, success: string, failure: string): void {
    if (this.coordinationBusy) return;
    this.coordinationBusy = true;
    this.changeDetector.markForCheck();
    action.subscribe({
      next: () => { this.toast.success(success); this.loadCoordination(operationId); },
      error: error => {
        this.toast.error(this.fleetError(error, failure));
        this.loadCoordination(operationId);
      }
    });
  }

  assignMember(operationId: string, userId: string, groupId: number): void {
    this.coordinate(operationId, this.eventService.assignOperationMember(operationId, userId, groupId), 'Affectation enregistrée.', 'Affectation impossible.');
  }

  removeMember(operationId: string, member: CoordinationMember): void {
    if (!confirm(`Retirer ${member.username} de son groupe ? Ce membre reste inscrit Présent.`)) return;
    this.coordinate(operationId, this.eventService.removeOperationMember(operationId, member.userId), 'Membre retiré du groupe.', 'Retrait impossible.');
  }

  decideRequest(operationId: string, requestId: string, approve: boolean): void {
    const action = approve ? this.eventService.approveOperationAssignment(requestId) : this.eventService.refuseOperationAssignment(requestId);
    this.coordinate(operationId, action, approve ? 'Demande acceptée.' : 'Demande refusée.', 'Décision impossible.');
  }

  retryParticipations(): void {
    if (this.participationOperationId) this.loadParticipations(this.participationOperationId);
  }
  readonly currentUserId = this.authService.getUserIdFromToken();
  assignmentMessage = '';
  objectiveItems(value?: string): ObjectiveItem[] {
    if (!value?.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(item => item && typeof item.text === 'string').map(item => ({ kind: item.kind === 'SECONDAIRE' ? 'SECONDAIRE' : 'PRINCIPAL', text: item.text }));
    } catch { /* Legacy plain text remains readable below. */ }
    return [{ kind: 'PRINCIPAL', text: value }];
  }
  isLeaf(group: { id: number }, groups: Array<{ parentId?: number }>) { return !groups.some(candidate => candidate.parentId === group.id); }
  assign(operationId: string, groupId: number) {
    this.assignmentMessage = 'Vérification de la capacité…';
    this.changeDetector.markForCheck();
    this.eventService.assignOperationGroup(operationId, groupId).pipe(timeout(10000)).subscribe({
      next: () => { this.assignmentMessage = 'Affectation confirmée.'; this.changeDetector.markForCheck(); },
      error: error => { this.assignmentMessage = this.fleetError(error, 'Affectation impossible. La vérification a expiré.'); this.changeDetector.markForCheck(); }
    });
  }
  requestAssignment(operationId: string, groupId: number) {
    this.assignmentMessage = 'Envoi de la demande…';
    this.changeDetector.markForCheck();
    this.eventService.requestOperationGroup(operationId, groupId).pipe(timeout(10000)).subscribe({
      next: () => { this.assignmentMessage = 'Demande envoyée aux responsables.'; this.changeDetector.markForCheck(); },
      error: error => { this.assignmentMessage = this.fleetError(error, 'Demande impossible. La vérification a expiré.'); this.changeDetector.markForCheck(); }
    });
  }
  // --- Flotte : proposer un appareil de son hangar. Cela n'affecte personne à un groupe.
  ownedId(owned: any): number { return owned?.id?.shipId ?? owned?.ship?.id; }
  isProposed(shipId: number, ships: FleetShip[]): boolean { return ships.some(ship => ship.shipId === shipId && ship.ownerUserId === this.currentUserId); }
  leafGroups<T extends { id: number; parentId?: number }>(groups: T[]): T[] { return groups.filter(group => this.isLeaf(group, groups)); }
  /** Besoins encore ouverts auxquels l'appareil choisi peut répondre. */
  compatibleNeeds(requirements: FleetRequirement[]): FleetRequirement[] {
    return requirements.filter(requirement => requirement.status === 'OPEN' && requirement.accepted + requirement.proposed < requirement.quantity
      && (requirement.shipModelId === null || requirement.shipModelId === this.selectedShipId));
  }
  selectShip(shipId: number): void {
    this.selectedShipId = this.selectedShipId === shipId ? null : shipId;
    this.selectedShipRequirementId = null;
    this.selectedShipGroupId = null;
  }

  /** L'heure de fin est passée pendant que la page était ouverte : la fiche passe en lecture seule. */
  private fleetError(error: any, fallback: string): string {
    if (error?.status === 0) return 'Serveur injoignable. Rien n’a été modifié.';
    const message = (typeof error?.error?.message === 'string' && error.error.message) || '';
    if (error?.status === 409 && message.startsWith('Opération terminée') && this.currentOperation) this.currentOperation.locked = true;
    return message || fallback;
  }

  private fleetAction(action: Observable<unknown>, success: string, failure: string, done?: () => void): void {
    if (this.fleetBusy) return;
    this.fleetBusy = true;
    this.changeDetector.markForCheck();
    action.subscribe({
      next: () => { this.fleetBusy = false; this.toast.success(success); done?.(); this.shipsRefresh$.next(); this.changeDetector.markForCheck(); },
      error: error => { this.fleetBusy = false; this.toast.error(this.fleetError(error, failure)); this.shipsRefresh$.next(); this.changeDetector.markForCheck(); }
    });
  }

  proposeShip(operationId: string) {
    if (this.selectedShipId == null) return;
    this.fleetAction(this.eventService.proposeOperationShip(operationId, this.selectedShipId, this.selectedShipGroupId ?? undefined, this.selectedShipRequirementId ?? undefined),
      'Vaisseau proposé : l’organisateur doit encore l’accepter.', 'Proposition impossible.', () => { this.selectedShipId = null; this.selectedShipRequirementId = null; this.selectedShipGroupId = null; });
  }

  withdrawShip(operationId: string, ship: FleetShip) {
    if (!confirm(`Retirer ${ship.shipName || 'ce vaisseau'} de l’opération ?`)) return;
    this.fleetAction(this.eventService.withdrawOperationShipProposal(operationId, ship.id), 'Proposition de vaisseau retirée.', 'Retrait impossible.');
  }

  effectiveGroupMode(group: any, groups: any[]): string {
    let cursor = group;
    let depth = 0;
    while (cursor && depth++ <= 2) {
      if (cursor.assignmentMode && cursor.assignmentMode !== 'INHERITED') return cursor.assignmentMode;
      cursor = cursor.parentId == null ? null : groups.find(item => item.id === cursor.parentId);
    }
    return this.defaultAssignmentMode;
  }

  groupModeLabel(group: any, groups: any[]): string {
    const mode = this.effectiveGroupMode(group, groups);
    return mode === 'VALIDATION' ? 'Sur validation' : mode === 'MANAGED' ? 'Géré par les responsables' : 'Libre';
  }
  setParticipation(operationId: string, status: number) {
    if (this.participationSaving) return;
    this.participationSaving = true;
    this.participationError = '';
    this.changeDetector.markForCheck();
    this.eventService.setParticipationStatus(operationId, status).subscribe({
      next: () => {
        this.participationSaving = false;
        this.toast.success(`Présence enregistrée : ${OperationPageComponent.STATUS_LABELS[status]}.`);
        // Les compteurs et listes sont relus côté serveur, jamais incrémentés localement.
        this.loadParticipations(operationId);
      },
      error: error => {
        this.participationSaving = false;
        // L'alerte du panneau suffit (comme dans la modale du calendrier) ; sans réponse du serveur, error.error porte un message technique du navigateur.
        this.participationError = (error?.status !== 0 && typeof error?.error?.message === 'string' && error.error.message) || 'Votre réponse n’a pas été enregistrée. Veuillez réessayer.';
        this.changeDetector.markForCheck();
      }
    });
  }

}
