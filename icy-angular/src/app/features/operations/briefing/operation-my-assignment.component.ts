import { OperationCrew } from '../organization/operation-crew.model';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OperationIconComponent } from './operation-icon.component';
import { MODE_LABELS } from '../operation-group.model';
import { isOpenTo, OperationComposition } from './operation-composition.model';

/** « Mon affectation » : où je suis, qui est mon responsable, ce que j'attends, et ce que je peux faire. */
@Component({
  selector: 'app-operation-my-assignment',
  standalone: true,
  imports: [OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-my-assignment.component.html',
  styleUrl: './operation-my-assignment.component.css'
})
export class OperationMyAssignmentComponent {
  /** null tant que la composition n'est pas lue. */
  readonly composition = input<OperationComposition | null>(null);
  /** Opération terminée : lecture seule. */
  readonly locked = input(false);
  readonly busy = input(false);
  /** Aperçu de l'éditeur : aucune action. */
  readonly preview = input(false);
  /** Lecture en échec : l'état affiché ne doit pas passer pour « aucune affectation ». */
  readonly error = input('');

  /** Mon équipage, si mon groupe est un équipage de vaisseau. */
  readonly crew = input<OperationCrew | null>(null);
  readonly currentUserId = input<string | null>(null);
  readonly myPosition = computed(() => {
    const crew = this.crew();
    const mine = crew?.members.find(member => !!this.currentUserId() && member.userId === this.currentUserId());
    return crew?.positions.find(position => position.id === mine?.positionId) ?? null;
  });
  /** Je peux choisir mon poste : l'équipage a des postes et laisse le choix à ses membres. */
  readonly canChoosePosition = computed(() => { const crew = this.crew(); return !!crew && crew.positions.length > 0 && crew.positionMode === 'SELF'; });

  /** Aller choisir mon poste dans mon équipage. */
  readonly choosePosition = output<void>();
  readonly leave = output<void>();
  readonly cancelRequest = output<void>();
  /** Aller choisir un groupe dans l'organisation. */
  readonly browse = output<void>();

  readonly group = computed(() => {
    const composition = this.composition();
    return composition?.groups.find(group => group.id === composition.myGroupId) ?? null;
  });
  readonly parent = computed(() => {
    const group = this.group();
    return group?.parentId == null ? null : this.composition()?.groups.find(candidate => candidate.id === group.parentId) ?? null;
  });
  /** Responsable du groupe, à défaut celui du groupe parent. */
  readonly responsible = computed(() => this.group()?.responsibleUsername || this.parent()?.responsibleUsername || null);
  readonly request = computed(() => this.composition()?.myRequest ?? null);
  readonly modeLabel = computed(() => { const group = this.group(); return group ? MODE_LABELS[group.effectiveMode] : ''; });
  readonly canAct = computed(() => !this.locked() && !this.preview() && !!this.composition()?.present);
  /** Il reste au moins un groupe que je peux rejoindre ou demander moi-même. */
  readonly hasChoices = computed(() => { const composition = this.composition(); return !!composition && composition.groups.some(group => isOpenTo(group, composition)); });
}
