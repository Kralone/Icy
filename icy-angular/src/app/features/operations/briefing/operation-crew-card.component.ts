import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CrewMember, CrewPosition, crewShipStatus, isPositionFull, membersAt, OperationCrew, positionIcon, positionOccupancy } from '../organization/operation-crew.model';
import { CrewPositionChange, OperationCrewMembersComponent } from '../organization/operation-crew-members.component';
import { FleetRequirement } from '../organization/operation-fleet-cards.component';
import { OperationIconComponent } from './operation-icon.component';

/**
 * Équipage de vaisseau sur la fiche participant, en version compacte : appareil attendu, postes en pastilles, membres à bord.
 * Une pastille cliquable me place à ce poste ; si je ne suis pas encore dans l'équipage, elle me le fait rejoindre du même geste.
 */
@Component({
  selector: 'app-operation-crew-card',
  standalone: true,
  imports: [NgTemplateOutlet, OperationIconComponent, OperationCrewMembersComponent],
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
  /**
   * Vrai si j'attribue les postes des membres de cet équipage : le serveur me l'accorde (organisateur, ou responsable dans sa délégation)
   * et l'opération est ouverte. Il recontrôle ce droit à chaque attribution.
   */
  readonly canManage = input(false);
  /** Poste attribué, changé ou retiré à un membre de l'équipage. */
  readonly assign = output<CrewPositionChange>();
  /** Vrai si je peux rejoindre cet équipage directement : chaque pastille libre me fait alors rejoindre l'équipage à ce poste. */
  readonly canJoinAt = input(false);
  /** Rejoindre l'équipage et prendre ce poste. */
  readonly joinAt = output<number>();

  readonly positionIcon = positionIcon;
  readonly isFull = isPositionFull;
  readonly positionOccupancy = positionOccupancy;

  readonly shipStatus = computed(() => crewShipStatus(this.crew(), this.requirements()));
  readonly me = computed(() => this.crew().members.find(member => !!this.currentUserId() && member.userId === this.currentUserId()) ?? null);
  /** Une ligne : ce que je peux faire ici, ou comment les postes sont attribués. */
  readonly hint = computed(() => {
    if (this.crew().positionMode === 'MANAGED') return 'Postes attribués par les responsables.';
    if (this.canJoinAt()) return 'Choisissez un poste pour rejoindre l’équipage.';
    if (this.canChoose()) return this.me()?.positionId == null ? 'Choisissez votre poste.' : 'Cliquez sur un autre poste pour en changer.';
    return 'Chaque membre choisit son poste.';
  });

  /** Ce qu'offre la pastille d'un poste : rien de cliquable s'il est le mien, complet, ou si je ne peux ni choisir ni rejoindre. */
  chipAction(position: CrewPosition): 'choose' | 'join' | 'none' {
    if (this.isMine(position) || this.isFull(position)) return 'none';
    if (this.canChoose()) return 'choose';
    if (this.canJoinAt() && this.crew().positionMode === 'SELF') return 'join';
    return 'none';
  }
  /** Infobulle de la pastille : qui occupe le poste. */
  occupantsTitle(position: CrewPosition): string {
    const names = this.members(position).map(member => member.username);
    return names.length ? `${position.label} : ${names.join(', ')}` : `${position.label} : libre`;
  }
  positionLabel(member: CrewMember): string {
    return this.crew().positions.find(position => position.id === member.positionId)?.label ?? 'sans poste';
  }

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
