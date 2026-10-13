import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { CatalogEntry } from '../../../core/services/catalog/catalog.service';
import { EventService } from '../../../core/services/event/event.service';
import { OperationIconComponent } from '../../operations/briefing/operation-icon.component';
import { OperationConfirmService } from '../../operations/operation-confirm.service';
import { CrewPreset, POSITION_ICONS, POSITION_MODE_HINTS, POSITION_MODE_LABELS, PositionDraft, positionIcon, PositionMode } from '../../operations/organization/operation-crew.model';
import { OperationShipPickerComponent } from '../../operations/organization/operation-ship-picker.component';

interface PresetDraft {
  id: string | null;
  name: string;
  description: string;
  model: { id: number; name: string; imageUrl: string | null } | null;
  capacity: number | null;
  positionMode: PositionMode;
  positions: PositionDraft[];
}

const MAX_POSITIONS = 30;

/** Bibliothèque des presets d'équipage, réservée aux administrateurs. Un preset est copié dans une opération : le modifier ici ne change aucune opération. */
@Component({
  selector: 'app-crew-presets',
  standalone: true,
  imports: [FormsModule, RouterLink, OperationIconComponent, OperationShipPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crew-presets.component.html',
  styleUrl: './crew-presets.component.css'
})
export class CrewPresetsComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly toast = inject(HotToastService);
  private readonly confirmService = inject(OperationConfirmService);

  readonly presets = signal<CrewPreset[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filter = signal('');
  readonly showArchived = signal(false);
  readonly busy = signal(false);
  /** Preset en cours de saisie ; null : la liste seule est affichée. */
  readonly draft = signal<PresetDraft | null>(null);
  /** Saisie telle qu'elle était à l'ouverture du formulaire : sert à savoir s'il y a quelque chose à perdre. */
  private baseline = '';
  readonly dirty = computed(() => { const draft = this.draft(); return !!draft && JSON.stringify(draft) !== this.baseline; });

  private open(draft: PresetDraft): void {
    this.baseline = JSON.stringify(draft);
    this.draft.set(draft);
  }

  /** Ferme le formulaire : tout de suite s'il n'y a rien à perdre, sinon après abandon confirmé. */
  cancel(): void {
    this.confirmLoss().then(confirmed => { if (confirmed) this.draft.set(null); });
  }

  private confirmLoss(): Promise<boolean> {
    if (!this.dirty()) return Promise.resolve(true);
    return this.confirmService.ask({ title: 'Abandonner les modifications du preset ?', message: 'Les modifications de ce preset ne sont pas enregistrées.', confirmLabel: 'Abandonner les modifications', cancelLabel: 'Continuer la saisie', danger: true });
  }

  /** Garde de navigation : quitter la page avec un preset modifié demande confirmation. */
  canLeave(): boolean | Promise<boolean> {
    return !this.dirty() || this.confirmLoss();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  readonly icons = POSITION_ICONS;
  readonly modes: PositionMode[] = ['SELF', 'MANAGED'];
  readonly modeLabels = POSITION_MODE_LABELS;
  readonly modeHints = POSITION_MODE_HINTS;
  readonly positionIcon = positionIcon;
  readonly maxPositions = MAX_POSITIONS;

  readonly archivedCount = computed(() => this.presets().filter(preset => preset.archived).length);
  readonly visible = computed(() => {
    const text = this.filter().trim().toLocaleLowerCase();
    return this.presets().filter(preset => (this.showArchived() || !preset.archived)
      && (!text || preset.name.toLocaleLowerCase().includes(text) || preset.shipModelName.toLocaleLowerCase().includes(text)));
  });

  readonly draftError = computed(() => {
    const draft = this.draft();
    if (!draft) return '';
    if (!draft.model) return 'Choisissez le vaisseau de ce preset.';
    if (!draft.name.trim() || draft.name.trim() === `${draft.model.name} —`) return 'Donnez un nom au preset.';
    if (draft.capacity !== null && (draft.capacity < 0 || draft.capacity > 10000)) return 'La capacité de l’équipage va de 0 à 10000, ou reste vide.';
    const seen = new Set<string>();
    for (const position of draft.positions) {
      const label = position.label.trim().toLocaleLowerCase();
      if (!label) return 'Chaque poste doit avoir un nom.';
      if (seen.has(label)) return `Deux postes portent le nom « ${position.label.trim()} ».`;
      seen.add(label);
      if (position.capacity !== null && (position.capacity < 1 || position.capacity > 1000)) return `Le poste « ${position.label.trim()} » doit avoir de 1 à 1000 places, ou aucune limite.`;
    }
    return '';
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.eventService.getCrewPresetLibrary().subscribe({
      next: presets => { this.presets.set(presets); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Les presets n’ont pas pu être chargés.'); }
    });
  }

  create(): void {
    this.open({ id: null, name: '', description: '', model: null, capacity: null, positionMode: 'SELF', positions: [] });
  }

  edit(preset: CrewPreset): void {
    this.open({
      id: preset.id, name: preset.name, description: preset.description ?? '',
      // Un modèle sorti du catalogue doit être choisi de nouveau avant d'enregistrer.
      model: preset.shipModelId === null ? null : { id: preset.shipModelId, name: preset.shipModelName, imageUrl: preset.shipModelImageUrl },
      capacity: preset.capacity, positionMode: preset.positionMode,
      positions: preset.positions.map(position => ({ label: position.label, icon: position.icon, capacity: position.capacity }))
    });
  }

  private patch(change: Partial<PresetDraft>): void { this.draft.update(current => current ? { ...current, ...change } : current); }
  set<K extends keyof PresetDraft>(key: K, value: PresetDraft[K]): void { this.patch({ [key]: value } as Partial<PresetDraft>); }

  chooseModel(model: CatalogEntry): void {
    const draft = this.draft();
    if (!draft) return;
    this.patch({ model: { id: model.id, name: model.name, imageUrl: model.imageUrl || null }, name: draft.name.trim() ? draft.name : `${model.name} — ` });
  }

  toNumber(value: string | number | null): number | null {
    const text = value === null ? '' : String(value).trim();
    const parsed = Math.trunc(Number(text));
    return text === '' || Number.isNaN(parsed) ? null : parsed;
  }

  addPosition(): void {
    const draft = this.draft();
    if (!draft || draft.positions.length >= MAX_POSITIONS) return;
    this.patch({ positions: [...draft.positions, { label: '', icon: null, capacity: null }] });
  }

  setPosition(index: number, change: Partial<PositionDraft>): void {
    const draft = this.draft();
    if (!draft) return;
    this.patch({ positions: draft.positions.map((position, at) => at === index ? { ...position, ...change } : position) });
  }

  movePosition(index: number, delta: -1 | 1): void {
    const draft = this.draft();
    const target = index + delta;
    if (!draft || target < 0 || target >= draft.positions.length) return;
    const positions = [...draft.positions];
    [positions[index], positions[target]] = [positions[target], positions[index]];
    this.patch({ positions });
  }

  removePosition(index: number): void {
    const draft = this.draft();
    if (draft) this.patch({ positions: draft.positions.filter((_, at) => at !== index) });
  }

  save(): void {
    const draft = this.draft();
    if (!draft || !draft.model || this.draftError() || this.busy()) return;
    this.busy.set(true);
    this.eventService.saveCrewPreset(draft.id, {
      name: draft.name.trim(), description: draft.description.trim() || null, shipModelId: draft.model.id, capacity: draft.capacity, positionMode: draft.positionMode,
      positions: draft.positions.map(position => ({ label: position.label.trim(), icon: position.icon, capacity: position.capacity }))
    }).subscribe({
      next: () => { this.busy.set(false); this.draft.set(null); this.toast.success(draft.id ? 'Preset enregistré.' : 'Preset créé.'); this.load(); },
      error: error => { this.busy.set(false); this.toast.error(error?.error?.message || (error?.status === 401 || error?.status === 403 ? 'Seul un administrateur peut modifier les presets.' : 'Enregistrement du preset impossible.')); }
    });
  }

  setArchived(preset: CrewPreset, archived: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.eventService.setCrewPresetArchived(preset.id, archived).subscribe({
      next: () => { this.busy.set(false); this.toast.success(archived ? 'Preset archivé : il n’est plus proposé.' : 'Preset rétabli.'); this.load(); },
      error: error => { this.busy.set(false); this.toast.error(error?.error?.message || 'Action impossible.'); }
    });
  }
}
