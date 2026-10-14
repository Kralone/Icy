import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { OperationIconComponent } from './operation-icon.component';
import { parseObjectiveItems } from './operation-sheet.model';
import { marked } from 'marked';

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

  readonly text = computed(() => this.briefing()?.trim() || this.description()?.trim() || '');
  /**
   * Briefing en Markdown : gras, italique, listes, liens, titres. Le HTML saisi est échappé avant la conversion,
   * il s'affiche comme du texte ; Angular nettoie encore le résultat à l'insertion.
   */
  readonly html = computed(() => {
    const escaped = this.text().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return marked.parse(escaped, { breaks: true, gfm: true, async: false }) as string;
  });
  /** Sur mobile, un long briefing est replié pour laisser voir la suite de la fiche. */
  readonly long = computed(() => this.text().length > 600 || this.text().split('\n').length > 10);
  readonly expanded = signal(false);

  private readonly items = computed(() => parseObjectiveItems(this.objectives()));
  readonly principal = computed(() => this.items().filter(item => item.kind === 'PRINCIPAL'));
  readonly secondary = computed(() => this.items().filter(item => item.kind === 'SECONDAIRE'));
}
