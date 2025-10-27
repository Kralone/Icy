import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {ImageMetadata} from '../../../model/image-metadata.model';


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
  upload(file: File): Observable<ImageMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImageMetadata>(`${this.API_URL}/upload`, formData);
  }

  /**
   * 🗑️ Suppression d'une image (admin)
   */
  delete(name: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${encodeURIComponent(name)}`);
  }

  /**
   * 🖼️ Récupération d’une URL complète (utile pour les templates)
   */
  getImageUrl(meta: ImageMetadata): string {
    // Comme ton backend est servi sur le même domaine, on peut renvoyer le path directement
    return meta.url.startsWith('http') ? meta.url : meta.url;
  }
}
