import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {ImageMetadata} from '../../../model/image-metadata.model';
import {ImageTag} from '../../../model/image-tag.model';


@Injectable({
  providedIn: 'root'
})
export class ImageLibraryService {
  private readonly API_URL = '/api/images';

  constructor(private http: HttpClient) {}

  /**
   * 📋 Récupération de toutes les images
   */
  getAll(): Observable<ImageMetadata[]> {
    return this.http.get<ImageMetadata[]>(this.API_URL);
  }

  /**
   * ⬆️ Upload d'une image (admin)
   */
  upload(file: File, meta?: { tags?: string[]; category?: string; subcategory?: string; tagColors?: Record<string, string> }): Observable<ImageMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.tags?.length) {
      formData.append('tags', meta.tags.join(','));
    }
    if (meta?.category) {
      formData.append('category', meta.category);
    }
    if (meta?.subcategory) {
      formData.append('subcategory', meta.subcategory);
    }
    if (meta?.tagColors && Object.keys(meta.tagColors).length) {
      formData.append('tagColors', JSON.stringify(meta.tagColors));
    }
    return this.http.post<ImageMetadata>(`${this.API_URL}/upload`, formData);
  }

  /**
   * 🗑️ Suppression d'une image (admin)
   */
  delete(name: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${encodeURIComponent(name)}`);
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/categories`);
  }

  createCategory(name: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/categories`, { name });
  }

  getSubcategories(category: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/categories/${encodeURIComponent(category)}/subcategories`);
  }

  createSubcategory(category: string, name: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/categories/${encodeURIComponent(category)}/subcategories`, { name });
  }

  getTags(): Observable<ImageTag[]> {
    return this.http.get<ImageTag[]>(`${this.API_URL}/tags`);
  }

  upsertTagColors(tagColors: Record<string, string>): Observable<void> {
    return this.http.patch<void>(`${this.API_URL}/tags`, tagColors);
  }

  updateImage(id: string, payload: { category?: string; subcategory?: string; tags?: string[]; tagColors?: Record<string, string> }): Observable<ImageMetadata> {
    return this.http.patch<ImageMetadata>(`${this.API_URL}/${encodeURIComponent(id)}`, payload);
  }

  /**
   * 🖼️ Récupération d’une URL complète (utile pour les templates)
   */
  getImageUrl(meta: ImageMetadata): string {
    // Comme ton backend est servi sur le même domaine, on peut renvoyer le path directement
    return meta.url.startsWith('http') ? meta.url : meta.url;
  }
}
