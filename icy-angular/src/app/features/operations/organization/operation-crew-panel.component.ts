import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HotToastService } from '@ngxpert/hot-toast';
import { Observable } from 'rxjs';
import { EventService } from '../../../core/services/event/event.service';
import { OperationIconComponent } from '../briefing/operation-icon.component';
import { OperationConfirmService } from '../operation-confirm.service';
import { CrewMember, CrewPosition, CrewPreset, crewShipStatus, isPositionFull, membersAt, OperationCrew, POSITION_ICONS, POSITION_MODE_HINTS, POSITION_MODE_LABELS, PositionDraft, positionIcon, PositionMode, positionOccupancy } from './operation-crew.model';
import { CrewPositionChange, OperationCrewMembersComponent } from './operation-crew-members.component';
import { FleetRequirement } from './operation-fleet-cards.component';
import { OrganizationGroup } from './operation-organization.model';

/** Équipage de vaisseau dans l'éditeur : appareil attendu, postes, et poste de chaque membre. */
@Component({
  selector: 'app-operation-crew-panel',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, OperationIconComponent, OperationCrewMembersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-crew-panel.component.html',
  styleUrl: './operation-crew-panel.component.css'
})
export class OperationCrewPanelComponent {
  private readonly eventService = inject(EventService);
  private readonly toast = inject(HotToastService);
  private readonly confirmService = inject(OperationConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operationId = input.required<string>();
  readonly group = input.required<OrganizationGroup>();
  readonly crew = input.required<OperationCrew>();
  readonly requirements = input<FleetRequirement[]>([]);
  /** Opération terminée : l'équipage se consulte, il ne se modifie plus. */
  readonly locked = input(false);
  /** Ouvre le formulaire d'ajout de poste dès l'affichage (équipage créé avec des postes personnalisés). */
  readonly startWithPosition = input(false);
  /** Une écriture a réussi : l'éditeur relit la structure et les équipages. */
  readonly changed = output<void>();
  /** Vrai pendant une écriture : l'éditeur garde alors le panneau ouvert pour recevoir le résultat. */
  readonly busyChange = output<boolean>();

  readonly busy = signal(false);
  /** Poste en cours de saisie : 'new', l'identifiant d'un poste existant, ou null. */
  readonly editing = signal<number | 'new' | null>(null);
  readonly draft = signal<PositionDraft>({ label: '', icon: null, capacity: null });
  readonly presets = signal<CrewPreset[]>([]);

  readonly icons = POSITION_ICONS;
  readonly modeLabels = POSITION_MODE_LABELS;
  readonly modeHints = POSITION_MODE_HINTS;
  readonly modes: PositionMode[] = ['SELF', 'MANAGED'];
  readonly positionIcon = positionIcon;
  readonly isFull = isPositionFull;
  readonly positionOccupancy = positionOccupancy;

  readonly unplaced = computed(() => membersAt(this.crew(), null));

  /** Besoin en appareil rattaché à cet équipage : ce qui est attendu n'est jamais présenté comme disponible. */
  readonly shipStatus = computed(() => crewShipStatus(this.crew(), this.requirements()));

  readonly draftError = computed(() => {
    const draft = this.draft();
    const label = draft.label.trim().toLocaleLowerCase();
    if (!label) return 'Donnez un nom au poste.';
    if (this.crew().positions.some(position => position.id !== this.editing() && position.label.trim().toLocaleLowerCase() === label)) return 'Un poste porte déjà ce nom dans cet équipage.';
    if (draft.capacity !== null && (draft.capacity < 1 || draft.capacity > 1000)) return 'La capacité d’un poste va de 1 à 1000, ou reste vide.';
    const current = this.crew().positions.find(position => position.id === this.editing());
    if (current && draft.capacity !== null && draft.capacity < current.taken) return `${current.taken} membre${current.taken > 1 ? 's occupent' : ' occupe'} ce poste : la capacité ne peut pas être inférieure.`;
    return '';
  });

  constructor() {
    let shownGroup: number | null = null;
    effect(() => this.busyChange.emit(this.busy()));
    effect(() => {
      const crew = this.crew();
      const open = this.startWithPosition();
      untracked(() => {
        // Le poste en cours de modification a pu être supprimé ailleurs : le formulaire se referme.
        const editing = this.editing();
        if (typeof editing === 'number' && !crew.positions.some(position => position.id === editing)) this.editing.set(null);
        if (crew.groupId === shownGroup) return;
        shownGroup = crew.groupId;
        this.editing.set(null);
        this.presets.set([]);
        if (open && !this.locked() && !crew.positions.length) this.startAdd();
        if (crew.shipModelId !== null && !this.locked()) {
          const groupId = crew.groupId;
          // Sans preset, ou si la lecture échoue, l'action « Ajouter les postes d'un preset » n'est simplement pas proposée.
          this.eventService.getCrewPresets(crew.shipModelId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: presets => { if (this.crew().groupId === groupId) this.presets.set(presets.filter(preset => preset.positions.length > 0)); },
            error: () => undefined
          });
        }
      });
    });
  }

  readonly unplacedNames = computed(() => this.unplaced().map(member => member.username).join(', '));

  members(position: CrewPosition): CrewMember[] { return membersAt(this.crew(), position.id); }

