import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { debounceTime, forkJoin } from 'rxjs';
import { WebSocketService } from '../../core/services/websocket/websocket.service';

import { ScweEventsListComponent } from './scwe-events-list/scwe-events-list.component';
import { ScweLeaderboardComponent } from './scwe-leaderboard/scwe-leaderboard.component';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';

import {
  ScWorldEventDto,
  ScWorldEventParticipationDto,
  ScWorldEventParticipationViewDto
} from '../../model/scwe-player.model';
import { ScwePlayerService } from '../../core/services/scworldevent/scwe-player.service';
import { ScWorldEvent, ScWorldEventService } from '../../core/services/scworldevent/sc-world-event.service';

type ViewMode = 'active' | 'history' | 'leaderboard';

@Component({
  selector: 'app-scwe-player-page',
  standalone: true,
  imports: [CommonModule, ScweEventsListComponent, ScweLeaderboardComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './scwe-player-event-page.component.html',
})
export class ScwePlayerPageComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  viewMode: ViewMode = 'active';

  // Cache
  activeItems: ScWorldEventParticipationViewDto[] = [];
  historyItems: ScWorldEventParticipationViewDto[] = [];
  leaderboardParticipants: ScWorldEventParticipationDto[] = [];
  leaderboardEvent: ScWorldEventDto | null = null;

  private loadedActive = false;
  private loadedHistory = false;
  private loadedLeaderboard = false;

  private readonly webSocket = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly onVisible = () => { if (document.visibilityState === 'visible') this.refresh(); };

  constructor(
    private scwePlayer: ScwePlayerService,
    private scweEvent: ScWorldEventService
  ) {}

  ngOnInit(): void {
    this.load(false);
    // Mise à jour en direct : le serveur signale chaque modification enregistrée, la page relit alors sa vue.
    // Plusieurs signaux rapprochés ne donnent qu'une relecture ; aucune requête tant que rien ne change.
    this.webSocket.watchScWorldEvents().pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
    // Un signal manqué pendant que l'onglet dormait (connexion coupée) est rattrapé au retour sur la page.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
  }

  switchMode(mode: ViewMode) {
    this.viewMode = mode;
    this.load(false);
  }

  /** Relit la vue affichée ; les deux autres seront relues quand on y reviendra. */
  refresh() {
    this.loadedActive = false;
    this.loadedHistory = false;
    this.loadedLeaderboard = false;
    this.load(true);
  }

  onItemUpdated(event: { viewItem: ScWorldEventParticipationViewDto, part: ScWorldEventParticipationDto }) {
    event.viewItem.participation = event.part;
    this.loadedLeaderboard = false;
  }

  private load(force: boolean) {
    this.error = null;

    // --- LEADERBOARD ---
    if (this.viewMode === 'leaderboard') {
      if (this.loadedLeaderboard && !force) return;

      // On évite le loader global intempestif sur l'auto-refresh pour ne pas faire "clignoter" l'interface
      // On met loading=true seulement si on n'a pas encore de données
      if (!this.leaderboardParticipants.length) this.loading = true;

      this.scweEvent.getCurrent().subscribe({
        next: (event) => {
          if (!event) {
            this.loading = false;
            this.leaderboardEvent = null;
            return;
          }
          this.leaderboardEvent = this.prepareEvent(event);

          this.scwePlayer.getLeaderboard(event.id).subscribe({
            next: (page) => {
              this.leaderboardParticipants = (page.content || []).map(p => this.fixParticipationPoints(p));
              this.loadedLeaderboard = true;
              this.loading = false;
            },
            error: (err) => {
              console.error("Erreur récup leaderboard", err);
              this.leaderboardParticipants = [];
              this.loading = false;
            }
          });
        },
        error: (err) => {
          console.error("Erreur récup current event", err);
          this.error = 'Impossible de récupérer l\'événement en cours.';
          this.loading = false;
        }
      });
      return;
    }

    // --- LISTE (Active / History) ---
    const isHistory = this.viewMode === 'history';
    if (isHistory && this.loadedHistory && !force) return;
    if (!isHistory && this.loadedActive && !force) return;

    if (!isHistory && !this.activeItems.length) this.loading = true;
    if (isHistory && !this.historyItems.length) this.loading = true;

    const obs = isHistory ? this.scweEvent.getHistory(0, 50) : this.scweEvent.getPlayable(0, 50);

    forkJoin({ events: obs, parts: this.scwePlayer.getMyParticipations() }).subscribe({
      next: (res) => {
        const mapped = (res.events.content || []).map(evt => {
          let p = res.parts.find(x => x.event?.id === evt.id) || null;
          if (p) p = this.fixParticipationPoints(p);
          return { event: this.prepareEvent(evt), participation: p };
        });

        if (isHistory) { this.historyItems = mapped; this.loadedHistory = true; }
        else { this.activeItems = mapped; this.loadedActive = true; }
        this.loading = false;
      },
      error: () => { this.error = 'Erreur chargement événements.'; this.loading = false; }
    });
  }

  private fixParticipationPoints(p: ScWorldEventParticipationDto): ScWorldEventParticipationDto {
    if (!p.points && (p as any).data && typeof (p as any).data === 'string') {
      try { p.points = JSON.parse((p as any).data); } catch { p.points = {}; }
    }
    if (!p.points) p.points = {};
    return p;
  }

  private prepareEvent(evt: ScWorldEvent | any): ScWorldEventDto {
    if (!evt) return evt;
    const dto = { ...evt };
    ['typeTextColor', 'typeImageUrl', 'bannerImageUrl', 'description'].forEach(k => {
      if (dto[k] === null) dto[k] = undefined;
    });
    if (typeof dto.gallery === 'string') try { dto.gallery = JSON.parse(dto.gallery); } catch { dto.gallery = []; }
    if (typeof dto.scoreSchema === 'string') try { dto.scoreSchema = JSON.parse(dto.scoreSchema); } catch { dto.scoreSchema = undefined; }
    return dto;
  }
}
