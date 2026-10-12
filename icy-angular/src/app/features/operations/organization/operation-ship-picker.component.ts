import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, map, of, Subject, switchMap, tap } from 'rxjs';
import { CatalogEntry, CatalogService } from '../../../core/services/catalog/catalog.service';

/** Recherche illustrée d'un vaisseau du catalogue, au fil de la frappe. */
@Component({
  selector: 'app-operation-ship-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field">Rechercher un vaisseau du catalogue
      <input type="search" [ngModel]="query()" (ngModelChange)="search($event)" placeholder="Polaris, Carrack, MOLE" autocomplete="off">
    </label>
    @if (error()) { <p class="error" role="alert">{{ error() }} <button type="button" (click)="search(query())">Réessayer</button></p> }
    @else if (searching()) { <p class="state" role="status">Recherche…</p> }
    @else if (searched() && !results().length) { <p class="state" role="status">Aucun vaisseau ne correspond à « {{ query() }} ».</p> }
    @else if (!results().length) { <p class="state">Saisissez au moins deux lettres du nom du vaisseau.</p> }
    @if (results().length) {
      <div class="models">
        @for (candidate of results(); track candidate.id) {
          <button type="button" class="model" (click)="chosen.emit(candidate)">
            @if (candidate.imageUrl) { <img [src]="candidate.imageUrl" alt="" loading="lazy"> } @else { <span class="model__noimage">Sans image</span> }
            <span><strong>{{ candidate.name }}</strong>@if (candidate.manufacturer) { <small>{{ candidate.manufacturer }}</small> }</span>
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: .7rem; min-width: 0; }
    .field { display: grid; gap: .35rem; min-width: 0; color: #cbd5e1; }
    .field input { width: 100%; min-width: 0; min-height: 2.75rem; border: 1px solid #475569; border-radius: .45rem; padding: .65rem .75rem; color: #f8fafc; background: #111827; color-scheme: dark; }
    .field input::placeholder { color: #64748b; font-style: italic; opacity: 1; }
    .state { margin: 0; color: #94a3b8; font-size: .88rem; }
    .error { margin: 0; padding: .7rem .9rem; border: 1px solid #774457; border-radius: .6rem; color: #ffd0d4; background: #351f2a; }
    .error button { margin-left: .5rem; border: 1px solid #fda4af; border-radius: .4rem; padding: .25rem .6rem; color: #ffe4e6; background: transparent; }
    .models { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: .6rem; }
    .model { display: grid; gap: .45rem; padding: 0 0 .6rem; overflow: hidden; text-align: left; border: 1px solid #36546a; border-radius: .6rem; color: #e2e8f0; background: #111827; }
    .model:hover { border-color: #67e8f9; }
    .model img, .model__noimage { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #0f172a; }
    .model__noimage { display: grid; place-items: center; color: #94a3b8; font-size: .8rem; }
    .model > span:last-child { display: grid; gap: .1rem; padding: 0 .65rem; overflow-wrap: anywhere; }
    .model small { color: #94a3b8; font-size: .78rem; }
    button:focus-visible, input:focus-visible { outline: 2px solid #72ddf7; outline-offset: 2px; }
  `
})
export class OperationShipPickerComponent {
  private readonly catalogService = inject(CatalogService);
  readonly chosen = output<CatalogEntry>();
  /** Vrai dès qu'une recherche est saisie : l'écran parent sait qu'il y a une saisie à ne pas perdre. */
  readonly typed = output<boolean>();

  readonly query = signal('');
  readonly results = signal<CatalogEntry[]>([]);
  readonly searching = signal(false);
  readonly searched = signal(false);
  readonly error = signal('');
  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      map(query => query.trim()),
      tap(query => { this.error.set(''); this.searched.set(false); this.searching.set(query.length >= 2); if (query.length < 2) this.results.set([]); }),
      // Pas de filtre sur les valeurs identiques : « Réessayer » et une même recherche refaite doivent repartir.
      debounceTime(250),
      switchMap(query => query.length < 2 ? of(null) : this.catalogService.browse({ query, family: 'SHIP', catalogGroup: 'ALL', status: 'ACTIVE', image: 'ALL', sort: 'name', page: 0, pageSize: 24 }).pipe(
        map(response => response.data.items),
        catchError(() => { this.error.set('Le catalogue ne peut pas être chargé.'); return of(null); }))),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(items => {
      this.searching.set(false);
      if (items) { this.results.set(items); this.searched.set(true); }
    });
  }

  search(query: string): void {
    this.query.set(query);
    this.typed.emit(query.trim().length > 0);
    this.search$.next(query);
  }
}
