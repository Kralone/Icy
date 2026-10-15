import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';
import { CommonModule } from '@angular/common';
import { ScWorldEventService } from '../../../core/services/scworldevent/sc-world-event.service';
import { ScwePlayerService } from '../../../core/services/scworldevent/scwe-player.service';
import { Router } from '@angular/router';
import { ScWorldEventDto, ScWorldEventParticipationDto } from '../../../model/scwe-player.model';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-scwe-widget',
  standalone: true,
  imports: [CommonModule, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './scwe-widget.component.html',
  host: {'[style.display]': "event ? 'block' : 'none'"},
})
export class ScweWidgetComponent implements OnInit {
  loadingEvent = true;
  loadingLeaderboard = true;
  event: ScWorldEventDto | null = null;
  topPlayers: ScWorldEventParticipationDto[] = [];
  error: string | null = null;

  constructor(
    private scweEvent: ScWorldEventService,
    private scwePlayer: ScwePlayerService,
    private router: Router
  ) {}

  private readonly webSocket = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadCurrentEvent();
    // Le classement suit les participations enregistrées, sans recharger la page ni afficher de chargement.
    this.webSocket.watchScWorldEvents().pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadCurrentEvent(true));
  }

  private loadCurrentEvent(silent = false): void {
    this.loadingEvent = !silent;
    this.loadingLeaderboard = !silent;
    this.error = null;

    this.scweEvent.getCurrent().subscribe({
      next: (evt) => {
        if (!evt) {
          this.event = null;
          this.loadingEvent = false;
          this.loadingLeaderboard = false;
          return;
        }

        this.event = {
          id: evt.id,
          title: evt.title,
          description: evt.description ?? undefined,
          startAt: evt.startAt,
          endAt: evt.endAt ?? undefined,
          typeName: evt.typeName,
          typeTextColor: evt.typeTextColor ?? undefined,
          typeImageUrl: evt.typeImageUrl ?? undefined,
          bannerImageUrl: evt.bannerImageUrl ?? undefined,
          gallery: evt.gallery,
          scoreSchema: evt.scoreSchema,
        };
        this.loadingEvent = false;

        this.scwePlayer.getLeaderboard(evt.id, 0, 3).subscribe({
          next: (page) => {
            this.topPlayers = (page?.content || []).slice(0, 3);
            this.loadingLeaderboard = false;
          },
          error: () => {
            this.topPlayers = [];
            this.loadingLeaderboard = false;
          }
        });
      },
      error: () => {
        this.error = "Impossible de charger l'event SCWE.";
        this.event = null;
        this.topPlayers = [];
        this.loadingEvent = false;
        this.loadingLeaderboard = false;
      }
    });
  }

  openInCalendar(): void {
    if (!this.event?.id) return;
    this.router.navigate(['/icy/scwe']);
  }
}
