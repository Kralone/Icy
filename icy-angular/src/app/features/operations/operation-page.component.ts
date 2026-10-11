import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface OperationPageModel {
  id: string;
  title: string;
  description?: string;
  briefing?: string;
  meetingPoint?: string;
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
  private readonly route = inject(ActivatedRoute);
  readonly operation$ = this.route.paramMap.pipe(
    switchMap(params => this.http.get<{ data: OperationPageModel }>(`/api/operations/${params.get('id')}`)),
    map(response => response.data),
    catchError(() => of(null))
  );
}
