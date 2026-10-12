import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { EffectiveAssignmentMode, MODE_LABELS } from './operation-organization.model';

export interface CoordinationMember { userId: string; username: string; }
export interface CoordinationGroup {
  id: number;
  parentId: number | null;
  name: string;
  capacity: number | null;
  effectiveMode: EffectiveAssignmentMode;
  container: boolean;
  memberCount: number;
  /** Places restantes, plafond du parent compris ; null sans limite. */
  freeSeats: number | null;
  /** Places restantes selon la seule capacité du groupe. */
  ownFreeSeats: number | null;
  responsibleUsername: string | null;
  /** Vrai si l'utilisateur peut y placer ou en retirer un membre. */
  manageable: boolean;
  members: CoordinationMember[];
}
export interface CoordinationRequest {
  id: string;
  member: CoordinationMember;
  groupId: number;
  groupName: string;
  currentGroupId: number | null;
  currentGroupName: string | null;
  createdAt: string | null;
}
export interface OperationCoordination {
  organizer: boolean;
  present: CoordinationMember[];
  maybe: CoordinationMember[];
  unavailable: CoordinationMember[];
  unassigned: CoordinationMember[];
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
  readonly assign = output<{ userId: string; groupId: number }>();
  readonly remove = output<CoordinationMember>();
  readonly decide = output<{ requestId: string; approve: boolean }>();

  /** Membre dont on choisit la destination ; un seul sélecteur ouvert à la fois. */
  readonly placing = signal<string | null>(null);

  readonly roots = computed(() => this.coordination().groups.filter(group => group.parentId === null || !this.coordination().groups.some(parent => parent.id === group.parentId)));
  readonly destinations = computed(() => this.coordination().groups.filter(group => group.manageable));

  modeLabel(group: CoordinationGroup): string { return MODE_LABELS[group.effectiveMode]; }
  children(parentId: number): CoordinationGroup[] { return this.coordination().groups.filter(group => group.parentId === parentId); }
  occupancy(group: CoordinationGroup): string {
    if (group.capacity !== null) return `${group.memberCount} / ${group.capacity}`;
    return group.memberCount === 1 ? '1 membre' : `${group.memberCount} membres`;
  }
  isFull(group: CoordinationGroup): boolean { return group.freeSeats === 0; }
  seats(group: CoordinationGroup): string {
    if (group.freeSeats === null) return 'sans limite';
    if (group.freeSeats === 0) return 'complet';
    return group.freeSeats === 1 ? '1 place' : `${group.freeSeats} places`;
  }
  target(request: CoordinationRequest): CoordinationGroup | undefined { return this.coordination().groups.find(group => group.id === request.groupId); }

  /**
   * Places pour un membre venant de `fromGroupId` : s'il est déjà compté dans le même groupe parent,
   * seul le plafond propre à la destination compte (le serveur applique la même règle).
   */
  seatsFor(destination: CoordinationGroup, fromGroupId: number | null): number | null {
    const from = fromGroupId === null ? undefined : this.coordination().groups.find(group => group.id === fromGroupId);
    const sameParent = !!from && from.parentId !== null && from.parentId === destination.parentId;
    return sameParent ? destination.ownFreeSeats : destination.freeSeats;
  }
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
