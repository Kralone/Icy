import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScWorldEventService, ScWorldEventType } from '../../../../../core/services/scworldevent/sc-world-event.service';
import { ScweSchemaBuilderComponent } from '../scwe-schema-builder/scwe-schema-builder.component';
import { SchemaFormModel } from '../../models/scwe-schema.model';

@Component({
  selector: 'app-scwe-types-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ScweSchemaBuilderComponent],
  templateUrl: './scwe-types-admin.component.html',
})
export class ScweTypesAdminComponent {
  @Input() types: ScWorldEventType[] = [];
  @Output() typesUpdated = new EventEmitter<void>();
  @Output() message = new EventEmitter<{ type: 'success' | 'error', text: string } | null>();

  loading = false;

  editingType: ScWorldEventType | null = null;

  typeForm = {
    name: '',
    textColor: '',
    imageUrl: '',
    scoreSchema: '',
  };

  schemaModel: SchemaFormModel | null = null;
  schemaJson: string = '{}';
  schemaError: string | null = null;

  constructor(private api: ScWorldEventService) {
    this.reset();
  }

  reset() {
    this.editingType = null;
    this.typeForm = {
      name: '',
      textColor: '',
      imageUrl: '',
      scoreSchema: '',
    };
    this.schemaModel = null; // builder will use its own default, we get updates via outputs
    this.schemaJson = '{}';
    this.schemaError = null;
    this.message.emit(null);
  }

  editType(t: ScWorldEventType) {
    this.message.emit(null);
    this.editingType = t;

    this.typeForm = {
      name: t.name,
      textColor: t.textColor ?? '',
      imageUrl: t.imageUrl ?? '',
      scoreSchema: t.scoreSchema ?? '{}',
    };

    // Let the builder parse JSON by giving it a model derived from JSON (simple parse here)
    this.schemaModel = this.parseSchemaToModel(this.typeForm.scoreSchema);
    this.schemaJson = this.prettyJson(this.typeForm.scoreSchema);
  }

  saveType() {
    this.message.emit(null);

    if (this.schemaError) {
      this.message.emit({ type: 'error', text: this.schemaError });
      return;
    }

    const name = this.typeForm.name.trim();
    if (!name) {
      this.message.emit({ type: 'error', text: 'Le nom du type est requis.' });
      return;
    }

    const payload = {
      name,
      textColor: this.typeForm.textColor?.trim() || undefined,
      imageUrl: this.typeForm.imageUrl?.trim() || undefined,
      scoreSchema: this.schemaJson?.trim() || '{}',
    };

    if (!this.isValidJson(payload.scoreSchema)) {
      this.message.emit({ type: 'error', text: 'Le schema (JSON) est invalide.' });
      return;
    }

    this.loading = true;

    const req = this.editingType
      ? this.api.updateType(this.editingType.name, { textColor: payload.textColor, imageUrl: payload.imageUrl, scoreSchema: payload.scoreSchema })
      : this.api.createType(payload as any);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.message.emit({ type: 'success', text: this.editingType ? 'Type mis à jour.' : 'Type créé.' });
        this.reset();
        this.typesUpdated.emit();
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible d’enregistrer le type.' });
      }
    });
  }

  deleteType(t: ScWorldEventType) {
    this.message.emit(null);
    if (!confirm(`Supprimer le type "${t.name}" ?`)) return;

    this.loading = true;
    this.api.deleteType(t.name).subscribe({
      next: () => {
        this.loading = false;
        this.message.emit({ type: 'success', text: 'Type supprimé.' });
        if (this.editingType?.name === t.name) this.reset();
        this.typesUpdated.emit();
      },
      error: () => {
        this.loading = false;
        this.message.emit({ type: 'error', text: 'Impossible de supprimer le type (utilisé par un event ?).' });
      }
    });
  }

  // Outputs from builder
  onSchemaModelChange(m: SchemaFormModel) {
    this.schemaModel = m;
  }

  onSchemaJsonChange(json: string) {
    this.schemaJson = json;
  }

  onSchemaErrorChange(err: string | null) {
    this.schemaError = err;
  }

  // Helpers
  isValidJson(str: string): boolean {
    try { JSON.parse(str); return true; } catch { return false; }
  }

  prettyJson(str: string): string {
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
  }

  parseSchemaToModel(jsonStr: string): SchemaFormModel | null {
    // Minimal parse, builder will normalize anyway. If invalid, return null => builder default.
    try {
      const parsed = JSON.parse(jsonStr || '{}');
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        version: Number(parsed.version ?? 1),
        fields: Array.isArray(parsed.fields) ? parsed.fields.map((f: any) => ({
          key: String(f.key ?? ''),
          label: String(f.label ?? ''),
          min: f.min ?? 0,
          max: f.max ?? 0,
          milestones: Array.isArray(f.milestones) ? f.milestones.map((m: any) => ({
            at: (m.at ?? null),
            label: String(m.label ?? ''),
            imageUrl: String(m.imageUrl ?? ''),
            reward: String(m.reward ?? ''),
          })) : [],
        })) : [],
        total: {
          mode: 'sum',
          keys: Array.isArray(parsed.total?.keys) ? parsed.total.keys.map((k: any) => String(k)) : [],
          milestones: Array.isArray(parsed.total?.milestones) ? parsed.total.milestones.map((m: any) => ({
            at: (m.at ?? null),
            label: String(m.label ?? ''),
            imageUrl: String(m.imageUrl ?? ''),
            reward: String(m.reward ?? ''),
          })) : [],
        }
      };
    } catch {
      return null;
    }
  }
}
