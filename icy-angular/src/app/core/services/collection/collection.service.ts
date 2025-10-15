import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  TemplateDetailDTO,
  TemplateListItemDTO,
  UserCollectionDetailDTO,
  UserCollectionListItemDTO
} from '../../../model/collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/collections';

  // --- Templates
  getTemplates(): Observable<TemplateListItemDTO[]> {
    return this.http.get<TemplateListItemDTO[]>(`${this.baseUrl}/templates`);
  }
  getTemplate(id: number): Observable<TemplateDetailDTO> {
    return this.http.get<TemplateDetailDTO>(`${this.baseUrl}/templates/${id}`);
  }

  // --- Collections utilisateur (/me)
  listUserCollections(): Observable<UserCollectionListItemDTO[]> {
    return this.http.get<UserCollectionListItemDTO[]>(`${this.baseUrl}/me`);
  }
  getUserCollection(id: number): Observable<UserCollectionDetailDTO> {
    return this.http.get<UserCollectionDetailDTO>(`${this.baseUrl}/me/${id}`);
  }

  // ✅ Créer une collection perso depuis un template
  //    (le backend attend: POST /api/collections/import  { templateId, name })
  createUserCollection(templateId: number, name: string): Observable<UserCollectionDetailDTO> {
    return this.http.post<UserCollectionDetailDTO>(`${this.baseUrl}/import`, { templateId, name });
  }

  patchCell(collectionId: number, x: number, y: number, checked: boolean): Observable<string[]> {
    return this.http.patch<string[]>(`${this.baseUrl}/me/${collectionId}/cell`, { x: String(x), y: String(y), checked });
  }


  deleteUserCollection(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/me/${id}`);
  }

  createTemplate(payload: {
    name: string;
    archetype: string;
    axisX: string[];
    axisY: string[];
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/templates`, payload);
  }

}
