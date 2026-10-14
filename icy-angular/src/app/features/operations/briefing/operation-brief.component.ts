import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { eventImage } from '../../events/event-appearance';
import { OperationIconComponent } from './operation-icon.component';
import { parseObjectiveItems } from './operation-sheet.model';
import { Marked } from 'marked';

const escapeAttribute = (value: string): string => value.replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Convertisseur propre au briefing : seuls les liens http(s) et mailto restent des liens, ouverts dans un nouvel onglet
 * sans accès à la page d'origine ; une image n'est jamais chargée, son texte alternatif est affiché.
 */
const briefingMarkdown = new Marked({
  breaks: true,
  gfm: true,
  async: false,
  renderer: {
    link(href: string, title: string | null | undefined, text: string): string {
      const target = (href ?? '').replace(/&amp;/g, '&').trim();
      if (!/^(https?:\/\/|mailto:)/i.test(target)) return text;
      const label = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<a href="${escapeAttribute(target)}"${label} target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
    },
    image(_href: string, _title: string | null, text: string): string { return text; }
  }
});

/** Briefing et objectifs : deux panneaux de lecture, côte à côte sur grand écran. */
@Component({
  selector: 'app-operation-brief',
  standalone: true,
  imports: [OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-brief.component.html',
  styleUrl: './operation-brief.component.css'
})
export class OperationBriefComponent {
  readonly briefing = input<string | null | undefined>('');
  /** Description saisie à la création : affichée tant qu'aucun briefing n'est rédigé. */
  readonly description = input<string | null | undefined>('');
  readonly objectives = input<string | null | undefined>('');
  /** Opération terminée : ce qui manque ne viendra plus. */
  readonly locked = input(false);
  /** Image de mission, à défaut celle du type : montrée à côté du briefing. Une adresse non web est ignorée. */
  readonly imageUrl = input<string | null | undefined>(null);
  readonly typeImageUrl = input<string | null | undefined>(null);
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());
  readonly image = computed(() => [this.imageUrl(), this.typeImageUrl()].map(eventImage)
    .find((url): url is string => !!url && !this.failedImages().has(url)) ?? null);
  imageFailed(url: string): void { this.failedImages.update(failed => new Set(failed).add(url)); }

  readonly text = computed(() => this.briefing()?.trim() || this.description()?.trim() || '');
  /**
   * Briefing en Markdown : gras, italique, listes, liens, titres. Le HTML saisi est échappé avant la conversion,
   * il s'affiche comme du texte ; Angular nettoie encore le résultat à l'insertion.
   */
  readonly html = computed(() => {
    const escaped = this.text().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return briefingMarkdown.parse(escaped) as string;
  });
  /** Sur mobile, un long briefing est replié pour laisser voir la suite de la fiche. */
  readonly long = computed(() => this.text().length > 600 || this.text().split('\n').length > 10);
  readonly expanded = signal(false);

  private readonly items = computed(() => parseObjectiveItems(this.objectives()));
  readonly principal = computed(() => this.items().filter(item => item.kind === 'PRINCIPAL'));
  readonly secondary = computed(() => this.items().filter(item => item.kind === 'SECONDAIRE'));
}
