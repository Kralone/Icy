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

  forceRefresh(limit: number): Observable<ApiResponse<CigFeedResponse>> {
    const normalizedLimit = Number.isFinite(limit) ? limit : 40;
    return this.http.post<ApiResponse<CigFeedResponse>>(`${this.baseUrl}/feed/refresh?limit=${normalizedLimit}`, {});
  }
}
