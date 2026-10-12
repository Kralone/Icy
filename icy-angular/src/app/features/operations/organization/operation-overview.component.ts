import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EffectiveAssignmentMode, MODE_LABELS, occupancyLabel, occupancyPercent } from '../operation-group.model';
import { MODE_HINTS, OrganizationGroup, sortedChildren } from './operation-organization.model';

/** Vue d'ensemble : toute la structure d'un coup, construite sur les données réelles, plus le mode d'affectation de l'opération. */
@Component({
  selector: 'app-operation-overview',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-overview.component.html',
  styleUrl: './operation-overview.component.css'
})
export class OperationOverviewComponent {
  readonly groups = input.required<OrganizationGroup[]>();
  readonly defaultMode = input<EffectiveAssignmentMode>('FREE');
  readonly busy = input(false);
  /** Vrai si le mode par défaut choisi n'est pas encore enregistré (opération publiée). */
  readonly defaultModeUnsaved = input(false);
  readonly select = output<number>();
  readonly defaultModeChange = output<EffectiveAssignmentMode>();
  readonly addGroup = output<void>();

  readonly modes: EffectiveAssignmentMode[] = ['FREE', 'VALIDATION', 'MANAGED'];
  readonly modeLabels = MODE_LABELS;
  readonly modeHints = MODE_HINTS;
  readonly roots = computed(() => sortedChildren(this.groups(), null));
  readonly assignedMembers = computed(() => new Set(this.groups().flatMap(group => group.members.map(member => member.userId))).size);
  readonly pendingRequests = computed(() => this.groups().filter(group => !group.container).reduce((total, group) => total + group.pendingRequests, 0));

  children(parentId: number): OrganizationGroup[] { return sortedChildren(this.groups(), parentId); }
  occupancy(group: OrganizationGroup): string { return occupancyLabel(group); }
  percent(group: OrganizationGroup): number | null { return occupancyPercent(group); }
}
