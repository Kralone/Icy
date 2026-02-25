import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../model/api-response.model';

export interface ItemCategory {
  id: number;
  name: string;
}

export interface ItemCatalogItem {
  id: number;
  name: string;
  manufacturer: string | null;
  imageUrl: string | null;
  description: string | null;
  stats: string | null;
  category: ItemCategory | null;
}

export interface ItemUpsertPayload {
  name: string;
  manufacturer: string | null;
  imageUrl: string | null;
  description: string | null;
  stats: string | null;
  categoryId: number | null;
}

@Injectable({ providedIn: 'root' })
export class ItemCatalogService {
  constructor(private readonly http: HttpClient) {}

  listItems(): Observable<ApiResponse<ItemCatalogItem[]>> {
    return this.http.get<ApiResponse<ItemCatalogItem[]>>('/api/admin/items');
  }

  listFrontItems(): Observable<ApiResponse<ItemCatalogItem[]>> {
    return this.http.get<ApiResponse<ItemCatalogItem[]>>('/api/front/items');
  }

  createItem(payload: ItemUpsertPayload): Observable<ApiResponse<ItemCatalogItem>> {
    return this.http.post<ApiResponse<ItemCatalogItem>>('/api/admin/items', payload);
  }

  updateItem(id: number, payload: ItemUpsertPayload): Observable<ApiResponse<ItemCatalogItem>> {
    return this.http.put<ApiResponse<ItemCatalogItem>>(`/api/admin/items/${id}`, payload);
  }

  deleteItem(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/api/admin/items/${id}`);
  }

  listCategories(): Observable<ApiResponse<ItemCategory[]>> {
    return this.http.get<ApiResponse<ItemCategory[]>>('/api/admin/items/categories');
  }

  createCategory(name: string): Observable<ApiResponse<ItemCategory>> {
    return this.http.post<ApiResponse<ItemCategory>>('/api/admin/items/categories', { name });
  }
}
