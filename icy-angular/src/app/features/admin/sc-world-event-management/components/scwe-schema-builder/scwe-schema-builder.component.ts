import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchemaFormModel, FieldForm, MilestoneForm, SchemaTab } from '../../models/scwe-schema.model';

@Component({
  selector: 'app-scwe-schema-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scwe-schema-builder.component.html',
})
export class ScweSchemaBuilderComponent implements OnInit, OnChanges {
  @Input() model: SchemaFormModel | null = null;
  @Input() initialJson: string | null = null;

  @Output() modelChange = new EventEmitter<SchemaFormModel>(); // -> emit only on blur / structural changes
  @Output() jsonChange = new EventEmitter<string>();           // -> emit live (debounced)
  @Output() errorChange = new EventEmitter<string | null>();

  tab: SchemaTab = 'form';
  generatedJson: string = '{}';
  local: SchemaFormModel = this.defaultModel();

  // ---- anti-loop / perf ----
  private normalizing = false;
  private lastAppliedFingerprint = '';
  private lastEmittedModelFingerprint = '';
  private debounceTimer: any = null;

  ngOnInit(): void {
    this.applyInputsIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['initialJson']) {
      this.applyInputsIfNeeded();
    }
  }

  private applyInputsIfNeeded() {
    const incoming = this.model
      ? this.model
      : (this.initialJson && this.isValidJson(this.initialJson))
        ? this.parseJsonToModel(this.initialJson) ?? this.defaultModel()
        : this.defaultModel();

    const fp = this.fingerprint(incoming);
    if (fp === this.lastAppliedFingerprint) return;

    this.lastAppliedFingerprint = fp;
    this.local = this.clone(incoming);

    // normalize once after applying
    this.normalize({ emitModel: false });
  }

  switchTab(t: SchemaTab) {
    this.tab = t;
  }

  // -------------------------
  // Actions (structural -> emit model)
  // -------------------------
  addField() {
    this.local.fields.push({
      key: '',
      label: '',
      min: null,
      max: null,
      milestones: [],
    });
    this.normalize({ emitModel: true });
  }

  removeField(i: number) {
    const removed = this.local.fields.splice(i, 1);
    const removedKey = removed?.[0]?.key;
    if (removedKey) {
      const nextKeys = (this.local.total.keys || []).filter(k => k !== removedKey);
      if (!this.sameStringArray(this.local.total.keys || [], nextKeys)) {
        this.local.total.keys = nextKeys;
      }
    }
    this.normalize({ emitModel: true });
  }

  addFieldMilestone(i: number) {
    this.local.fields[i].milestones.push({ at: null, label: '', imageUrl: '', reward: '' });
    this.normalize({ emitModel: true });
  }

  removeFieldMilestone(i: number, j: number) {
    this.local.fields[i].milestones.splice(j, 1);
    this.normalize({ emitModel: true });
  }

  addTotalMilestone() {
    this.local.total.milestones.push({ at: null, label: '', imageUrl: '', reward: '' });
    this.normalize({ emitModel: true });
  }

  removeTotalMilestone(j: number) {
    this.local.total.milestones.splice(j, 1);
    this.normalize({ emitModel: true });
  }

  // -------------------------
  // Input handlers
  // -------------------------
  onFieldLabelChange(field: FieldForm) {
    if (!field.key?.trim() && field.label?.trim()) {
      field.key = this.slugify(field.label);
    }
    this.onAnyChange();
  }

  // Called on typing: update JSON live, DO NOT emit model (prevents focus loss)
  onAnyChange() {
    this.scheduleNormalize({ emitModel: false });
  }

  // Called on blur: commit model to parent once user leaves field
  onAnyBlur() {
    this.normalize({ emitModel: true });
  }

  // -------------------------
  // Normalize + Emit
  // -------------------------
  private scheduleNormalize(opts: { emitModel: boolean }) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.normalize(opts), 120);
  }

  private normalize(opts: { emitModel: boolean }) {
    if (this.normalizing) return;
    this.normalizing = true;

    try {
      this.autofillKeysSafe();
      this.sortAllMilestones();

      const err = this.validate(this.local);
      this.errorChange.emit(err);

      const json = JSON.stringify(this.formToSchema(this.local), null, 2);
      this.generatedJson = json;
      this.jsonChange.emit(json);

      if (opts.emitModel) {
        const fp = this.fingerprint(this.local);
        if (fp !== this.lastEmittedModelFingerprint) {
          this.lastEmittedModelFingerprint = fp;
          // Important: emit AFTER blur / structural only, avoids focus loss
          this.modelChange.emit(this.clone(this.local));
        }
      }
    } finally {
      this.normalizing = false;
    }
  }

  private autofillKeysSafe() {
    const used = new Set<string>();

    for (const f of this.local.fields) {
      let k = (f.key || '').trim();
      if (!k && f.label?.trim()) k = this.slugify(f.label);
      if (!k) k = 'field';
      k = this.ensureUniqueKey(k, used);

      if (f.key !== k) f.key = k;
      used.add(k);
    }

    const allowed = new Set(this.local.fields.map(f => f.key));
    const current = this.local.total.keys || [];
    const filtered = current.filter(k => allowed.has(k));

    if (!this.sameStringArray(current, filtered)) {
      this.local.total.keys = filtered;
    }
  }

  private ensureUniqueKey(base: string, used: Set<string>) {
    let k = base;
    let i = 2;
    while (used.has(k)) k = `${base}_${i++}`;
    return k;
  }

  private sortAllMilestones() {
    for (const f of this.local.fields) {
      f.milestones.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    }
    this.local.total.milestones.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  }

  private sameStringArray(a: string[], b: string[]) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  private fingerprint(m: SchemaFormModel): string {
    // Stable fingerprint based on schema output
    return JSON.stringify(this.formToSchema(m));
  }

  // -------------------------
  // Validation
  // -------------------------
  validate(form: SchemaFormModel): string | null {
    if (!form.fields.length) return 'Le schema doit contenir au moins une colonne (field).';

    const keys = form.fields.map(f => (f.key || '').trim());
    if (keys.some(k => !k)) return 'Chaque colonne doit avoir une key.';
    const unique = new Set(keys);
    if (unique.size !== keys.length) return 'Les keys des colonnes doivent être uniques.';

    for (const f of form.fields) {
      const min = f.min === null || f.min === undefined ? null : Number(f.min);
      const max = f.max === null || f.max === undefined ? null : Number(f.max);

      if (min !== null && max !== null && min > max) return `Min > Max pour "${f.label || f.key}".`;

      for (const m of (f.milestones || [])) {
        if (m.at === null || m.at === undefined) continue;
        const at = Number(m.at);
        if (Number.isNaN(at)) return `Un palier de "${f.label || f.key}" a un seuil invalide.`;

        if (min !== null && at < min) return `Un palier de "${f.label || f.key}" est sous le min.`;
        if (max !== null && at > max) return `Un palier de "${f.label || f.key}" est au-dessus du max.`;
      }
    }

    const allowed = new Set(keys);
    for (const k of (form.total.keys || [])) {
      if (!allowed.has(k)) return `Total.keys contient une key inconnue : ${k}`;
    }

    return null;
  }

  // -------------------------
  // Converters
  // -------------------------
  formToSchema(form: SchemaFormModel): any {
    const cleanMilestones = (ms: MilestoneForm[]) =>
      (ms || [])
        .filter(m => m.at !== null && m.at !== undefined && String(m.at).trim() !== '')
        .map(m => ({
          at: Number(m.at),
          label: (m.label || '').trim(),
          imageUrl: (m.imageUrl || '').trim(),
          ...(m.reward && m.reward.trim() ? { reward: m.reward.trim() } : {}),
        }))
        .filter(m => !Number.isNaN(m.at));

    const fields = (form.fields || []).map(f => ({
      key: (f.key || '').trim(),
      label: (f.label || '').trim(),
      ...(f.min !== null && f.min !== undefined && String(f.min).trim() !== '' ? { min: Number(f.min) } : {}),
      ...(f.max !== null && f.max !== undefined && String(f.max).trim() !== '' ? { max: Number(f.max) } : {}),
      milestones: cleanMilestones(f.milestones),
    }));

    return {
      version: form.version ?? 1,
      fields,
      total: {
        mode: 'sum',
        keys: (form.total?.keys || []).map(k => String(k)),
        milestones: cleanMilestones(form.total?.milestones || []),
      }
    };
  }

  parseJsonToModel(jsonStr: string): SchemaFormModel | null {
    try {
      const parsed = JSON.parse(jsonStr || '{}');
      const fields: FieldForm[] = Array.isArray(parsed.fields) ? parsed.fields.map((f: any) => ({
        key: String(f.key ?? '').trim(),
        label: String(f.label ?? '').trim(),
        min: f.min ?? null,
        max: f.max ?? null,
        milestones: Array.isArray(f.milestones) ? f.milestones.map((m: any) => ({
          at: (m.at ?? null),
          label: String(m.label ?? '').trim(),
          imageUrl: String(m.imageUrl ?? '').trim(),
          reward: String(m.reward ?? '').trim(),
        })) : [],
      })) : [];

      const total = parsed.total ?? {};
      return {
        version: Number(parsed.version ?? 1),
        fields,
        total: {
          mode: 'sum',
          keys: Array.isArray(total.keys) ? total.keys.map((k: any) => String(k)) : [],
          milestones: Array.isArray(total.milestones) ? total.milestones.map((m: any) => ({
            at: (m.at ?? null),
            label: String(m.label ?? '').trim(),
            imageUrl: String(m.imageUrl ?? '').trim(),
            reward: String(m.reward ?? '').trim(),
          })) : [],
        }
      };
    } catch {
      return null;
    }
  }

  // 1 colonne par défaut, mais vide (placeholders)
  defaultModel(): SchemaFormModel {
    return {
      version: 1,
      fields: [
        { key: '', label: '', min: null, max: null, milestones: [] }
      ],
      total: {
        mode: 'sum',
        keys: [],
        milestones: [],
      },
    };
  }

  // -------------------------
  // Utils
  // -------------------------
  slugify(s: string): string {
    return (s || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  isValidJson(str: string): boolean {
    try { JSON.parse(str); return true; } catch { return false; }
  }

  clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