  startAdd(): void {
    this.draft.set({ label: '', icon: null, capacity: null });
    this.editing.set('new');
  }

  startEdit(position: CrewPosition): void {
    this.draft.set({ label: position.label, icon: position.icon, capacity: position.capacity });
    this.editing.set(position.id);
  }

  patch(change: Partial<PositionDraft>): void { this.draft.update(current => ({ ...current, ...change })); }

  setDraftCapacity(value: string | number | null): void {
    const text = value === null ? '' : String(value).trim();
    const parsed = Math.trunc(Number(text));
    this.patch({ capacity: text === '' || Number.isNaN(parsed) ? null : parsed });
  }

  private run(action: Observable<unknown>, success: string, failure: string, done?: () => void, refused?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    action.subscribe({
      next: () => { this.busy.set(false); this.toast.success(success); done?.(); this.changed.emit(); },
      error: error => {
        this.busy.set(false);
        this.toast.error(error?.error?.message || failure);
        refused?.();
        // L'état a pu changer entre-temps (poste pris, membre déplacé) : l'éditeur relit.
        this.changed.emit();
      }
    });
  }

  savePosition(): void {
    const editing = this.editing();
    if (editing === null || this.draftError()) return;
    const draft = this.draft();
    const payload = { label: draft.label.trim(), icon: draft.icon, capacity: draft.capacity };
    if (editing === 'new') {
      const sortOrder = this.crew().positions.reduce((max, position) => Math.max(max, position.sortOrder + 1), 0);
      this.run(this.eventService.addOperationPosition(this.operationId(), this.crew().groupId, { ...payload, sortOrder }), 'Poste ajouté.', 'Ajout du poste impossible.', () => this.editing.set(null));
    } else {
      const current = this.crew().positions.find(position => position.id === editing);
      this.run(this.eventService.updateOperationPosition(this.operationId(), this.crew().groupId, editing, { ...payload, sortOrder: current?.sortOrder ?? 0 }), 'Poste enregistré.', 'Enregistrement du poste impossible.', () => this.editing.set(null));
    }
  }

  deletePosition(position: CrewPosition): void {
    if (position.taken > 0 || this.busy()) return;
    this.confirmService.ask({ title: `Supprimer le poste « ${position.label} » ?`, message: 'Personne n’occupe ce poste.', confirmLabel: 'Supprimer le poste', cancelLabel: 'Annuler', danger: true }).then(confirmed => {
      if (confirmed) this.run(this.eventService.deleteOperationPosition(this.operationId(), this.crew().groupId, position.id), 'Poste supprimé.', 'Suppression du poste impossible.');
    });
  }

  setMode(mode: PositionMode): void {
    if (mode === this.crew().positionMode) return;
    const group = this.group();
    // Les autres réglages du groupe sont renvoyés tels qu'ils sont enregistrés : seule l'attribution des postes change.
    this.run(this.eventService.updateOperationGroup(this.operationId(), group.id, {
      name: group.name, description: group.description ?? '', capacity: group.capacity ?? null, parentId: group.parentId ?? null,
      assignmentMode: group.assignmentMode, sortOrder: group.sortOrder, responsibleUserId: group.responsibleUserId ?? null, positionMode: mode
    }), 'Attribution des postes enregistrée.', 'Changement impossible.');
  }

  assign({ member, positionId, select }: CrewPositionChange): void {
    this.run(this.eventService.setOperationMemberPosition(this.operationId(), member.userId, positionId),
      positionId === null ? `${member.username} n’a plus de poste.` : `Poste de ${member.username} enregistré.`, 'Attribution du poste impossible.',
      // Refus : la liste revient au poste réel du membre, elle ne garde pas le choix refusé.
      undefined, () => { select.value = member.positionId === null ? '' : String(member.positionId); });
  }

  /** L'équipage prend les postes, la capacité et l'attribution des postes du preset, puis suit ses modifications. */
  applyPreset(presetId: string): void {
    const preset = this.presets().find(candidate => candidate.id === presetId);
    if (!preset || this.busy()) return;
    const kept = new Set(preset.positions.map(position => position.label.trim().toLocaleLowerCase()));
    const dropped = this.crew().positions.filter(position => !kept.has(position.label.trim().toLocaleLowerCase()));
    const displaced = dropped.reduce((sum, position) => sum + position.taken, 0);
    const message = [
      `Les postes de l’équipage deviennent ceux du preset (${preset.positions.map(position => position.label).join(', ')}), avec ses pictogrammes et ses places.`,
      dropped.length ? `Supprimé${dropped.length > 1 ? 's' : ''} : ${dropped.map(position => position.label).join(', ')}.` : '',
      displaced ? `${displaced} membre${displaced > 1 ? 's restent' : ' reste'} dans l’équipage, sans poste.` : '',
      'Les prochaines modifications du preset s’appliqueront ici, tant que les postes ne sont pas retouchés à la main.'
    ].filter(Boolean).join(' ');
    this.confirmService.ask({ title: `Appliquer « ${preset.name} » ?`, message, confirmLabel: 'Appliquer le preset', cancelLabel: 'Annuler' }).then(confirmed => {
      if (confirmed) this.run(this.eventService.followCrewPreset(this.operationId(), this.crew().groupId, preset.id), `L’équipage suit « ${preset.name} ».`, 'Le preset n’a pas pu être appliqué.');
    });
  }
}
