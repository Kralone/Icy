import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, switchMap } from 'rxjs';
import { CatalogEntry } from '../../../core/services/catalog/catalog.service';
import { EventService } from '../../../core/services/event/event.service';
import { OperationIconComponent } from '../briefing/operation-icon.component';
import { CrewPreset, POSITION_MODE_LABELS, positionIcon } from './operation-crew.model';
import { OrganizationGroup, sortedChildren } from './operation-organization.model';
import { OperationShipPickerComponent } from './operation-ship-picker.component';

type CrewSetup = 'free' | 'custom' | 'preset';

/** Création d'un équipage de vaisseau : où le placer, quel modèle, quelle configuration de départ. */
@Component({
  selector: 'app-operation-crew-builder',
  standalone: true,
  imports: [FormsModule, OperationIconComponent, OperationShipPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operation-crew-builder.component.html',
  styleUrl: './operation-crew-builder.component.css'
})
export class OperationCrewBuilderComponent {
  private readonly eventService = inject(EventService);
  private readonly destroyRef = inject(DestroyRef);

  readonly operationId = input.required<string>();
  readonly groups = input.required<OrganizationGroup[]>();
  /** Groupes qui sont déjà des équipages : ils ne reçoivent pas de sous-groupe. */
  readonly crewIds = input<ReadonlySet<number>>(new Set());
  /** Groupe principal proposé d'emblée ; null : équipage autonome. */
  readonly initialParentId = input<number | null>(null);
  /** L'équipage existe : son identifiant, et s'il faut ouvrir tout de suite ses postes. */
  readonly created = output<{ groupId: number; openPositions: boolean; warning?: string }>();
  readonly cancel = output<void>();
  /** Vrai pendant la création : l'éditeur garde alors le constructeur ouvert pour recevoir le résultat. */
  readonly busyChange = output<boolean>();

  readonly parentId = signal<number | null>(null);
  readonly model = signal<CatalogEntry | null>(null);
  readonly setup = signal<CrewSetup>('free');
  readonly presets = signal<CrewPreset[]>([]);
  readonly presetsState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly presetId = signal<string | null>(null);
  readonly name = signal('');
  readonly capacity = signal<number | null>(null);
  readonly addNeed = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly nameEdited = signal(false);

  /** Une recherche est saisie dans le sélecteur de vaisseau. */
  readonly searchTyped = signal(false);
  /** Vrai dès qu'il y a une saisie à perdre : l'éditeur demande confirmation avant de fermer. */
  readonly dirty = computed(() => !!this.model() || this.searchTyped() || this.nameEdited());
  readonly dirtyChange = output<boolean>();

  readonly modeLabels = POSITION_MODE_LABELS;
  readonly positionIcon = positionIcon;

  /** Un groupe principal accueille un équipage s'il n'est pas lui-même un équipage et n'a pas de membres affectés directement. */
  readonly parents = computed(() => sortedChildren(this.groups(), null).filter(group => !this.crewIds().has(group.id) && (group.container || group.members.length === 0)));
  readonly selectedPreset = computed(() => this.presets().find(preset => preset.id === this.presetId()) ?? null);
  readonly ready = computed(() => !!this.model() && !!this.name().trim() && (this.setup() !== 'preset' || !!this.selectedPreset())
    && !this.capacityOutOfRange());
  readonly capacityOutOfRange = computed(() => this.capacity() !== null && (this.capacity()! < 1 || this.capacity()! > 10000));

  constructor() {
    effect(() => this.busyChange.emit(this.saving()));
    effect(() => this.dirtyChange.emit(this.dirty()));
    effect(() => {
      const initial = this.initialParentId();
      untracked(() => this.parentId.set(initial !== null && this.parents().some(group => group.id === initial) ? initial : null));
    });
  }

  chooseModel(model: CatalogEntry): void {
    this.model.set(model);
    this.searchTyped.set(false);
    if (!this.nameEdited()) this.name.set(`Équipage ${model.name}`);
    this.presetId.set(null);
    if (this.setup() === 'preset') this.setup.set('free');
    this.loadPresets(model.id);
  }

  changeModel(): void {
    this.model.set(null);
    this.presets.set([]);
    this.presetId.set(null);
    if (this.setup() === 'preset') this.setup.set('free');
  }

  loadPresets(modelId: number): void {
    this.presetsState.set('loading');
    this.eventService.getCrewPresets(modelId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: presets => { if (this.model()?.id !== modelId) return; this.presets.set(presets); this.presetsState.set('idle'); },
      error: () => { if (this.model()?.id !== modelId) return; this.presets.set([]); this.presetsState.set('error'); }
    });
  }

  setName(value: string): void {
    this.nameEdited.set(true);
    this.name.set(value);
  }

  setCapacity(value: string | number | null): void {
    const text = value === null ? '' : String(value).trim();
    const parsed = Math.trunc(Number(text));
    this.capacity.set(text === '' || Number.isNaN(parsed) ? null : parsed);
  }

  choosePreset(preset: CrewPreset): void {
    this.setup.set('preset');
    this.presetId.set(preset.id);
  }

  /** Nom libre dans son niveau : deux sous-groupes d'un même groupe ne peuvent pas porter le même nom. */
  private freeName(): string {
    const taken = new Set(sortedChildren(this.groups(), this.parentId()).map(group => group.name.trim().toLocaleLowerCase()));
    const base = this.name().trim();
    let name = base;
    for (let index = 2; taken.has(name.toLocaleLowerCase()); index++) name = `${base} ${index}`;
    return name;
  }

  submit(): void {
    const model = this.model();
    if (!model || !this.ready() || this.saving()) return;
    const preset = this.setup() === 'preset' ? this.selectedPreset() : null;
    this.saving.set(true);
    this.error.set('');
    this.eventService.createOperationGroup(this.operationId(), {
      name: this.freeName(), description: '', capacity: this.capacity(), parentId: this.parentId(), assignmentMode: 'INHERITED',
      sortOrder: sortedChildren(this.groups(), this.parentId()).length, responsibleUserId: null,
      kind: 'CREW', shipModelId: model.id, presetId: preset?.id ?? null
    }).pipe(
      switchMap((response: any) => {
        const groupId = response?.data?.id as number;
        const result = { groupId, openPositions: this.setup() === 'custom' };
        if (!this.addNeed()) return of(result);
        // Le besoin passe par le circuit existant : l'équipage reste créé même si cette seconde écriture échoue.
        return this.eventService.createOperationShipRequirement(this.operationId(), { groupId, shipModelId: model.id, quantity: 1, notes: '' }).pipe(
          map(() => result),
          catchError(() => of({ ...result, warning: 'L’équipage est créé, mais le besoin en appareil n’a pas pu être ajouté.' })));
      })
    ).subscribe({
      next: result => { this.saving.set(false); this.created.emit(result); },
      error: error => { this.saving.set(false); this.error.set(error?.error?.message || 'Création de l’équipage impossible.'); }
    });
  }
}
