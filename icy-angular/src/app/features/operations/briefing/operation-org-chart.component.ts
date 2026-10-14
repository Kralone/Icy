import { CrewPositionChange } from '../organization/operation-crew-members.component';
import { OperationCrew } from '../organization/operation-crew.model';
import { FleetRequirement } from '../organization/operation-fleet-cards.component';
import { OperationCrewCardComponent } from './operation-crew-card.component';
import { OperationIconComponent } from './operation-icon.component';
import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { FleetShip } from '../organization/operation-fleet-cards.component';
import { GroupMember, MODE_LABELS, occupancyLabel, occupancyPercent, seatsFor } from '../operation-group.model';
import { CompositionGroup, OperationComposition } from './operation-composition.model';

/** Ce que le participant peut faire d'un groupe, d'après ce que la fiche a lu ; le serveur recontrôle toujours. */
export type GroupAction = 'mine' | 'requested' | 'join' | 'request' | 'full' | 'parentFull' | 'managed' | 'waiting' | 'none';

const VISIBLE_MEMBERS = 8;

/** Organigramme de l'opération : groupes principaux en cartes, sous-groupes rattachés, membres, places et action possible. */
@Component({
  selector: 'app-operation-org-chart',
  standalone: true,
  imports: [NgTemplateOutlet, OperationIconComponent, OperationCrewCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-org-chart.component.html',
  styleUrl: './operation-org-chart.component.css'
})
export class OperationOrgChartComponent {
  readonly composition = input.required<OperationComposition>();
  readonly currentUserId = input<string | null>(null);
  /** Opération terminée, ou aperçu : lecture seule. */
  readonly readOnly = input(false);
  readonly busy = input(false);
  /** Organisateur : rejoindre un groupe à validation le place directement, le bouton le dit. */
  readonly selfApprove = input(false);
  /** Vaisseaux de l'opération : ceux qui sont acceptés sont rappelés sous leur groupe (le détail est dans la section Flotte). */
  readonly ships = input<FleetShip[]>([]);
  /** Aperçu de l'éditeur : les statuts de places sont montrés comme aux participants, sans aucun bouton. */
  readonly preview = input(false);

  /** Équipages de vaisseau de l'opération : un groupe absent de cette liste est un groupe ordinaire. */
  readonly crews = input<OperationCrew[]>([]);
  /** Besoins en appareils : ils disent si le vaisseau d'un équipage est recherché, proposé ou confirmé. */
  readonly requirements = input<FleetRequirement[]>([]);
  private readonly crewByGroup = computed(() => new Map(this.crews().map(crew => [crew.groupId, crew])));
  crewOf(group: CompositionGroup): OperationCrew | null { return this.crewByGroup().get(group.id) ?? null; }
  /** Je choisis mon poste seulement dans mon propre équipage, s'il laisse le choix aux membres, tant que l'opération est ouverte. */
  canChoosePosition(group: CompositionGroup, crew: OperationCrew): boolean {
    const composition = this.composition();
    return !this.readOnly() && !this.preview() && composition.present && group.id === composition.myGroupId && crew.positionMode === 'SELF';
  }
  /** Poste choisi pour moi dans mon équipage ; null : sans poste. */
  readonly position = output<number | null>();
  /** J'attribue les postes d'un équipage que le serveur me déclare gérable, tant que l'opération est ouverte. */
  canManagePositions(crew: OperationCrew): boolean {
    return crew.manageable && crew.positions.length > 0 && !this.readOnly() && !this.preview();
  }
  /** Poste attribué par un responsable ou un organisateur à un membre d'un équipage. */
  readonly memberPosition = output<{ groupId: number; change: CrewPositionChange }>();

  readonly join = output<CompositionGroup>();
  readonly request = output<CompositionGroup>();

  modeLabel(group: CompositionGroup): string { return MODE_LABELS[group.effectiveMode]; }
  readonly occupancy = occupancyLabel;
  readonly fillPercent = occupancyPercent;

  readonly roots = computed(() => {
    const groups = this.composition().groups;
    return groups.filter(group => group.parentId === null || !groups.some(parent => parent.id === group.parentId));
  });
  children(parentId: number): CompositionGroup[] { return this.composition().groups.filter(group => group.parentId === parentId); }

  /** Groupes principaux repliés ou dépliés à la main ; sans choix, tout est ouvert sur grand écran et seul le mien sur mobile. */
  private readonly toggled = signal<ReadonlyMap<number, boolean>>(new Map());
  private readonly wide = signal(true);

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /**
   * Amène à l'équipage d'un groupe : son groupe principal est déplié s'il le faut, puis la carte reçoit le focus.
   * `scroll` faux : le focus seul, sans déplacer la page (retour après une action faite sur place).
   */
  reveal(groupId: number, scroll = true): boolean {
    const group = this.composition().groups.find(candidate => candidate.id === groupId);
    if (!group || !this.crewOf(group)) return false;
    const root = this.roots().find(candidate => candidate.id === (group.parentId ?? group.id));
    if (root?.container && !this.isOpen(root)) this.toggled.update(current => new Map(current).set(root.id, true));
    // Après le rendu : un élément d'un groupe encore replié ne peut pas recevoir le focus.
    setTimeout(() => {
      const card = this.hostElement.querySelector<HTMLElement>(`#operation-crew-${groupId}`);
      if (!card) return;
      const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (scroll) card.scrollIntoView?.({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      card.focus({ preventScroll: true });
    });
    return true;
  }

  constructor() {
    // Même seuil que les styles (conteneur de 700 px) : dans l'aperçu « Mobile » de l'éditeur, les groupes se replient comme sur un téléphone.
    const host = this.hostElement;
    const measure = (width: number): void => { if (width > 0) this.wide.set(width > 660); };
    // Première mesure dès l'affichage, sans attendre l'observateur.
    afterNextRender(() => measure(host.getBoundingClientRect().width));
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(entries => measure(entries[0]?.contentRect.width ?? 0));
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  isOpen(root: CompositionGroup): boolean {
    const choice = this.toggled().get(root.id);
    if (choice !== undefined) return choice;
    if (this.wide()) return true;
    const mine = this.composition().myGroupId;
    if (mine === null) return this.roots()[0]?.id === root.id;
    return root.id === mine || this.children(root.id).some(child => child.id === mine);
  }
  toggle(root: CompositionGroup): void {
    const open = !this.isOpen(root);
    this.toggled.update(current => new Map(current).set(root.id, open));
  }

  /** Listes de membres dépliées au-delà des premiers noms. */
  private readonly expanded = signal<ReadonlySet<number>>(new Set());
  readonly visibleLimit = VISIBLE_MEMBERS;
  /** Mon nom d'abord : il ne doit jamais se cacher derrière « + N autres ». */
  visibleMembers(group: CompositionGroup): GroupMember[] {
    const ordered = [...group.members].sort((a, b) => Number(this.isMe(b)) - Number(this.isMe(a)));
    return this.expanded().has(group.id) ? ordered : ordered.slice(0, VISIBLE_MEMBERS);
  }
  hiddenCount(group: CompositionGroup): number { return this.expanded().has(group.id) ? 0 : Math.max(0, group.members.length - VISIBLE_MEMBERS); }
  isExpanded(group: CompositionGroup): boolean { return this.expanded().has(group.id); }
  toggleMembers(group: CompositionGroup): void {
    this.expanded.update(current => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; });
  }

  acceptedShips(group: CompositionGroup): string {
    // Seulement les appareils réellement disponibles : acceptés, encore au hangar, propriétaire présent.
    return this.ships().filter(ship => ship.groupId === group.id && ship.status === 'ACCEPTED' && ship.inHangar && ship.ownerPresent)
      .map(ship => `${ship.shipName || 'Vaisseau inconnu'} de ${ship.ownerUsername || 'propriétaire inconnu'}`).join(', ');
  }

  isMe(member: GroupMember): boolean { return !!this.currentUserId() && member.userId === this.currentUserId(); }
  /** Plein selon sa propre capacité : c'est ce que la jauge et le compteur montrent. */
  isFull(group: CompositionGroup): boolean { return group.ownFreeSeats === 0; }

  action(group: CompositionGroup): GroupAction {
    const composition = this.composition();
    if (group.container) return 'none';
    if (this.preview()) {
      if (group.effectiveMode === 'MANAGED') return 'managed';
      if (group.freeSeats === 0) return group.ownFreeSeats === 0 ? 'full' : 'parentFull';
      return 'none';
    }
    if (group.id === composition.myGroupId) return 'mine';
    if (composition.myRequest?.groupId === group.id) return 'requested';
    if (this.readOnly()) return 'none';
    if (group.effectiveMode === 'MANAGED') return 'managed';
    // Le groupe a encore de la place, mais son groupe principal a atteint son plafond.
    if (seatsFor(group, composition.myGroupId, composition.groups) === 0) return group.ownFreeSeats === 0 ? 'full' : 'parentFull';
    if (!composition.present) return 'none';
    if (group.effectiveMode === 'VALIDATION') return composition.myRequest ? 'waiting' : 'request';
    return 'join';
  }

  seatsLabel(group: CompositionGroup): string {
    if (group.freeSeats === null) return 'Sans limite';
    if (group.freeSeats === 0) return 'Complet';
    return group.freeSeats === 1 ? '1 place libre' : `${group.freeSeats} places libres`;
  }
}
