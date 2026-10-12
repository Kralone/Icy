import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MODE_LABELS, occupancyLabel, occupancyPercent, OrganizationGroup, sortedChildren } from './operation-organization.model';

/** Arborescence des groupes : ce que l'organisateur voit d'un coup d'œil (effectifs, places, responsable, demandes). */
@Component({
  selector: 'app-operation-structure-tree',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-structure-tree.component.html',
  styleUrl: './operation-structure-tree.component.css'
})
export class OperationStructureTreeComponent {
  readonly groups = input.required<OrganizationGroup[]>();
  /** null : la vue d'ensemble est affichée. */
  readonly selectedId = input<number | null>(null);
  readonly busy = input(false);
  /** Opération terminée : la structure se consulte, elle ne se modifie plus. */
  readonly locked = input(false);
  /** Faux tant que la structure n'a pas été lue sur le serveur. */
  readonly loaded = input(true);
  readonly select = output<number | null>();
  readonly addGroup = output<void>();
  readonly addSubgroup = output<number>();

  readonly roots = computed(() => sortedChildren(this.groups(), null));

  children(parentId: number): OrganizationGroup[] { return sortedChildren(this.groups(), parentId); }
  modeLabel(group: OrganizationGroup): string { return MODE_LABELS[group.effectiveMode]; }
  occupancy(group: OrganizationGroup): string { return occupancyLabel(group); }
  percent(group: OrganizationGroup): number | null { return occupancyPercent(group); }
  isFull(group: OrganizationGroup): boolean { return group.capacity !== null && group.memberCount >= group.capacity; }
}
