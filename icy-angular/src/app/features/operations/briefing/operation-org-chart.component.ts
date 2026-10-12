import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FleetShip } from '../organization/operation-fleet-cards.component';
import { COMPOSITION_MODE_LABELS, CompositionGroup, CompositionMember, fillPercent, occupancy, OperationComposition, seatsFor } from './operation-composition.model';

/** Ce que le participant peut faire d'un groupe, d'après ce que la fiche a lu ; le serveur recontrôle toujours. */
export type GroupAction = 'mine' | 'requested' | 'join' | 'request' | 'full' | 'parentFull' | 'managed' | 'waiting' | 'none';

const VISIBLE_MEMBERS = 8;

/** Organigramme de l'opération : groupes principaux en cartes, sous-groupes rattachés, membres, places et action possible. */
@Component({
  selector: 'app-operation-org-chart',
  standalone: true,
  imports: [NgTemplateOutlet],
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
  /** Vaisseaux de l'opération : ceux qui sont acceptés sont rappelés sous leur groupe (le détail est dans la section Flotte). */
  readonly ships = input<FleetShip[]>([]);
  /** Aperçu de l'éditeur : les statuts de places sont montrés comme aux participants, sans aucun bouton. */
  readonly preview = input(false);

  readonly join = output<CompositionGroup>();
  readonly request = output<CompositionGroup>();

  modeLabel(group: CompositionGroup): string { return COMPOSITION_MODE_LABELS[group.effectiveMode]; }
  readonly occupancy = occupancy;
  readonly fillPercent = fillPercent;

  readonly roots = computed(() => {
    const groups = this.composition().groups;
    return groups.filter(group => group.parentId === null || !groups.some(parent => parent.id === group.parentId));
  });
  children(parentId: number): CompositionGroup[] { return this.composition().groups.filter(group => group.parentId === parentId); }

  /** Groupes principaux repliés ou dépliés à la main ; sans choix, tout est ouvert sur grand écran et seul le mien sur mobile. */
  private readonly toggled = signal<ReadonlyMap<number, boolean>>(new Map());
  private readonly wide = signal(true);

  constructor() {
    if (typeof matchMedia !== 'function') return;
    // Suit la rotation et le redimensionnement, tant que l'utilisateur n'a pas replié ou déplié lui-même.
    const query = matchMedia('(min-width: 701px)');
    const follow = (): void => this.wide.set(query.matches);
    follow();
    query.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
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
  visibleMembers(group: CompositionGroup): CompositionMember[] {
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

  isMe(member: CompositionMember): boolean { return !!this.currentUserId() && member.userId === this.currentUserId(); }
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
