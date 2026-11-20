import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PoleReferents, poleBySlug, referentsOf } from '../../core/services/pole/pole';
import { PoleService } from '../../core/services/pole/pole.service';
import { PoleIconComponent } from '../../shared/pole-icon/pole-icon.component';

/** Page d'un pôle : ses référents et les outils du site qui lui sont rattachés. */
@Component({
  selector: 'app-pole-page',
  standalone: true,
  imports: [RouterLink, PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pole-page.component.html',
  styleUrl: './poles.css'
})
export class PolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly poleService = inject(PoleService);

  private readonly slug = toSignal(this.route.paramMap.pipe(map(params => params.get('pole'))), {
    initialValue: this.route.snapshot.paramMap.get('pole')
  });
  readonly pole = computed(() => poleBySlug(this.slug()));

  private readonly referents = signal<PoleReferents[] | null>(null);
  readonly loadFailed = signal(false);
  /** Référents du pôle affiché ; null tant qu'ils ne sont pas chargés. */
  readonly specialists = computed(() => {
    const poles = this.referents();
    const pole = this.pole();
    return poles && pole ? referentsOf(poles, pole.key) : null;
  });

  ngOnInit(): void {
    if (!this.pole()) {
      // Adresse d'un pôle qui n'existe pas : retour au menu des pôles.
      void this.router.navigate(['/icy/poles'], { replaceUrl: true });
      return;
    }
    this.load();
  }

  load(): void {
    this.loadFailed.set(false);
    this.poleService.referents().subscribe({
      next: poles => this.referents.set(poles ?? []),
      error: () => this.loadFailed.set(true)
    });
  }

  initial(username: string): string {
    return (username || '?').trim().charAt(0).toUpperCase();
  }
}
