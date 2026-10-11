import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, switchMap } from 'rxjs';
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

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-page.component.html',
  styleUrl: './operation-page.component.css'
})
export class OperationPageComponent {
  private readonly http = inject(HttpClient);
  private readonly eventService = inject(EventService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly operation$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: OperationPageModel }>(`/api/operations/${params.get('id')}`)),
    map(response => response.data),
    catchError(() => of(null))
  );
  readonly groups$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: Array<{ id: number; parentId?: number; name: string; description?: string; capacity?: number; assignmentMode: string }> }>(`/api/operations/${params.get('id')}/groups`)),
    map(response => response.data),
    catchError(() => of([]))
  );
  readonly ships$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: Array<{ id: string; shipId: number; ownerUserId: string; ownerUsername?: string; shipName?: string; shipImageUrl?: string; groupId?: number; status: string }> }>(`/api/operations/${params.get('id')}/ships`)),
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
  participationStatus: number | null = null;
  assignmentMessage = '';
  isLeaf(group: { id: number }, groups: Array<{ parentId?: number }>) { return !groups.some(candidate => candidate.parentId === group.id); }
  assign(operationId: string, groupId: number) {
    this.assignmentMessage = '';
    this.eventService.assignOperationGroup(operationId, groupId).subscribe({ next: () => this.assignmentMessage = 'Affectation confirmée.', error: error => this.assignmentMessage = error?.error?.message || 'Affectation impossible.' });
  }
  requestAssignment(operationId: string, groupId: number) {
    this.assignmentMessage = '';
    this.eventService.requestOperationGroup(operationId, groupId).subscribe({ next: () => this.assignmentMessage = 'Demande envoyée aux responsables.', error: error => this.assignmentMessage = error?.error?.message || 'Demande impossible.' });
  }
  proposeShip(operationId: string) {
    if (this.selectedShipId == null) return;
    this.eventService.proposeOperationShip(operationId, this.selectedShipId, this.selectedShipGroupId ?? undefined).subscribe({ next: () => this.assignmentMessage = 'Vaisseau proposé à l’opération.', error: error => this.assignmentMessage = error?.error?.message || 'Proposition impossible.' });
  }
  setParticipation(operationId: string, status: number) {
    this.assignmentMessage = '';
    this.eventService.setParticipationStatus(operationId, status).subscribe({
      next: () => { this.participationStatus = status; },
      error: error => this.assignmentMessage = error?.error?.message || 'Statut impossible à enregistrer.'
    });
  }
}
