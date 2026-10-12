import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, shareReplay, startWith, Subject, switchMap, timeout } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../core/services/event/event.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { ParticipationPanelComponent, ParticipationsByStatus } from '../../shared/participation-panel/participation-panel.component';

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
}
interface ParticipationRow { status: number; userId?: string; user?: { id?: string; username?: string }; }
interface ObjectiveItem { kind: 'PRINCIPAL' | 'SECONDAIRE'; text: string; }
type OperationViewState =
  | { status: 'LOADING' }
  | { status: 'ERROR' }
  | { status: 'READY'; data: OperationPageModel };

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, FormsModule, ParticipationPanelComponent],
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
    map(response => ({ status: 'READY', data: response.data } as OperationViewState)),
    startWith({ status: 'LOADING' } as OperationViewState),
    catchError(() => of({ status: 'ERROR' } as OperationViewState)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly groups$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: Array<{ id: number; parentId?: number; name: string; description?: string; capacity?: number; assignmentMode: string }> }>(`/api/operations/${params.get('id')}/groups`)),
    map(response => response.data),
    catchError(() => of([]))
  );
  readonly ships$ = this.shipsRefresh$.pipe(
    startWith(undefined),
    switchMap(() => this.route.paramMap),
    switchMap(params => this.http.get<{ data: Array<{ id: string; shipId: number; ownerUserId: string; ownerUsername?: string; shipName?: string; shipImageUrl?: string; groupId?: number; requirementId?: string; status: string }> }>(`/api/operations/${params.get('id')}/ships`)),
    map(response => response.data),
    catchError(() => of([]))
  );
  readonly shipRequirements$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: Array<{ id: string; groupId?: number; shipModelId?: number; quantity: number; notes?: string; status: string }> }>(`/api/operations/${params.get('id')}/ship-requirements`)),
    map(response => response.data),
    catchError(() => of([]))
  );
  readonly hangar$ = this.eventService.getMyHangar().pipe(map(response => response.data), catchError(() => of([])));
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
      error: error => { this.assignmentMessage = error?.error?.message || 'Affectation impossible. La vérification a expiré.'; this.changeDetector.markForCheck(); }
    });
  }
  requestAssignment(operationId: string, groupId: number) {
    this.assignmentMessage = 'Envoi de la demande…';
    this.changeDetector.markForCheck();
    this.eventService.requestOperationGroup(operationId, groupId).pipe(timeout(10000)).subscribe({
      next: () => { this.assignmentMessage = 'Demande envoyée aux responsables.'; this.changeDetector.markForCheck(); },
      error: error => { this.assignmentMessage = error?.error?.message || 'Demande impossible. La vérification a expiré.'; this.changeDetector.markForCheck(); }
    });
  }
  proposeShip(operationId: string) {
    if (this.selectedShipId == null) return;
    this.eventService.proposeOperationShip(operationId, this.selectedShipId, this.selectedShipGroupId ?? undefined, this.selectedShipRequirementId ?? undefined).subscribe({ next: () => { this.assignmentMessage = 'Vaisseau proposé à l’opération.'; this.shipsRefresh$.next(); }, error: error => this.assignmentMessage = error?.error?.message || 'Proposition impossible.' });
  }

  withdrawShip(operationId: string, proposalId: string) {
    this.eventService.withdrawOperationShipProposal(operationId, proposalId).subscribe({
      next: () => { this.assignmentMessage = 'Proposition de vaisseau retirée.'; this.shipsRefresh$.next(); },
      error: error => this.assignmentMessage = error?.error?.message || 'Retrait impossible.'
    });
  }

  effectiveGroupMode(group: any, groups: any[]): string {
    let cursor = group;
    let depth = 0;
    while (cursor && depth++ <= 2) {
      if (cursor.assignmentMode && cursor.assignmentMode !== 'INHERITED') return cursor.assignmentMode;
      cursor = cursor.parentId == null ? null : groups.find(item => item.id === cursor.parentId);
    }
    return 'FREE';
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
        this.participationError = (typeof error?.error?.message === 'string' && error.error.message) || 'Votre réponse n’a pas été enregistrée. Veuillez réessayer.';
        this.toast.error(this.participationError);
        this.changeDetector.markForCheck();
      }
    });
  }

}
