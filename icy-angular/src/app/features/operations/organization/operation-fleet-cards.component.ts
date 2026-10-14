import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Besoin : ce que l'organisateur recherche. Il existe sans propriétaire. */
export interface FleetRequirement {
  id: string;
  groupId: number | null;
  shipModelId: number | null;
  quantity: number;
  notes?: string | null;
  status: 'OPEN' | 'FULFILLED' | 'CANCELLED';
  shipModelName?: string | null;
  shipModelImageUrl?: string | null;
  accepted: number;
  proposed: number;
  missing: number;
}

/** Appareil du hangar d'un membre, mis à disposition : il n'affecte personne à un groupe. */
export interface FleetShip {
  id: string;
  shipId: number;
  ownerUserId: string;
  ownerUsername?: string | null;
  pilotUserId?: string | null;
  pilotUsername?: string | null;
  groupId?: number | null;
  requirementId?: string | null;
  status: 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'UNAVAILABLE';
  shipName?: string | null;
  shipImageUrl?: string | null;
  inHangar: boolean;
  ownerPresent: boolean;
}

export interface FleetGroup { id: number; name: string; parentId?: number | null; }

const SHIP_STATUS: Record<FleetShip['status'], string> = { PROPOSED: 'Proposé', ACCEPTED: 'Accepté', DECLINED: 'Refusé', UNAVAILABLE: 'Indisponible' };
const SHIP_ORDER: Record<FleetShip['status'], number> = { PROPOSED: 0, ACCEPTED: 1, UNAVAILABLE: 2, DECLINED: 3 };

/** Cartes de flotte : chaque besoin porte les appareils proposés pour lui ; les autres appareils sont listés à part. */
@Component({
  selector: 'app-operation-fleet-cards',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-fleet-cards.component.html',
  styleUrl: './operation-fleet-cards.component.css'
})
export class OperationFleetCardsComponent {
  readonly requirements = input<FleetRequirement[]>([]);
  readonly ships = input<FleetShip[]>([]);
  readonly groups = input<FleetGroup[]>([]);
  /** Groupe affiché (avec ses sous-groupes) ; null : toute l'opération. */
  readonly scopeGroupId = input<number | null>(null);
  readonly organizer = input(false);
  /** Modifier ou supprimer un besoin : seulement là où l'éditeur des besoins existe. La fiche ne garde que l'arbitrage des vaisseaux. */
  readonly requirementActions = input(true);
  readonly currentUserId = input<string | null>(null);
  /** Opération terminée : lecture seule. */
  readonly locked = input(false);
  readonly busy = input(false);
  readonly showRequirements = input(true);
  /** Lecture en échec : le dire, plutôt qu'afficher « aucun besoin » ou « aucun appareil » comme un fait. */
  readonly requirementsUnavailable = input(false);
  readonly shipsUnavailable = input(false);
  /** Titre du bloc des besoins : « Flotte prévue » sur la fiche participant. */
  readonly needsTitle = input('Besoins');
  /** Membres proposés comme pilote (organisateur). Vide : le pilote est seulement affiché. */
  readonly members = input<Array<{ id: string; username: string }>>([]);

  readonly accept = output<string>();
  readonly decline = output<string>();
  readonly withdraw = output<FleetShip>();
  readonly pilot = output<{ proposalId: string; userId: string | null }>();
  readonly editRequirement = output<FleetRequirement>();
  readonly deleteRequirement = output<FleetRequirement>();

  private readonly scope = computed<Set<number> | null>(() => {
    const id = this.scopeGroupId();
    if (id === null) return null;
    return new Set([id, ...this.groups().filter(group => group.parentId === id).map(group => group.id)]);
  });

  readonly visibleRequirements = computed(() => {
    const scope = this.scope();
    return this.requirements().filter(requirement => scope === null || (requirement.groupId !== null && scope.has(requirement.groupId)));
  });

  readonly visibleShips = computed(() => {
    const scope = this.scope();
    return this.ships()
      .filter(ship => scope === null || (ship.groupId != null && scope.has(ship.groupId)))
      .sort((a, b) => SHIP_ORDER[a.status] - SHIP_ORDER[b.status]);
  });

