
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CigFeedResponse,
  CigRawEntry,
  CigWatchService,
  CigWatchSource
} from '../../../core/services/news/cig-watch.service';

type SourceSortOption = 'LABEL_ASC' | 'LABEL_DESC' | 'KIND_ASC' | 'UPDATED_DESC' | 'UPDATED_ASC';
type EntrySortOption =
  | 'PUBLISHED_DESC'
  | 'PUBLISHED_ASC'
  | 'FETCH_DESC'
  | 'FETCH_ASC'
  | 'SOURCE_ASC'
  | 'SOURCE_DESC'
  | 'TITLE_ASC'
  | 'TITLE_DESC';

@Component({
  selector: 'app-cig-watch-management',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './cig-watch-management.component.html'
})
export class CigWatchManagementComponent implements OnInit, OnDestroy {
  private readonly schedulerIntervalMinutes = 5;
  readonly sourceSortOptions: { value: SourceSortOption; label: string }[] = [
    { value: 'LABEL_ASC', label: 'Label A -> Z' },
    { value: 'LABEL_DESC', label: 'Label Z -> A' },
    { value: 'KIND_ASC', label: 'Type A -> Z' },
    { value: 'UPDATED_DESC', label: 'Maj + recente' },
    { value: 'UPDATED_ASC', label: 'Maj + ancienne' }
  ];
  readonly entrySortOptions: { value: EntrySortOption; label: string }[] = [
    { value: 'PUBLISHED_DESC', label: 'Published + recent' },
    { value: 'PUBLISHED_ASC', label: 'Published + ancien' },
    { value: 'FETCH_DESC', label: 'Fetch + recent' },
    { value: 'FETCH_ASC', label: 'Fetch + ancien' },
    { value: 'SOURCE_ASC', label: 'Source A -> Z' },
    { value: 'SOURCE_DESC', label: 'Source Z -> A' },
    { value: 'TITLE_ASC', label: 'Titre A -> Z' },
    { value: 'TITLE_DESC', label: 'Titre Z -> A' }
  ];
  sources: CigWatchSource[] = [];
  feed: CigFeedResponse | null = null;
  entries: CigRawEntry[] = [];
  displayedEntries: CigRawEntry[] = [];
  entrySourceFilter = 'ALL';
  entrySourceFilterOptions: string[] = ['ALL'];
  nextScheduledFetchAt: Date | null = null;
  schedulerCountdownLabel = 'n/a';

  isLoadingSources = false;
  isLoadingFeed = false;
  isForcingRefresh = false;

  feedLimit = 40;
  sourceSort: SourceSortOption = 'LABEL_ASC';
  entrySort: EntrySortOption = 'PUBLISHED_DESC';
  success = '';
  error = '';

  constructor(private readonly cigWatchService: CigWatchService) {}

  ngOnInit(): void {
    this.loadSources();
    this.loadFeed();
    this.startSchedulerCountdownTicker();
  }

  ngOnDestroy(): void {
    this.stopSchedulerCountdownTicker();
  }

  loadSources(): void {
    this.isLoadingSources = true;
    this.cigWatchService.listSources().subscribe({
      next: (response) => {
        this.sources = response?.data ? [...response.data] : [];
        this.applySourceSort();
        this.isLoadingSources = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingSources = false;
        this.error = this.extractHttpErrorMessage('Impossible de charger les sources CIG.', error);
      }
    });
  }

  loadFeed(): void {
    this.isLoadingFeed = true;
    this.cigWatchService.getFeed(this.feedLimit).subscribe({
      next: (response) => {
        this.feed = response?.data ?? null;
        this.entries = this.feed?.items ? [...this.feed.items] : [];
        this.applyEntrySort();
        this.refreshEntrySourceFilterOptions();
        this.applyEntrySourceFilter();
        this.nextScheduledFetchAt = this.resolveNextScheduledFetchAt(this.feed);
        this.updateSchedulerCountdownLabel();
        this.isLoadingFeed = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingFeed = false;
        this.error = this.extractHttpErrorMessage('Impossible de recuperer le flux CIG brut.', error);
      }
    });
  }

