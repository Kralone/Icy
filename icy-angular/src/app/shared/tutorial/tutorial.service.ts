import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, catchError, filter, map, of, shareReplay } from 'rxjs';
import { ApiResponse } from '../../model/api-response.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { TUTORIALS, findTutorialForPath } from './tutorial-definitions';
import { TutorialDefinition, TutorialProgress, TutorialStatus, TutorialStep } from './tutorial.model';

export interface ActiveTutorial {
  tutorial: TutorialDefinition;
  steps: TutorialStep[];
  index: number;
}

const LOCAL_KEY = 'icy.tutorials';
const READY_POLL_MS = 250;
const READY_TIMEOUT_MS = 10000;

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = '/api/users/me/tutorials';

  private readonly pageTutorialSignal = signal<TutorialDefinition | null>(null);
  private readonly activeSignal = signal<ActiveTutorial | null>(null);
  private progress$: Observable<Map<string, number>> | null = null;
  private readonly seen = new Map<string, number>();
  private userKey: string | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  /** Tutoriel disponible pour la page affichée, rejouable depuis la barre du haut. */
  readonly pageTutorial = this.pageTutorialSignal.asReadonly();
  readonly active = this.activeSignal.asReadonly();
  readonly step = computed(() => {
    const active = this.activeSignal();
    return active ? active.steps[active.index] : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelReadyWait());
  }

  /** Suit la navigation pour proposer le tutoriel de chaque page à la première visite. */
  start(): void {
    if (this.started || !this.isBrowser) return;
    this.started = true;
    this.onPage(this.router.url);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.onPage(event.urlAfterRedirects));
  }

  play(tutorial: TutorialDefinition): boolean {
    if (!this.isBrowser) return false;
    this.cancelReadyWait();
    const steps = availableSteps(tutorial);
    if (!steps.length) return false;
    this.activeSignal.set({ tutorial, steps, index: 0 });
    return true;
  }

  next(): void {
    this.move(1);
  }

  previous(): void {
    this.move(-1);
  }

  // Les étapes sont recalculées à chaque déplacement : une section chargée après le démarrage reste montrée.
  private move(direction: 1 | -1): void {
    const active = this.activeSignal();
    if (!active) return;
    const current = active.steps[active.index];
    const order = active.tutorial.steps.indexOf(current);
    const steps = availableSteps(active.tutorial, current);
    const index = direction > 0
      ? steps.findIndex(step => active.tutorial.steps.indexOf(step) > order)
      : findLastIndex(steps, step => active.tutorial.steps.indexOf(step) < order);
    if (index === -1) {
      if (direction > 0) this.finish('COMPLETED');
      return;
    }
    this.activeSignal.set({ ...active, steps, index });
  }

  skip(): void {
    this.finish('DISMISSED');
  }

  private finish(status: TutorialStatus): void {
    const active = this.activeSignal();
    if (!active) return;
    this.activeSignal.set(null);
    const { id, version } = active.tutorial;
    this.seen.set(id, Math.max(version, this.seen.get(id) ?? 0));
    this.writeLocal();
    this.http.put<ApiResponse<TutorialProgress>>(`${this.apiUrl}/${encodeURIComponent(id)}`, { version, status })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private onPage(url: string): void {
    const path = url.split(/[?#]/)[0];
    const tutorial = findTutorialForPath(path);
    this.cancelReadyWait();
    if (this.activeSignal() && this.activeSignal()!.tutorial !== tutorial) this.activeSignal.set(null);
    this.pageTutorialSignal.set(tutorial);
    if (!tutorial || this.activeSignal()) return;
    this.syncUser();
    this.loadProgress().subscribe(seen => {
      if ((seen.get(tutorial.id) ?? 0) >= tutorial.version) return;
      if (this.pageTutorialSignal() !== tutorial) return;
      this.waitUntilReady(tutorial);
    });
  }

  // Le suivi est propre à chaque compte : un changement de compte dans le même navigateur repart de zéro.
  private syncUser(): void {
    let userKey = '';
    try {
      userKey = this.auth.getUserIdFromToken() ?? '';
    } catch { /* pas de jeton lisible */ }
    if (userKey === this.userKey) return;
    this.userKey = userKey;
    this.seen.clear();
    this.progress$ = null;
    this.readLocal();
  }

  private loadProgress(): Observable<Map<string, number>> {
    if (!this.progress$) {
      this.progress$ = this.http.get<ApiResponse<TutorialProgress[]>>(this.apiUrl).pipe(
        map(response => response?.data ?? []),
        catchError(() => of([] as TutorialProgress[])),
        map(rows => {
          for (const row of rows) this.seen.set(row.tutorialId, Math.max(row.version, this.seen.get(row.tutorialId) ?? 0));
          return this.seen;
        }),
        shareReplay(1)
      );
    }
    return this.progress$;
  }

  /** Attend la fin du chargement de la page et la présence du premier élément ciblé. */
  private waitUntilReady(tutorial: TutorialDefinition): void {
    const firstTarget = tutorial.steps.find(step => step.target)?.target;
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastBox = '';
    const check = () => {
      this.readyTimer = null;
      if (this.pageTutorialSignal() !== tutorial || this.activeSignal()) return;
      const loading = !!document.querySelector('[data-loading="true"]');
      const target = firstTarget ? findVisibleTarget(firstTarget) : document.body;
      // La cible doit être immobile d’une vérification à l’autre : les animations d’entrée sont terminées.
      const box = target ? JSON.stringify(target.getBoundingClientRect()) : '';
      if (!loading && target && box === lastBox) {
        this.play(tutorial);
        return;
      }
      lastBox = box;
      if (Date.now() < deadline) this.readyTimer = setTimeout(check, READY_POLL_MS);
    };
    this.readyTimer = setTimeout(check, READY_POLL_MS);
  }

  private cancelReadyWait(): void {
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.readyTimer = null;
  }

  // Le navigateur garde aussi la trace : le tutoriel ne revient pas en boucle si l’API est indisponible.
  private readLocal(): void {
    try {
      const stored = JSON.parse(localStorage.getItem(this.localKey()) ?? '{}') as Record<string, unknown>;
      for (const tutorial of TUTORIALS) {
        const version = stored[tutorial.id];
        if (typeof version === 'number') this.seen.set(tutorial.id, version);
      }
    } catch { /* stockage local indisponible */ }
  }

  private localKey(): string {
    return `${LOCAL_KEY}.${this.userKey ?? ''}`;
  }

  private writeLocal(): void {
    try {
      localStorage.setItem(this.localKey(), JSON.stringify(Object.fromEntries(this.seen)));
    } catch { /* stockage local indisponible */ }
  }
}

function availableSteps(tutorial: TutorialDefinition, keep?: TutorialStep): TutorialStep[] {
  return tutorial.steps.filter(step => step === keep || !step.target || !!findVisibleTarget(step.target));
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) if (predicate(items[index])) return index;
  return -1;
}

export function findVisibleTarget(selector: string): HTMLElement | null {
  let elements: NodeListOf<HTMLElement>;
  try {
    elements = document.querySelectorAll<HTMLElement>(selector);
  } catch {
    return null;
  }
  for (const element of Array.from(elements)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && !element.closest('[hidden]')) return element;
  }
  return null;
}
