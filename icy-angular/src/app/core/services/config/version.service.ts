import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, interval, Subject } from 'rxjs';
import { switchMap, retry } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class VersionService {
  // URL vers le fichier généré
  private VERSION_URL = '/assets/version.json';

  // Stockage du hash local
  private localHash: string | null = null;

  // Subject pour notifier le composant qu'une update est là
  private updateDetectedSubject = new Subject<void>();
  updateDetected$ = this.updateDetectedSubject.asObservable();

  constructor(private http: HttpClient) {}

  public initVersionCheck() {
    // 1. On charge la version courante au démarrage de l'app
    this.loadVersion().then(data => {
      this.localHash = data.hash;
      console.log(`🔹 [System] Version actuelle chargée : ${this.localHash}`);

      // 2. On lance le polling (vérification toutes les 60 secondes)
      this.startPolling();
    }).catch(err => {
      console.warn('⚠️ Impossible de charger version.json (mode dev ?)', err);
    });
  }

  private startPolling() {
    // Vérifie toutes les 1 minute (60000 ms)
    interval(60000).pipe(
      // Ajout d'un timestamp (?t=...) pour éviter le cache navigateur sur ce fichier précis
      switchMap(() => this.http.get<any>(`${this.VERSION_URL}?t=${new Date().getTime()}`)),
      retry(1) // Si erreur réseau, on réessaie une fois avant d'échouer silencieusement
    ).subscribe({
      next: (remoteData) => {
        if (this.localHash && remoteData.hash !== this.localHash) {
          console.log('🚀 [System] Nouvelle version détectée !');
          // On évite de spammer si la version a déjà été détectée mais pas refresh
          this.localHash = remoteData.hash;
          this.updateDetectedSubject.next();
        }
      },
      error: (err) => console.error('Erreur check version', err)
    });
  }

  private async loadVersion(): Promise<any> {
    return firstValueFrom(this.http.get<any>(`${this.VERSION_URL}?t=${new Date().getTime()}`));
  }
}
