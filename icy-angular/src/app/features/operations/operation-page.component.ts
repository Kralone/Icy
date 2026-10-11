import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../core/services/event/event.service';

interface OperationPageModel {
  id: string;
  title: string;
  description?: string;
  briefing?: string;
  meetingPoint?: string;
  imageUrl?: string;
  startDateTime: string;
  endDateTime: string;
  finished: boolean;
}

@Component({
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-page.component.html',
  styleUrl: './operation-page.component.css'
})
export class OperationPageComponent {
  private readonly http = inject(HttpClient);
  private readonly eventService = inject(EventService);
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
  assignmentMessage = '';
  assign(operationId: string, groupId: number) {
    this.assignmentMessage = '';
    this.eventService.assignOperationGroup(operationId, groupId).subscribe({ next: () => this.assignmentMessage = 'Affectation confirmée.', error: error => this.assignmentMessage = error?.error?.message || 'Affectation impossible.' });
  }
}
