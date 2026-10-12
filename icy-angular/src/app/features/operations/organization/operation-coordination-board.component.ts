import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GroupMember, GroupSeats, MODE_LABELS, occupancyLabel, OperationGroupBase, seatsFor } from '../operation-group.model';

export interface CoordinationGroup extends OperationGroupBase, GroupSeats {
  /** Vrai si l'utilisateur peut y placer ou en retirer un membre. */
  manageable: boolean;
}
export interface CoordinationRequest {
  id: string;
  member: GroupMember;
  groupId: number;
  groupName: string;
  currentGroupId: number | null;
  currentGroupName: string | null;
  createdAt: string | null;
}
export interface OperationCoordination {
  organizer: boolean;
  present: GroupMember[];
  maybe: GroupMember[];
  unavailable: GroupMember[];
  unassigned: GroupMember[];
  groups: CoordinationGroup[];
  requests: CoordinationRequest[];
}

/** Tableau de coordination : qui attend une réponse, qui n'a pas de place, qui est où. */
@Component({
  selector: 'app-operation-coordination-board',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-coordination-board.component.html',
  styleUrl: './operation-coordination-board.component.css'
})
export class OperationCoordinationBoardComponent {
  readonly coordination = input.required<OperationCoordination>();
  readonly busy = input(false);
  /** Opération terminée : la composition reste lisible, plus aucune action. */
  readonly locked = input(false);
  readonly assign = output<{ userId: string; groupId: number }>();
  readonly remove = output<GroupMember>();
  readonly decide = output<{ requestId: string; approve: boolean }>();

  /** Membre dont on choisit la destination ; un seul sélecteur ouvert à la fois. */
  readonly placing = signal<string | null>(null);

  readonly roots = computed(() => this.coordination().groups.filter(group => group.parentId === null || !this.coordination().groups.some(parent => parent.id === group.parentId)));
  readonly destinations = computed(() => this.locked() ? [] : this.coordination().groups.filter(group => group.manageable));

  modeLabel(group: CoordinationGroup): string { return MODE_LABELS[group.effectiveMode]; }
  children(parentId: number): CoordinationGroup[] { return this.coordination().groups.filter(group => group.parentId === parentId); }
  readonly occupancy = occupancyLabel;
  isFull(group: CoordinationGroup): boolean { return group.freeSeats === 0; }
  seats(group: CoordinationGroup): string { return this.seatsLabel(group.freeSeats); }
  target(request: CoordinationRequest): CoordinationGroup | undefined { return this.coordination().groups.find(group => group.id === request.groupId); }

  seatsFor(destination: CoordinationGroup, fromGroupId: number | null): number | null { return seatsFor(destination, fromGroupId, this.coordination().groups); }
  seatsLabel(seats: number | null): string {
    if (seats === null) return 'sans limite';
    if (seats === 0) return 'complet';
    return seats === 1 ? '1 place' : `${seats} places`;
  }
  otherDestinations(current: number | null): CoordinationGroup[] { return this.destinations().filter(group => group.id !== current); }

  togglePlacing(userId: string): void { this.placing.update(current => current === userId ? null : userId); }

  choose(userId: string, groupId: number): void {
    this.placing.set(null);
    this.assign.emit({ userId, groupId });
  }
}
