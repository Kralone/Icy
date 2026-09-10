import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export type CigSourceKind = 'COMM_LINK' | 'DEVTRACKER' | 'X_PROFILE' | 'RSS';

export interface CigWatchSource {
  id: number;
  label: string;
  sourceUrl: string;
  sourceKind: CigSourceKind;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CigRawEntry {
  id?: number;
  translationStatus?: 'PENDING' | 'FAILED' | 'TRANSLATED';
  publicationStatus?: 'ARCHIVED' | 'PENDING' | 'PUBLISHED';
  newsId?: number | null;
  deliveryStatus?: 'DISABLED' | 'PENDING' | 'DELIVERED' | 'EXPIRED';
  lastError?: string | null;
  nextRetryAt?: string | null;
  sourceId: number;
  sourceLabel: string;
  sourceUrl: string;
  externalId: string | null;
  title: string;
  link: string;
  entryType: string;
  publishedAt: string | null;
  rankHint: number | null;
  rawExcerpt: string | null;
  rawPayload: string | null;
  fetchedAt: string;
}

export interface CigSourceFetchError {
  sourceId: number;
  sourceLabel: string;
  sourceUrl: string;
  message: string;
}

export interface CigFeedResponse {
  refreshing?: boolean;
  translationConfigured?: boolean;
  publishingEnabled?: boolean;
  discordRelayEnabled?: boolean;
  generatedAt: string;
  nextScheduledFetchAt: string | null;
  sourceCount: number;
  itemCount: number;
  items: CigRawEntry[];
  errors: CigSourceFetchError[];
}

@Injectable({ providedIn: 'root' })
export class CigWatchService {
  private readonly baseUrl = '/api/news/cig';

  constructor(private readonly http: HttpClient) {}

  listSources(): Observable<ApiResponse<CigWatchSource[]>> {
    return this.http.get<ApiResponse<CigWatchSource[]>>(`${this.baseUrl}/sources`);
  }

  getFeed(limit: number): Observable<ApiResponse<CigFeedResponse>> {
    const normalizedLimit = Number.isFinite(limit) ? limit : 40;
    return this.http.get<ApiResponse<CigFeedResponse>>(`${this.baseUrl}/feed?limit=${normalizedLimit}`);
  }

  entryAction(id: number, action: 'publish' | 'retry'): Observable<ApiResponse<CigFeedResponse>> {
    return this.http.post<ApiResponse<CigFeedResponse>>(`${this.baseUrl}/entries/${id}/${action}`, {});
  }

  correctTranslation(id: number, titleFr: string, excerptFr: string): Observable<ApiResponse<CigFeedResponse>> {
    return this.http.put<ApiResponse<CigFeedResponse>>(`${this.baseUrl}/entries/${id}/translation`, { titleFr, excerptFr });
  }

  forceRefresh(limit: number): Observable<ApiResponse<CigFeedResponse>> {
    const normalizedLimit = Number.isFinite(limit) ? limit : 40;
    return this.http.post<ApiResponse<CigFeedResponse>>(`${this.baseUrl}/feed/refresh?limit=${normalizedLimit}`, {});
  }
}
