import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PoleReferents } from './pole';

/** Pôles de l'organisation et leurs Spécialistes référents, visibles par tous les membres. */
@Injectable({ providedIn: 'root' })
export class PoleService {
  private readonly http = inject(HttpClient);

  referents(): Observable<PoleReferents[]> {
    return this.http.get<PoleReferents[]>('/api/poles');
  }
}