  forceRefresh(): void {
    if (this.isForcingRefresh) {
      return;
    }
    this.clearMessages();
    this.isForcingRefresh = true;
    this.cigWatchService.forceRefresh(this.feedLimit).subscribe({
      next: (response) => {
        this.feed = response?.data ?? null;
        this.entries = this.feed?.items ? [...this.feed.items] : [];
        this.applyEntrySort();
        this.refreshEntrySourceFilterOptions();
        this.applyEntrySourceFilter();
        this.nextScheduledFetchAt = this.resolveNextScheduledFetchAt(this.feed);
        this.updateSchedulerCountdownLabel();
        this.success = 'Refresh force lancé.';
        this.isForcingRefresh = false;
      },
      error: (error: HttpErrorResponse) => {
        this.isForcingRefresh = false;
        this.error = this.extractHttpErrorMessage('Impossible de forcer le refresh CIG.', error);
      }
    });
  }

  onSourceSortChange(): void {
    this.applySourceSort();
  }

  onEntrySortChange(): void {
    this.applyEntrySort();
    this.applyEntrySourceFilter();
  }

  onEntrySourceFilterChange(): void {
    this.applyEntrySourceFilter();
  }

  formatDate(value?: string | Date | null): string {
    if (!value) {
      return 'n/a';
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return typeof value === 'string' ? value : 'n/a';
    }
    return parsed.toLocaleString('fr-FR');
  }

  trackSource(_: number, source: CigWatchSource): number {
    return source.id;
  }

  trackEntry(index: number, entry: CigRawEntry): string {
    return `${entry.sourceId}-${entry.externalId ?? entry.link ?? index}`;
  }

  private clearMessages(): void {
    this.success = '';
    this.error = '';
  }

  private applySourceSort(): void {
    const sorted = [...this.sources];
    switch (this.sourceSort) {
      case 'LABEL_ASC':
        sorted.sort((left, right) => this.compareText(left.label, right.label));
        break;
      case 'LABEL_DESC':
        sorted.sort((left, right) => this.compareText(right.label, left.label));
        break;
      case 'KIND_ASC':
        sorted.sort((left, right) => this.compareText(left.sourceKind, right.sourceKind));
        break;
      case 'UPDATED_DESC':
        sorted.sort((left, right) => this.compareDateDesc(left.updatedAt, right.updatedAt));
        break;
      case 'UPDATED_ASC':
        sorted.sort((left, right) => this.compareDateAsc(left.updatedAt, right.updatedAt));
        break;
    }
    this.sources = sorted;
  }

  private applyEntrySort(): void {
    const sorted = [...this.entries];
    switch (this.entrySort) {
      case 'PUBLISHED_DESC':
        sorted.sort((left, right) => {
          const byPublished = this.compareDateDesc(left.publishedAt, right.publishedAt);
          return byPublished !== 0 ? byPublished : this.compareDateDesc(left.fetchedAt, right.fetchedAt);
        });
        break;
      case 'PUBLISHED_ASC':
        sorted.sort((left, right) => {
          const byPublished = this.compareDateAsc(left.publishedAt, right.publishedAt);
          return byPublished !== 0 ? byPublished : this.compareDateAsc(left.fetchedAt, right.fetchedAt);
        });
        break;
      case 'FETCH_DESC':
        sorted.sort((left, right) => this.compareDateDesc(left.fetchedAt, right.fetchedAt));
        break;
      case 'FETCH_ASC':
        sorted.sort((left, right) => this.compareDateAsc(left.fetchedAt, right.fetchedAt));
        break;
      case 'SOURCE_ASC':
        sorted.sort((left, right) => {
          const bySource = this.compareText(left.sourceLabel, right.sourceLabel);
          return bySource !== 0 ? bySource : this.compareDateDesc(left.publishedAt, right.publishedAt);
        });
        break;
      case 'SOURCE_DESC':
        sorted.sort((left, right) => {
          const bySource = this.compareText(right.sourceLabel, left.sourceLabel);
          return bySource !== 0 ? bySource : this.compareDateDesc(left.publishedAt, right.publishedAt);
        });
        break;
      case 'TITLE_ASC':
        sorted.sort((left, right) => this.compareText(left.title, right.title));
        break;
      case 'TITLE_DESC':
        sorted.sort((left, right) => this.compareText(right.title, left.title));
        break;
    }
    this.entries = sorted;
  }

