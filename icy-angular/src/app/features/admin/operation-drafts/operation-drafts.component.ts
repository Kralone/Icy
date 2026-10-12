import { ChangeDetectionStrategy, Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { DatePipe, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventDTO, EventService, OperationDraftSummary } from '../../../core/services/event/event.service';

/** Page « Opérations » de l'administration : opérations prévues, brouillons et historique. */
@Component({
  selector: 'app-operation-drafts',
  standalone: true,
  imports: [DatePipe, RouterLink, NgTemplateOutlet],
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

  /** Opérations publiées, lues dans la liste des événements. */
  private readonly published = signal<OperationDraftSummary[]>([]);
  private readonly finishedIds = signal<ReadonlySet<string>>(new Set());
  readonly publishedLoading = signal(false);
  readonly publishedError = signal('');
  /** Les plus proches d'abord. */
  readonly planned = computed(() => this.published().filter(operation => !this.finishedIds().has(operation.id))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)));
  /** Les plus récentes d'abord. */
  readonly past = computed(() => this.published().filter(operation => this.finishedIds().has(operation.id))
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime)));

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
    this.loadPublished();
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

  loadPublished(): void {
    this.publishedLoading.set(true);
    this.publishedError.set('');
    this.eventService.getAll().subscribe({
      next: events => {
        const operations = (events ?? []).filter(event => event.activityType === 'OPERATION');
        this.finishedIds.set(new Set(operations.filter(event => event.finished).map(event => event.id)));
        this.published.set(operations.map(event => this.toCard(event)));
        this.publishedLoading.set(false);
      },
      error: () => {
        this.publishedLoading.set(false);
        this.publishedError.set('Impossible de charger les opérations publiées.');
      }
    });
  }

  private toCard(event: EventDTO): OperationDraftSummary {
    return {
      id: event.id, title: event.title, type: event.type?.name, typeTextColor: event.type?.textColor,
      typeBackgroundColor: event.type?.backgroundColor, typeImageUrl: event.type?.imageUrl,
      startDateTime: event.startDateTime, endDateTime: event.endDateTime
    };
  }
}
