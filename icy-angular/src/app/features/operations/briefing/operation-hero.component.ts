import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { eventColor, eventImage } from '../../events/event-appearance';
import { OperationIconComponent } from './operation-icon.component';
import { OperationSheet } from './operation-sheet.model';

type HeroStatus = 'draft' | 'upcoming' | 'running' | 'done';
const STATUS_LABELS: Record<HeroStatus, string> = { draft: 'Brouillon', upcoming: 'À venir', running: 'En cours', done: 'Terminée' };

/** Bannière de la fiche : image de mission (à défaut celle du type), titre, horaires, rendez-vous, statut. */
@Component({
  selector: 'app-operation-hero',
  standalone: true,
  imports: [DatePipe, RouterLink, OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-hero.component.html',
  styleUrl: './operation-hero.component.css'
})
export class OperationHeroComponent {
  readonly operation = input.required<OperationSheet>();
  /** Nombre de membres inscrits Présent ; null tant qu'il n'est pas connu. */
  readonly presentCount = input<number | null>(null);
  /** Aperçu dans l'éditeur : pas de lien de navigation. */
  readonly preview = input(false);

  /** Images qui n'ont pas pu être chargées : on passe à la suivante, puis à l'aplat de couleur. */
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());
  private readonly candidates = computed(() => [this.operation().imageUrl, this.operation().typeImageUrl]
    .map(url => this.safeImage(url)).filter((url): url is string => !!url));

  /** Adresse http(s) validée ; un chemin du site (« /assets/… ») reste relatif au site courant. */
  private safeImage(value: string | null | undefined): string | null {
    const safe = eventImage(value);
    const path = value?.trim() ?? '';
    return safe && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : safe;
  }
  readonly image = computed(() => this.candidates().find(url => !this.failedImages().has(url)) ?? null);

  /** Couleurs du type : si l'une des deux n'est pas une couleur valide, la paire par défaut s'applique en entier. */
  private readonly typeColors = computed(() => {
    const invalid = '#000000ff';
    const accent = eventColor(this.operation().typeBackgroundColor, invalid);
    const label = eventColor(this.operation().typeTextColor, invalid);
    return accent === invalid || label === invalid ? { accent: '#27647c', label: '#e3f4fb' } : { accent, label };
  });
  readonly accent = computed(() => this.typeColors().accent);
  readonly label = computed(() => this.typeColors().label);

  readonly status = computed<HeroStatus>(() => {
    const operation = this.operation();
    if (operation.locked || operation.finished) return 'done';
    if (operation.publicationStatus === 'DRAFT') return 'draft';
    // Le serveur dit si l'heure de début est atteinte : l'horloge et le fuseau du navigateur ne comptent pas.
    return operation.started ? 'running' : 'upcoming';
  });
  readonly statusLabel = computed(() => STATUS_LABELS[this.status()]);

  /** Vrai si l'opération se termine un autre jour : la date de fin est alors affichée en entier. */
  readonly endsAnotherDay = computed(() => (this.operation().startDateTime || '').slice(0, 10) !== (this.operation().endDateTime || '').slice(0, 10));

  imageFailed(url: string): void { this.failedImages.update(failed => new Set(failed).add(url)); }
}
