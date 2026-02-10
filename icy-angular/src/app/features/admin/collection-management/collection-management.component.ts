import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CollectionsService } from '../../../core/services/collection/collection.service';

@Component({
  selector: 'app-collection-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './collection-management.component.html',
})
export class CollectionManagementComponent {

  // --- Création ---
  newTemplate = {
    name: '',
    archetype: '',
    axisX: [{ label: '' }],
    axisY: [{ label: '' }],
  };

  isSubmitting = false;
  isLoadingTemplateDetail = false;

  // UI state
  templateSearchTerm = '';
  templateFilterArchetype = 'all';
  templatePage = 1;
  readonly templatePageSize = 8;

  constructor(private service: CollectionsService, private router: Router) {}

  trackByIndex = (_: number, __: unknown) => _;
  trackByTemplateId = (_: number, item: any) => item?.id ?? _;

  get canCreate(): boolean {
    const nameOk = this.newTemplate.name.trim().length > 0;
    const archetypeOk = this.newTemplate.archetype.trim().length > 0;
    const axisXOk = this.newTemplate.axisX.some(a => a.label.trim().length > 0);
    const axisYOk = this.newTemplate.axisY.some(a => a.label.trim().length > 0);
    return nameOk && archetypeOk && axisXOk && axisYOk && !this.isSubmitting;
  }

  async createTemplate() {
    if (!this.canCreate) return;
    this.isSubmitting = true;

    const payload = {
      name: this.newTemplate.name.trim(),
      archetype: this.newTemplate.archetype.trim(),
      axisX: this.newTemplate.axisX.map(a => a.label.trim()).filter(Boolean),
      axisY: this.newTemplate.axisY.map(a => a.label.trim()).filter(Boolean),
    };

    this.service.createTemplate(payload).subscribe({
      next: (res) => {
        console.log('✅ Template créé avec succès :', res);
        this.isSubmitting = false;
        this.newTemplate = { name: '', archetype: '', axisX: [{ label: '' }], axisY: [{ label: '' }] };
        this.loadTemplates(); // Recharge la liste immédiatement
      },
      error: (err) => {
        console.error('❌ Erreur lors de la création du template :', err);
        this.isSubmitting = false;
      }
    });
  }


  cancel() {
    this.router.navigate(['/collections']);
  }

  // --- Gestion des templates existants ---
  templates: any[] = [];
  isLoadingTemplates = false;
  editingTemplate: any = null;
  isUpdatingTemplate = false;

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.isLoadingTemplates = true;
    this.service.getAllTemplates().subscribe({
      next: (res) => {
        this.templates = res.data || res;
        this.isLoadingTemplates = false;
        this.templatePage = 1;
      },
      error: (err) => {
        console.error('Erreur chargement templates', err);
        this.isLoadingTemplates = false;
      },
    });
  }

  deleteTemplate(template: any) {
    if (!confirm(`Supprimer le template "${template.name}" ?`)) return;
    this.service.deleteTemplate(template.name).subscribe({
      next: () => this.loadTemplates(),
      error: (err) => console.error('Erreur suppression template', err),
    });
  }

  // 🧩 Charger et ouvrir l’édition complète du template
  editTemplate(template: any) {
    this.editingTemplate = { loading: true };
    this.isLoadingTemplateDetail = true;

    this.service.getTemplateById(template.id).subscribe({
      next: (res) => {
        const t = res.data || res;

        // 🧩 Fonction pour transformer la structure du backend
        const normalizeAxis = (axis: any): { label: string }[] => {
          if (!axis) return [];
          if (Array.isArray(axis)) return axis.map(v => ({ label: v.label ?? v }));
          if (axis.values && Array.isArray(axis.values)) {
            return axis.values.map((v: any) => ({ label: v.label ?? '' }));
          }
          return [];
        };

        this.editingTemplate = {
          id: t.id,
          name: t.name,
          archetype: t.archetype,
          axisX: normalizeAxis(t.axisX),
          axisY: normalizeAxis(t.axisY),
        };

        this.isLoadingTemplateDetail = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du template complet', err);
        this.isLoadingTemplateDetail = false;
        this.editingTemplate = null;
      },
    });
  }


  cancelEdit() {
    this.editingTemplate = null;
  }

  updateTemplate() {
    if (!this.editingTemplate) return;
    this.isUpdatingTemplate = true;

    const payload = {
      id: this.editingTemplate.id,
      name: this.editingTemplate.name,
      archetype: this.editingTemplate.archetype,
      axisX: {
        name: 'X',
        values: this.editingTemplate.axisX.map((a: any, index: number) => ({
          id: a.label.toLowerCase().replace(/\s+/g, '_'),
          label: a.label.trim(),
        })),
      },
      axisY: {
        name: 'Y',
        values: this.editingTemplate.axisY.map((a: any, index: number) => ({
          id: a.label.toLowerCase().replace(/\s+/g, '_'),
          label: a.label.trim(),
        })),
      },
    };

    this.service.updateTemplate(payload).subscribe({
      next: () => {
        this.isUpdatingTemplate = false;
        this.editingTemplate = null;
        this.loadTemplates();
      },
      error: (err) => {
        console.error('Erreur mise à jour template', err);
        this.isUpdatingTemplate = false;
      },
    });
  }

  get templateArchetypes(): string[] {
    const values = new Set(
      (this.templates || [])
        .map((t: any) => t?.archetype)
        .filter((v: string) => typeof v === 'string' && v.trim().length > 0)
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  get filteredTemplates(): any[] {
    const term = this.templateSearchTerm.trim().toLowerCase();
    return (this.templates || []).filter((t: any) => {
      const archetype = (t?.archetype ?? '').toLowerCase();
      if (this.templateFilterArchetype !== 'all' && t?.archetype !== this.templateFilterArchetype) {
        return false;
      }
      if (!term) return true;
      const haystack = `${t?.name ?? ''} ${t?.archetype ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  get templateTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTemplates.length / this.templatePageSize));
  }

  get templatePageIndex(): number {
    return Math.min(this.templatePage, this.templateTotalPages);
  }

  get pagedTemplates(): any[] {
    const start = (this.templatePageIndex - 1) * this.templatePageSize;
    return this.filteredTemplates.slice(start, start + this.templatePageSize);
  }

  nextTemplatePage(): void {
    if (this.templatePageIndex < this.templateTotalPages) this.templatePage += 1;
  }

  prevTemplatePage(): void {
    if (this.templatePageIndex > 1) this.templatePage -= 1;
  }

  onTemplateSearchChange(term: string): void {
    this.templateSearchTerm = term;
    this.templatePage = 1;
  }

  onTemplateFilterChange(value: string): void {
    this.templateFilterArchetype = value;
    this.templatePage = 1;
  }

// Ajoute un axe (création ou édition)
  addAxis(axis: 'x' | 'y', target: 'new' | 'edit' = 'new') {
    const template = target === 'new' ? this.newTemplate : this.editingTemplate;
    if (!template) return;

    const key = axis === 'x' ? 'axisX' : 'axisY';
    template[key] = template[key] || [];
    template[key].push({ label: '' });
  }

// Supprime un axe (création ou édition)
  removeAxis(axis: 'x' | 'y', index: number, target: 'new' | 'edit' = 'new') {
    const template = target === 'new' ? this.newTemplate : this.editingTemplate;
    if (!template) return;

    const key = axis === 'x' ? 'axisX' : 'axisY';
    if (template[key].length > 1) {
      template[key].splice(index, 1);
    } else {
      template[key][0].label = '';
    }
  }

}
