import { ChangeDetectionStrategy, Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventService, OperationDraftSummary } from '../../../core/services/event/event.service';

@Component({
  selector: 'app-operation-drafts',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-drafts.component.html',
  styleUrl: './operation-drafts.component.css'
})
export class OperationDraftsComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly drafts = signal<OperationDraftSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.eventService.getOperationDrafts().subscribe({
      next: drafts => { this.drafts.set(drafts ?? []); this.loading.set(false); },
      error: error => {
        this.loading.set(false);
        this.error.set(error?.status === 403 ? 'Vous n’avez pas les droits pour consulter les brouillons.' : 'Impossible de charger les brouillons.');
      }
    });
  }
}