  /** Appareils rattachés à un besoin affiché : ils sont montrés dans sa carte, pas une seconde fois dans la liste. */
  private readonly shipsByNeed = computed(() => {
    const byNeed = new Map<string, FleetShip[]>();
    if (!this.showRequirements()) return byNeed;
    const shown = new Set(this.visibleRequirements().map(requirement => requirement.id));
    for (const ship of [...this.ships()].sort((a, b) => SHIP_ORDER[a.status] - SHIP_ORDER[b.status])) {
      if (!ship.requirementId || !shown.has(ship.requirementId)) continue;
      byNeed.set(ship.requirementId, [...(byNeed.get(ship.requirementId) ?? []), ship]);
    }
    return byNeed;
  });

  linkedShips(requirement: FleetRequirement): FleetShip[] { return this.shipsByNeed().get(requirement.id) ?? []; }

  /** Appareils proposés hors de tout besoin affiché. */
  readonly otherShips = computed(() => this.visibleShips().filter(ship => !ship.requirementId || !this.shipsByNeed().has(ship.requirementId)));

  readonly shipsTitle = computed(() => this.showRequirements() ? 'Autres appareils proposés' : 'Appareils proposés');
  readonly emptyShipsLabel = computed(() => {
    const scope = this.scopeGroupId() === null ? '' : ' pour ce groupe';
    return this.showRequirements() ? `Aucun appareil proposé en dehors des besoins${scope}.` : `Aucun appareil proposé${scope}.`;
  });

  /**
   * Le choix part au serveur, puis la liste revient aussitôt au pilote enregistré : elle ne change qu'à la relecture
   * qui suit un enregistrement réussi. Après un échec, elle n'affiche donc jamais un pilote qui n'existe pas.
   */
  choosePilot(ship: FleetShip, select: HTMLSelectElement): void {
    const userId = select.value || null;
    select.value = ship.pilotUserId || '';
    if (userId !== (ship.pilotUserId || null)) this.pilot.emit({ proposalId: ship.id, userId });
  }

  covered(requirement: FleetRequirement): boolean { return requirement.status !== 'CANCELLED' && requirement.missing === 0; }

  groupName(groupId: number | null | undefined): string {
    if (groupId == null) return 'Toute l’opération';
    // Tant que les groupes ne sont pas chargés, rien n'est affirmé sur celui-ci.
    if (!this.groups().length) return '';
    return this.groups().find(group => group.id === groupId)?.name ?? 'Groupe supprimé';
  }

  modelName(requirement: FleetRequirement): string {
    if (requirement.shipModelName) return requirement.shipModelName;
    return requirement.shipModelId === null ? 'Tout modèle' : 'Modèle inconnu';
  }

  /** Mention posée sur l'image d'un besoin ; aucune pour un besoin annulé. */
  wantedLabel(requirement: FleetRequirement): string {
    if (requirement.status === 'CANCELLED') return '';
    return `${requirement.missing === 0 ? 'Prévu' : 'Recherché'} × ${requirement.quantity}`;
  }

  needLabel(requirement: FleetRequirement): string {
    if (requirement.status === 'CANCELLED') return 'Annulé';
    if (requirement.missing === 0) return 'Couvert';
    return `Manque ${requirement.missing} sur ${requirement.quantity}`;
  }

  /** Besoin auquel l'appareil répond, s'il existe encore. */
  linkedNeed(ship: FleetShip): string | null {
    if (!ship.requirementId) return null;
    const requirement = this.requirements().find(item => item.id === ship.requirementId);
    return requirement ? this.modelName(requirement) : null;
  }

  statusLabel(ship: FleetShip): string { return SHIP_STATUS[ship.status]; }
  shipLabel(ship: FleetShip): string { return ship.shipName || 'ce vaisseau'; }
  /** Le serveur refuse d'accepter un appareil sorti du hangar ou dont le propriétaire n'est plus Présent. */
  acceptable(ship: FleetShip): boolean { return ship.status !== 'ACCEPTED' && ship.inHangar && ship.ownerPresent; }
  /** Une proposition refusée reste visible : son propriétaire ne peut pas la retirer pour la soumettre à nouveau. */
  ownWithdrawable(ship: FleetShip): boolean { return this.isOwn(ship) && ship.status !== 'DECLINED'; }
  isOwn(ship: FleetShip): boolean { return !!this.currentUserId() && ship.ownerUserId === this.currentUserId(); }
}
