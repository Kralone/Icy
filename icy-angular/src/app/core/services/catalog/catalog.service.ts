import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export type CatalogStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
export type CatalogImageFilter = 'ALL' | 'ORIGINAL' | 'FALLBACK';
export type CatalogSort = 'name' | 'name-desc' | 'recent' | 'family';
export type CatalogGroup = 'ALL' | 'STANDARD' | 'WIKELO' | 'PYAM_EXEC' | 'BATTAGLIA';

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
  catalogGroup: Exclude<CatalogGroup, 'ALL'>;
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
  groupCounts: Record<string, number>;
  groupFamilyCounts: Record<string, Record<string, number>>;
}

export interface CatalogQuery {
  query?: string;
  family?: string;
  catalogGroup: CatalogGroup;
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

  canCorrect(): Observable<boolean> { return this.http.get<{data:{roles:string[]}}>('/api/users/me/profile').pipe(map(response=>response.data.roles.includes('ADMIN')),catchError(()=>of(false))); }
  imageCorrection(id: number) { return this.http.get<CatalogImageCorrection>(`/api/admin/catalog/corrections/entries/${id}/image`); }
  saveImageCorrection(id: number, url: string) { return this.http.put<CatalogImageCorrection>(`/api/admin/catalog/corrections/entries/${id}/image`, {url}); }
  resetImageCorrection(id: number) { return this.http.delete<CatalogImageCorrection>(`/api/admin/catalog/corrections/entries/${id}/image`); }
  correctionOffers(corrected: boolean, query: string, page: number) { return this.http.get<CorrectionOfferPage>('/api/admin/catalog/corrections/offers', {params: {corrected, query, page}}); }
  associationCandidates(id: number, query: string) { return this.http.get<AssociationCandidate[]>(`/api/admin/catalog/corrections/offers/${id}/candidates`, {params: {query}}); }
  saveAssociation(id: number, entryId: number) { return this.http.put<void>(`/api/admin/catalog/corrections/offers/${id}/association`, {entryId}); }
  resetAssociation(id: number) { return this.http.delete<void>(`/api/admin/catalog/corrections/offers/${id}/association`); }

  browse(query: CatalogQuery): Observable<ApiResponse<CatalogPage>> {
    let params = new HttpParams()
      .set('status', query.status)
      .set('catalogGroup', query.catalogGroup)
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

export interface CatalogImageCorrection { id: number; name: string; sourceImageUrl: string | null; overrideImageUrl: string | null; imageUrl: string | null; fallbackImage: boolean; }
export interface UnassociatedOffer { id: number; name: string; location: string; type: string; price: number; currency: string; overrideEntryId: number | null; linkedName: string | null; }
export interface CorrectionOfferPage { items: UnassociatedOffer[]; totalElements: number; page: number; }
export interface AssociationCandidate { id: number; name: string; family: string; imageUrl: string; reason: string; }
