import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CrewMember, CrewPosition, crewShipStatus, isPositionFull, membersAt, OperationCrew, positionIcon, positionOccupancy } from '../organization/operation-crew.model';
import { FleetRequirement } from '../organization/operation-fleet-cards.component';
import { OperationIconComponent } from './operation-icon.component';

/** Équipage de vaisseau sur la fiche participant : appareil attendu, postes, occupants, et choix de mon propre poste. */
@Component({
  selector: 'app-operation-crew-card',
  standalone: true,
  imports: [NgTemplateOutlet, OperationIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-crew-card.component.html',
  styleUrl: './operation-crew-card.component.css'
})
export class OperationCrewCardComponent {
  readonly crew = input.required<OperationCrew>();
  readonly requirements = input<FleetRequirement[]>([]);
  readonly currentUserId = input<string | null>(null);
  /** Vrai si je peux choisir mon poste ici : c'est mon équipage, il laisse le choix aux membres, et l'opération est ouverte. */
  readonly canChoose = input(false);
  readonly busy = input(false);
  /** Poste demandé pour moi ; null : rester dans l'équipage sans poste. */
  readonly choose = output<number | null>();

  readonly positionIcon = positionIcon;
  readonly isFull = isPositionFull;
  readonly positionOccupancy = positionOccupancy;

  readonly shipStatus = computed(() => crewShipStatus(this.crew(), this.requirements()));
  readonly me = computed(() => this.crew().members.find(member => !!this.currentUserId() && member.userId === this.currentUserId()) ?? null);
  readonly unplaced = computed(() => membersAt(this.crew(), null));
  readonly modeText = computed(() => this.crew().positionMode === 'SELF' ? 'Chaque membre choisit son poste' : 'Postes attribués par les responsables');

  members(position: CrewPosition): CrewMember[] { return membersAt(this.crew(), position.id); }

  /** Au-delà de ce nombre, une liste de noms se replie derrière « + N autres ». */
  readonly visibleLimit = 8;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** Mon nom d'abord : il ne se cache jamais derrière « + N autres ». */
  shown(key: string, members: CrewMember[]): CrewMember[] {
    const ordered = [...members].sort((a, b) => Number(this.isMe(b)) - Number(this.isMe(a)));
    return this.expanded().has(key) ? ordered : ordered.slice(0, this.visibleLimit);
  }
  isExpanded(key: string): boolean { return this.expanded().has(key); }
  toggle(key: string): void {
    this.expanded.update(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  isMe(member: CrewMember): boolean { return !!this.currentUserId() && member.userId === this.currentUserId(); }
  isMine(position: CrewPosition): boolean { return this.me()?.positionId === position.id; }
}