  private applyEntrySourceFilter(): void {
    if (this.entrySourceFilter === 'ALL') {
      this.displayedEntries = [...this.entries];
      return;
    }
    this.displayedEntries = this.entries.filter((entry) => entry.sourceLabel === this.entrySourceFilter);
  }

  private refreshEntrySourceFilterOptions(): void {
    const sourceLabels = Array.from(new Set(this.entries.map((entry) => entry.sourceLabel).filter(Boolean)))
      .sort((left, right) => this.compareText(left, right));
    this.entrySourceFilterOptions = ['ALL', ...sourceLabels];
    if (!this.entrySourceFilterOptions.includes(this.entrySourceFilter)) {
      this.entrySourceFilter = 'ALL';
    }
  }

  private startSchedulerCountdownTicker(): void {
    this.stopSchedulerCountdownTicker();
    this.schedulerCountdownTimer = setInterval(() => {
      this.updateSchedulerCountdownLabel();
    }, 1_000);
  }

  private stopSchedulerCountdownTicker(): void {
    if (this.schedulerCountdownTimer) {
      clearInterval(this.schedulerCountdownTimer);
      this.schedulerCountdownTimer = null;
    }
  }

  private updateSchedulerCountdownLabel(): void {
    if (!this.nextScheduledFetchAt) {
      this.schedulerCountdownLabel = 'n/a';
      return;
    }
    let remainingMs = this.nextScheduledFetchAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      this.nextScheduledFetchAt = this.computeNextScheduledFetchAtFromNow();
      remainingMs = this.nextScheduledFetchAt.getTime() - Date.now();
      if (remainingMs <= 0) {
        this.schedulerCountdownLabel = 'imminent';
        return;
      }
    }
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.schedulerCountdownLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private parseDateOrNull(value?: string | Date | null): Date | null {
    if (!value) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private resolveNextScheduledFetchAt(feed?: CigFeedResponse | null): Date | null {
    const explicitNext = this.parseDateOrNull(feed?.nextScheduledFetchAt);
    if (explicitNext) {
      return explicitNext;
    }

    const generatedAt = this.parseDateOrNull(feed?.generatedAt);
    if (!generatedAt) {
      return null;
    }

    return new Date(generatedAt.getTime() + this.schedulerIntervalMinutes * 60_000);
  }

  private computeNextScheduledFetchAtFromNow(): Date {
    const next = new Date();
    next.setMilliseconds(0);
    next.setSeconds(0);
    const minute = next.getMinutes();
    let delta = this.schedulerIntervalMinutes - (minute % this.schedulerIntervalMinutes);
    if (delta === 0) {
      delta = this.schedulerIntervalMinutes;
    }
    next.setMinutes(minute + delta);
    return next;
  }

  private compareText(left?: string | null, right?: string | null): number {
    return (left ?? '').localeCompare(right ?? '', 'fr', { sensitivity: 'base' });
  }

  private compareDateDesc(left?: string | null, right?: string | null): number {
    return this.asTimestamp(right) - this.asTimestamp(left);
  }

  private compareDateAsc(left?: string | null, right?: string | null): number {
    return this.asTimestamp(left) - this.asTimestamp(right);
  }

  private asTimestamp(value?: string | null): number {
    if (!value) {
      return 0;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  private extractHttpErrorMessage(defaultMessage: string, error?: HttpErrorResponse): string {
    const apiMessage = error?.error?.messageDetail?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    const genericMessage = error?.error?.message;
    if (typeof genericMessage === 'string' && genericMessage.trim()) {
      return genericMessage;
    }
    return defaultMessage;
  }

  private schedulerCountdownTimer: ReturnType<typeof setInterval> | null = null;
}
