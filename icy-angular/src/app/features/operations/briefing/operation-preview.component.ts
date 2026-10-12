import { OperationCrew } from '../organization/operation-crew.model';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ParticipationPanelComponent, ParticipationsByStatus } from '../../../shared/participation-panel/participation-panel.component';
import { FleetRequirement, FleetShip, OperationFleetCardsComponent } from '../organization/operation-fleet-cards.component';
import { OrganizationGroup } from '../organization/operation-organization.model';
import { OperationBriefComponent } from './operation-brief.component';
import { CompositionGroup, OperationComposition } from './operation-composition.model';
import { OperationHeroComponent } from './operation-hero.component';
import { OperationIconComponent } from './operation-icon.component';
import { OperationMyAssignmentComponent } from './operation-my-assignment.component';
import { OperationOrgChartComponent } from './operation-org-chart.component';
import { OperationSheet } from './operation-sheet.model';

const NO_ANSWERS: ParticipationsByStatus = { confirmed: [], maybe: [], refused: [] };

/**
 * Aperçu de la fiche dans l'éditeur : les composants de la fiche publiée, alimentés par les données de l'éditeur.
 * Composant de présentation pur : il ne lit ni n'écrit rien sur le serveur, et n'émet aucune action.
 */
@Component({
  selector: 'app-operation-preview',
  standalone: true,
  imports: [OperationHeroComponent, OperationBriefComponent, OperationIconComponent, OperationMyAssignmentComponent, OperationOrgChartComponent, OperationFleetCardsComponent, ParticipationPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-preview.component.html',
  styleUrls: ['./operation-sheet.css', './operation-preview.component.css']
})
export class OperationPreviewComponent {
  readonly operation = input.required<OperationSheet>();
  readonly groups = input<OrganizationGroup[]>([]);
  readonly requirements = input<FleetRequirement[]>([]);
  readonly ships = input<FleetShip[]>([]);
  readonly crews = input<OperationCrew[]>([]);
  /** Réponses déjà données (opération publiée) ; null pour un brouillon, où personne n'a encore pu répondre. */
  readonly participations = input<ParticipationsByStatus | null>(null);
  /** Lecture des réponses d'une opération publiée : tant qu'elle n'a pas abouti, l'aperçu n'affiche pas de listes vides. */
  readonly participationsState = input<'none' | 'loading' | 'error' | 'ready'>('none');
  /** Structure de l'éditeur : « Aucun groupe » n'est affiché que si elle a bien été lue. */
  readonly organizationState = input<'loading' | 'error' | 'ready'>('ready');
  readonly fleetError = input(false);

  readonly published = computed(() => this.operation().publicationStatus === 'PUBLISHED');
  readonly locked = computed(() => !!this.operation().locked);
  /** Un brouillon n'a aucune réponse, c'est un fait ; une opération publiée n'en montre qu'une fois lues. */
  readonly showAnswers = computed(() => !this.published() || this.participationsState() === 'ready');
  readonly answers = computed(() => this.participations() ?? NO_ANSWERS);
  readonly presentCount = computed(() => this.published() && this.participationsState() === 'ready' ? this.answers().confirmed.length : null);
  readonly presenceNote = computed(() => this.locked() ? 'Opération terminée.'
    : this.published() ? 'Aperçu : les membres répondent sur la fiche publiée.' : 'Aperçu : les membres pourront répondre après la publication.');
  readonly visibleRequirements = computed(() => this.requirements().filter(requirement => requirement.status !== 'CANCELLED'));

  /** La structure de l'éditeur, vue comme un participant qui n'a encore rien choisi. */
  readonly composition = computed<OperationComposition>(() => {
    // Effectifs et places viennent du serveur, comme sur la fiche publiée : rien n'est recalculé ici.
    const nodes: CompositionGroup[] = this.groups().map(group => ({
      id: group.id, parentId: group.parentId, name: group.name, description: group.description, capacity: group.capacity,
      effectiveMode: group.effectiveMode, container: group.container, memberCount: group.memberCount,
      freeSeats: group.freeSeats ?? null, ownFreeSeats: group.ownFreeSeats ?? null, responsibleUsername: group.responsibleUsername, members: group.members
    }));
    return { present: false, myGroupId: null, myRequest: null, groups: nodes };
  });
}
