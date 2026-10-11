import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, shareReplay, startWith, Subject, switchMap, timeout } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../core/services/event/event.service';
import { AuthService } from '../../core/services/auth/auth.service';

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
interface ParticipationRow { status: number; userId?: string; user?: { id?: string }; }
interface ObjectiveItem { kind: 'PRINCIPAL' | 'SECONDAIRE'; text: string; }
type OperationViewState =
  | { status: 'LOADING' }
  | { status: 'ERROR' }
  | { status: 'READY'; data: OperationPageModel };

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, FormsModule],
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
  private readonly shipsRefresh$ = new Subject<void>();
  readonly operation$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: OperationPageModel }>(`/api/operations/${params.get('id')}`)),
    map(response => response.data),
    catchError(() => of(null))
  );
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
  readonly participation$ = this.route.paramMap.pipe(
    switchMap(params => this.eventService.getParticipations(params.get('id')!)),
    map((response: any) => (response?.data ?? []) as ParticipationRow[]),
    catchError(() => of([] as ParticipationRow[]))
  );
  readonly participationSummary$ = this.participation$.pipe(
    map(participations => {
      const currentUserId = this.authService.getUserIdFromToken();
      const own = participations.find(item => (item.userId || item.user?.id) === currentUserId);
      this.participationStatus = own?.status ?? null;
      return { total: participations.length, present: participations.filter(item => item.status === 1).length };
    })
  );
  selectedShipId: number | null = null;
  selectedShipGroupId: number | null = null;
  selectedShipRequirementId: string | null = null;
  participationStatus: number | null = null;
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
    this.assignmentMessage = '';
    this.eventService.setParticipationStatus(operationId, status).subscribe({
      next: () => { this.participationStatus = status; },
      error: error => this.assignmentMessage = error?.error?.message || 'Statut impossible à enregistrer.'
    });
  }
}
