import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../../model/user.model';
import { AssignmentMode, EffectiveAssignmentMode, GroupSettings, MODE_HINTS, MODE_LABELS, occupancyLabel, occupancyPercent, OrganizationGroup, sortedChildren } from './operation-organization.model';

export type GroupPanelTab = 'equipage' | 'ressources' | 'reglages';

/** Fiche du groupe sélectionné : repères, équipage, ressources et réglages. Rien d'autre n'est affiché. */
@Component({
  selector: 'app-operation-group-panel',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-group-panel.component.html',
  styleUrl: './operation-group-panel.component.css'
})
export class OperationGroupPanelComponent {
  readonly group = input.required<OrganizationGroup>();
  readonly groups = input.required<OrganizationGroup[]>();
  readonly members = input<User[]>([]);
  readonly busy = input(false);
  /** Opération terminée : ni déplacement, ni suppression, ni réglages. */
  readonly locked = input(false);
  readonly defaultMode = input<EffectiveAssignmentMode>('FREE');
  /** Onglet à ouvrir quand un autre groupe est sélectionné (les réglages juste après une création). */
  readonly openTab = input<GroupPanelTab>('equipage');
  readonly save = output<GroupSettings>();
  readonly remove = output<void>();
  readonly move = output<-1 | 1>();
  readonly addSubgroup = output<void>();
  readonly back = output<void>();
  readonly selectGroup = output<number>();
  /** Vrai tant que des réglages saisis ne sont pas enregistrés. */
  readonly dirtyChange = output<boolean>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tab = signal<GroupPanelTab>('equipage');
  readonly settings = signal<GroupSettings>({ name: '', description: '', capacity: null, parentId: null, assignmentMode: 'INHERITED', sortOrder: 0, responsibleUserId: null });
  readonly modeLabels = MODE_LABELS;
  readonly modeHints = MODE_HINTS;
  readonly modes: AssignmentMode[] = ['INHERITED', 'FREE', 'VALIDATION', 'MANAGED'];

  readonly parent = computed(() => this.groups().find(candidate => candidate.id === this.group().parentId) ?? null);
  readonly children = computed(() => sortedChildren(this.groups(), this.group().id));
  readonly siblings = computed(() => sortedChildren(this.groups(), this.group().parentId ?? null));
  readonly position = computed(() => this.siblings().findIndex(candidate => candidate.id === this.group().id));
  /** Places restantes, en tenant compte du plafond du groupe parent ; null sans aucune limite. */
  readonly freeSeats = computed(() => {
    const limits = [this.group(), this.parent()].filter((candidate): candidate is OrganizationGroup => !!candidate && candidate.capacity !== null)
      .map(candidate => Math.max(0, candidate.capacity! - candidate.memberCount));
    return limits.length ? Math.min(...limits) : null;
  });
  readonly nameTaken = computed(() => {
    const name = this.settings().name.trim().toLocaleLowerCase();
    return !!name && this.siblings().some(candidate => candidate.id !== this.group().id && candidate.name.trim().toLocaleLowerCase() === name);
  });
  readonly capacityTooLow = computed(() => this.settings().capacity !== null && this.settings().capacity! < this.group().memberCount);
  readonly invalid = computed(() => !this.settings().name.trim() || this.nameTaken() || this.capacityTooLow() || (this.settings().capacity !== null && this.settings().capacity! < 0));
  readonly changed = computed(() => {
    const group = this.group();
    const settings = this.settings();
    return settings.name.trim() !== group.name || (settings.description ?? '') !== (group.description ?? '') || settings.capacity !== (group.capacity ?? null)
      || settings.assignmentMode !== group.assignmentMode || settings.responsibleUserId !== (group.responsibleUserId ?? null);
  });

  constructor() {
    // Un autre groupe est sélectionné : le formulaire repart de ses valeurs et l'onglet demandé s'ouvre.
    let shownId: number | null = null;
    let baseline = '';
    effect(() => {
      const group = this.group();
      const requestedTab = this.openTab();
      untracked(() => {
        const fromServer: GroupSettings = { name: group.name, description: group.description ?? '', capacity: group.capacity ?? null, parentId: group.parentId ?? null, assignmentMode: group.assignmentMode, sortOrder: group.sortOrder, responsibleUserId: group.responsibleUserId ?? null };
        const sameGroup = group.id === shownId;
        const edited = sameGroup && this.editableKey(this.settings()) !== baseline;
        if (!sameGroup) {
          shownId = group.id;
          this.tab.set(requestedTab);
          if (requestedTab === 'reglages') setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('input[name="name"]')?.select());
        }
        baseline = this.editableKey(fromServer);
        // Les données du même groupe ont été relues (ordre, effectifs) : une saisie en cours est conservée.
        if (edited) this.settings.update(current => ({ ...current, parentId: fromServer.parentId, sortOrder: fromServer.sortOrder }));
        else this.settings.set(fromServer);
      });
    });
    effect(() => this.dirtyChange.emit(this.changed()));
  }

  private editableKey(settings: GroupSettings): string {
    return JSON.stringify([settings.name, settings.description, settings.capacity, settings.assignmentMode, settings.responsibleUserId]);
  }

  occupancy(group: OrganizationGroup): string { return occupancyLabel(group); }
  percent(group: OrganizationGroup): number | null { return occupancyPercent(group); }

  modeSummary(): string {
    const group = this.group();
    if (group.container) return 'Par sous-groupe';
    return group.assignmentMode === 'INHERITED' ? `${this.modeLabels[group.effectiveMode]} · hérité` : this.modeLabels[group.effectiveMode];
  }

  /** Mode qui s'appliquerait sans réglage propre : celui du parent, sinon celui de l'opération. */
  readonly inheritedMode = computed<EffectiveAssignmentMode>(() => this.parent()?.effectiveMode ?? this.defaultMode());

  inheritedLabel(): string {
    const parent = this.parent();
    return `Hérité ${parent ? 'de ' + parent.name : 'de l’opération'} (${this.modeLabels[this.inheritedMode()]})`;
  }

  settingsModeHint(): string {
    const mode = this.settings().assignmentMode;
    return this.modeHints[mode === 'INHERITED' ? this.inheritedMode() : mode];
  }

  patch(change: Partial<GroupSettings>): void { this.settings.update(current => ({ ...current, ...change })); }

  setCapacity(value: string | number | null): void {
    const text = value === null ? '' : String(value).trim();
    const parsed = Math.trunc(Number(text));
    this.patch({ capacity: text === '' || Number.isNaN(parsed) ? null : parsed });
  }

  submit(): void {
    if (this.invalid() || !this.changed() || this.busy()) return;
    this.save.emit({ ...this.settings(), name: this.settings().name.trim() });
  }

  hasMember(id: string | null): boolean { return !!id && this.members().some(member => member.id === id); }
}
