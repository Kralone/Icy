import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { POLES, PoleReferents, referentsOf } from '../../core/services/pole/pole';
import { PoleService } from '../../core/services/pole/pole.service';
import { PoleIconComponent } from '../../shared/pole-icon/pole-icon.component';

/** Menu des pôles : une carte par pôle, avec ses référents. */
@Component({
  selector: 'app-poles-menu',
  standalone: true,
  imports: [RouterLink, PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poles-menu.component.html',
  styleUrl: './poles.css'
})
export class PolesMenuComponent implements OnInit {
  private readonly poleService = inject(PoleService);

  readonly poles = POLES;
  /** null tant que les référents ne sont pas chargés, ou si le chargement a échoué. */
  readonly referents = signal<PoleReferents[] | null>(null);
  readonly loadFailed = signal(false);

  /** Pôles dont l'image distante n'a pas répondu : ils affichent leur image locale. */
  readonly failedImages = signal<ReadonlySet<string>>(new Set());

  imageFailed(key: string): void {
    this.failedImages.update(failed => new Set(failed).add(key));
  }

  ngOnInit(): void {
    this.poleService.referents().subscribe({
      next: poles => this.referents.set(poles ?? []),
      error: () => this.loadFailed.set(true)
    });
  }

  /** Noms des référents d'un pôle, ou null tant qu'ils ne sont pas connus. */
  referentNames(key: string): string[] | null {
    const poles = this.referents();
    return poles ? referentsOf(poles, key).map(specialist => specialist.username) : null;
  }
}
