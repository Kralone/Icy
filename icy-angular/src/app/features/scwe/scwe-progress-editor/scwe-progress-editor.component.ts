import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ScWorldEventDto, ScWorldEventParticipationDto } from '../../../model/scwe-player.model';
import { ScwePlayerService } from '../../../core/services/scworldevent/scwe-player.service';

type ProgressForm = FormGroup<Record<string, FormControl<number>>>;

@Component({
  selector: 'app-scwe-progress-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scwe-progress-editor.component.html',
})
export class ScweProgressEditorComponent implements OnChanges {
  @Input() event!: ScWorldEventDto;
  @Input() participation: ScWorldEventParticipationDto | null = null;
  @Input() readonly = false;

  @Output() saved = new EventEmitter<ScWorldEventParticipationDto>();

  saving = false;
  savedOk = false;
  error: string | null = null;

  schema: any | null = null;
  fields: any[] = [];

  form: ProgressForm | null = null;

  // ✅ AJOUT : Pour gérer l'ouverture des tooltips sur mobile
  activeMilestoneIndex: string | null = null;

  protected readonly Math = Math;

  constructor(private scwe: ScwePlayerService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['event'] || changes['participation']) {
      const rawSchema = (this.event as any)?.scoreSchema;
      try {
        this.schema = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : rawSchema;
      } catch (e) {
        this.schema = null;
      }

      this.fields = Array.isArray(this.schema?.fields) ? this.schema.fields : [];
      this.buildForm();
    }

    if (changes['readonly'] && this.form) {
      if (this.readonly) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    }
  }

  // ✅ AJOUT : Méthode pour le clic Milestone
  toggleMilestone(uid: string, event: Event) {
    event.stopPropagation();
    event.preventDefault(); // Pour éviter les comportements natifs indésirables sur mobile
    if (this.activeMilestoneIndex === uid) {
      this.activeMilestoneIndex = null;
    } else {
      this.activeMilestoneIndex = uid;
    }
  }

  private buildForm() {
    let rawPoints = this.participation?.points;
    const progress = rawPoints ?? {};
    const controls: Record<string, FormControl<number>> = {};

    for (const f of this.fields) {
      const val = Number(progress[f.key]);
      controls[f.key] = new FormControl<number>(Number.isFinite(val) ? val : 0, { nonNullable: true });
    }

    this.form = new FormGroup(controls) as ProgressForm;

    if (this.readonly) this.form.disable({ emitEvent: false });
  }

  getTotal(): number {
    const keys = this.schema?.total?.keys ?? this.fields.map(f => f.key);
    let total = 0;
    for (const k of keys) total += Number(this.form?.controls?.[k]?.value ?? 0);
    return total;
  }

  clamp(val: number, f: any): number {
    const min = Number(f.min ?? 0);
    const max = Number(f.max ?? Number.MAX_SAFE_INTEGER);
    if (!Number.isFinite(val)) val = 0;
    return Math.min(max, Math.max(min, val));
  }

  step(f: any, delta: number) {
    if (this.readonly || !this.form) return;
    const c = this.form.controls[f.key];
    const next = this.clamp(Number(c.value ?? 0) + delta, f);
    c.setValue(next, { emitEvent: false });
  }

  onManualInput(f: any) {
    if (!this.form) return;
    const c = this.form.controls[f.key];
    c.setValue(this.clamp(Number(c.value ?? 0), f), { emitEvent: false });
  }

  save() {
    if (this.readonly || !this.form || !this.event?.id) return;

    this.saving = true;
    this.savedOk = false;
    this.error = null;

    const points: Record<string, number> = {};
    for (const f of this.fields) {
      points[f.key] = Number(this.form.controls[f.key].value ?? 0);
    }

    const status = this.participation?.status ?? 0;

    this.scwe.updateMyParticipation(this.event.id, status, points).subscribe({
      next: (res) => {
        this.participation = res;
        this.saved.emit(res);
        this.saving = false;
        this.savedOk = true;
        setTimeout(() => (this.savedOk = false), 2000);
      },
      error: (err) => {
        console.error('Erreur API :', err);
        this.saving = false;
        this.error = 'Impossible d’enregistrer ta progression.';
      }
    });
  }

  trackByKey(_: number, f: any) {
    return f.key;
  }
}
