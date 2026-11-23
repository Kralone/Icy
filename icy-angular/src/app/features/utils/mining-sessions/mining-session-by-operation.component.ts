import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MiningSessionService, sessionsPath } from '../../../core/services/mining/mining-session.service';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';

/** Lien « Fiche de minage » ou « Fiche de salvage » d'une opération : ouvre la fiche liée, ou dit qu'elle n'existe pas encore. */
@Component({
  selector: 'app-mining-session-by-operation',
  standalone: true,
  imports: [AsyncStateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (missing()) {
      <app-async-state kind="empty" title="Pas encore de fiche pour cette opération."
        description="Elle est créée à la publication d’une opération « Session de minage » ou « Session de salvage », avec les membres présents." />
      <p style="text-align: center"><a [routerLink]="['/icy/operations', operationId]">Retour à l’opération</a></p>
    } @else {
      <app-async-state kind="loading" title="Ouverture de la fiche…" />
    }
  `
})
export class MiningSessionByOperationComponent {
  readonly operationId = inject(ActivatedRoute).snapshot.paramMap.get('operationId') ?? '';
  readonly missing = signal(false);

  constructor() {
    const router = inject(Router);
    inject(MiningSessionService).byOperation(this.operationId).pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe({
      next: ({ sheetId, activity }) => router.navigate([sessionsPath(activity), sheetId], { replaceUrl: true }),
      error: () => this.missing.set(true)
    });
  }
}
