
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cig-watch-management.component.html',
  styleUrl: './cig-watch-management.component.css'
})
export class CigWatchManagementComponent implements OnInit, OnDestroy {
  private destroyed = false;
  private readonly schedulerIntervalMinutes = 5;
  readonly sourceSortOptions: { value: SourceSortOption; label: string }[] = [
    { value: 'LABEL_ASC', label: 'Label A -> Z' },
    { value: 'LABEL_DESC', label: 'Label Z -> A' },
    { value: 'KIND_ASC', label: 'Type A -> Z' },
    { value: 'UPDATED_DESC', label: 'Maj + recente' },
    { value: 'UPDATED_ASC', label: 'Maj + ancienne' }
  ];
  readonly entrySortOptions: { value: EntrySortOption; label: string }[] = [
    { value: 'PUBLISHED_DESC', label: 'Publication : récentes' },
    { value: 'PUBLISHED_ASC', label: 'Publication : anciennes' },
    { value: 'FETCH_DESC', label: 'Collecte : récentes' },
    { value: 'FETCH_ASC', label: 'Collecte : anciennes' },
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
    this.destroyed = true;
    this.stopSchedulerCountdownTicker();
    if (this.refreshPollTimer) clearTimeout(this.refreshPollTimer);
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
    if (this.isLoadingFeed) return;
    this.isLoadingFeed = true;
    this.cigWatchService.getFeed(this.feedLimit).subscribe({
      next: (response) => {
        this.feed = response?.data ?? null;
        this.error = '';
        this.entries = this.feed?.items ? [...this.feed.items] : [];
        this.applyEntrySort();
        this.refreshEntrySourceFilterOptions();
        this.applyEntrySourceFilter();
        this.nextScheduledFetchAt = this.resolveNextScheduledFetchAt(this.feed);
        this.updateSchedulerCountdownLabel();
        this.isLoadingFeed = false;
        this.updateRefreshState();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingFeed = false;
        this.error = this.extractHttpErrorMessage('Impossible de charger les actualités CIG.', error);
        if (this.isForcingRefresh && !this.destroyed) {
          this.refreshPollTimer = setTimeout(() => this.loadFeed(), 10000);
        }
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
        this.updateRefreshState(true);
      },
      error: (error: HttpErrorResponse) => {
        this.isForcingRefresh = false;
        this.error = this.extractHttpErrorMessage('Impossible de lancer la collecte CIG.', error);
      }
    });
  }

  private deliveryPollsRemaining = 0;
  busyEntryId: number | null = null;
  editingEntryId: number | null = null;
  draftTitle = '';
  draftExcerpt = '';

  isOfficialNews(entry: CigRawEntry): boolean {
    try {
      const url = new URL(entry.link);
      return entry.sourceId === 1 && entry.sourceUrl === 'https://robertsspaceindustries.com/comm-link/rss'
        && url.protocol === 'https:' && url.hostname === 'robertsspaceindustries.com'
        && !url.username && !url.password && (!url.port || url.port === '443')
        && /^\/(en\/)?comm-link\/[^/]+\/[^/]+$/.test(url.pathname);
    } catch { return false; }
  }

  isSneakPeek(entry: CigRawEntry): boolean {
    return entry.entryType === 'rss:sneak-peek' || /sneak\s*peek|aperçu|apercu/i.test(`${entry.title} ${entry.rawExcerpt ?? ''}`);
  }

  entryImage(entry: CigRawEntry): string | null {
    const raw = entry.rawPayload ?? '';
    const match = raw.match(/(?:src|data-src)\s*=\s*["'](https:\/\/[^"']+)["']/i)
      ?? raw.match(/url\(\s*["']?(https:\/\/[^\)"']+)["']?\s*\)/i);
    const url = match?.[1]?.trim() ?? '';
    return /^https:\/\/(?:media\.)?robertsspaceindustries\.com\//i.test(url) ? url : null;
  }

  canPublish(entry: CigRawEntry): boolean {
    return this.isOfficialNews(entry) && !!entry.id && !entry.newsId && entry.translationStatus === 'TRANSLATED'
      && this.feed?.publishingEnabled === true
      && Date.parse(entry.fetchedAt) >= Date.now() - 86_400_000;
  }

  canRetry(entry: CigRawEntry): boolean {
    if (!this.isOfficialNews(entry) || !entry.id || entry.deliveryStatus === 'DELIVERED' || entry.deliveryStatus === 'EXPIRED') return false;
    return entry.translationStatus !== 'TRANSLATED'
      || (!!entry.newsId && this.feed?.discordRelayEnabled === true);
  }

  editTranslation(entry: CigRawEntry): void {
    if (!entry.id || entry.newsId) return;
    this.editingEntryId = entry.id;
    this.draftTitle = entry.title;
    this.draftExcerpt = entry.rawExcerpt ?? '';
  }

  runEntryAction(entry: CigRawEntry, action: 'publish' | 'retry'): void {
    if (!entry.id || this.busyEntryId !== null) return;
    if (action === 'publish' ? !this.canPublish(entry) : !this.canRetry(entry)) return;
    this.busyEntryId = entry.id;
    this.clearMessages();
    this.cigWatchService.entryAction(entry.id, action).subscribe({
      next: () => {
        this.busyEntryId = null;
        this.deliveryPollsRemaining = 12;
        this.success = action === 'publish' ? 'Publication traitée. Vérifiez son statut.' : 'Tentative traitée. Vérifiez son statut.';
        this.loadFeed();
      },
      error: (error: HttpErrorResponse) => {
        this.busyEntryId = null;
        this.error = this.extractHttpErrorMessage('Action impossible. Rechargez le statut avant de réessayer.', error);
      }
    });
  }

  saveTranslation(entry: CigRawEntry): void {
    if (!entry.id || entry.newsId || this.busyEntryId !== null || !this.draftTitle.trim() || !this.draftExcerpt.trim()) return;
    this.busyEntryId = entry.id;
    this.clearMessages();
    this.cigWatchService.correctTranslation(entry.id, this.draftTitle.trim(), this.draftExcerpt.trim()).subscribe({
      next: () => {
        this.busyEntryId = null;
        this.editingEntryId = null;
        this.success = 'Correction enregistrée. La publication reste à déclencher.';
        this.loadFeed();
      },
      error: (error: HttpErrorResponse) => {
        this.busyEntryId = null;
        this.error = this.extractHttpErrorMessage('Impossible d’enregistrer la correction.', error);
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
      return '—';
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
      if (this.nextScheduledFetchAt && this.nextScheduledFetchAt.getTime() <= Date.now()) {
        this.loadFeed();
      }
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
  private refreshPollTimer: ReturnType<typeof setTimeout> | null = null;

  private updateRefreshState(manual = false): void {
    if (this.destroyed) return;
    const wasRefreshing = this.isForcingRefresh || manual;
    this.isForcingRefresh = this.feed?.refreshing === true;
    if (this.refreshPollTimer) clearTimeout(this.refreshPollTimer);
    this.refreshPollTimer = null;
    if (this.isForcingRefresh) {
      this.refreshPollTimer = setTimeout(() => this.loadFeed(), 3000);
    } else if (this.deliveryPollsRemaining > 0 && this.entries.some(entry => entry.deliveryStatus === 'PENDING')) {
      this.deliveryPollsRemaining--;
      this.refreshPollTimer = setTimeout(() => this.loadFeed(), 3000);
    } else if (wasRefreshing) {
      this.success = this.feed?.errors?.length ? 'Collecte terminée avec des erreurs.' : 'Collecte terminée.';
    }
  }
}
