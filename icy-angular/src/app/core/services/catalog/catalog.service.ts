import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export type CatalogStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
export type CatalogImageFilter = 'ALL' | 'ORIGINAL' | 'FALLBACK';
export type CatalogSort = 'name' | 'name-desc' | 'recent' | 'family';

export interface CatalogOffer {
  id: number;
  type: 'BUY' | 'SELL' | 'RENT' | 'WIKELO';
  location: string;
  price: number;
  currency: string;
  updatedAt: string | null;
}

export interface CatalogEntry {
  id: number;
  externalId: string;
  family: string;
  name: string;
  slug: string | null;
  manufacturer: string | null;
  description: string | null;
  imageUrl: string;
  fallbackImage: boolean;
  source: string;
  sourceUrl: string | null;
  sourceVersion: string | null;
  active: boolean;
  updatedAt: string | null;
  offers: CatalogOffer[];
}

export interface CatalogPage {
  items: CatalogEntry[];
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  activeElements: number;
  inactiveElements: number;
  fallbackImages: number;
  familyCounts: Record<string, number>;
}

export interface CatalogQuery {
  query?: string;
  family?: string;
  status: CatalogStatusFilter;
  image: CatalogImageFilter;
  source?: string;
  sort: CatalogSort;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly baseUrl = '/api/admin/catalog/entries';

  constructor(private readonly http: HttpClient) {}

  browse(query: CatalogQuery): Observable<ApiResponse<CatalogPage>> {
    let params = new HttpParams()
      .set('status', query.status)
      .set('image', query.image)
      .set('sort', query.sort)
      .set('page', query.page)
      .set('pageSize', query.pageSize);

    if (query.query?.trim()) params = params.set('query', query.query.trim());
    if (query.family) params = params.set('family', query.family);
    if (query.source) params = params.set('source', query.source);

    return this.http.get<ApiResponse<CatalogPage>>(this.baseUrl, { params });
  }
}
