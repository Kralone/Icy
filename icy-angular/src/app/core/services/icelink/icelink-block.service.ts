import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface IceLinkBlock {
  id?: number;
  name: string;
  icon: string;
  headline: string;
  content: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class IceLinkBlockService {
  private readonly apiUrl = '/api/icelink/blocks';

  // 🔹 Source réactive centrale
  private _blocks$ = new BehaviorSubject<IceLinkBlock[]>([]);
  public blocks$ = this._blocks$.asObservable();

  constructor(private http: HttpClient) {}

  /** 🔹 Charge tous les blocs et les injecte dans le BehaviorSubject */
  loadBlocks(): void {
    this.http.get<IceLinkBlock[]>(this.apiUrl, { withCredentials: true }).subscribe({
      next: (blocks) => this._blocks$.next(blocks),
      error: (err) => console.error('Erreur de chargement des blocs :', err)
    });
  }

  /** 🔹 Compatibilité : méthode appelée par les anciens composants */
  getAllBlocks(): Observable<IceLinkBlock[]> {
    return this.http.get<IceLinkBlock[]>(this.apiUrl);
  }

  /** 🔹 Création d’un bloc */
  createBlock(block: IceLinkBlock): Observable<IceLinkBlock> {
    return this.http.post<IceLinkBlock>(this.apiUrl, block).pipe(
      tap(() => this.loadBlocks())
    );
  }

  /** 🔹 Mise à jour d’un bloc */
  updateBlock(id: number, block: IceLinkBlock): Observable<IceLinkBlock> {
    return this.http.put<IceLinkBlock>(`${this.apiUrl}/${id}`, block).pipe(
      tap(() => this.loadBlocks())
    );
  }

  /** 🔹 Suppression d’un bloc */
  deleteBlock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.loadBlocks())
    );
  }
}
