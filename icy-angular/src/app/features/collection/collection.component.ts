import { Component, OnInit, inject } from '@angular/core';

import { finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CollectionsService } from '../../core/services/collection/collection.service';
import {
  TemplateListItemDTO,
  UserCollectionDetailDTO,
  UserCollectionListItemDTO
} from '../../model/collection.model';
import {AuthService} from '../../core/services/auth/auth.service';
import { CollectionHeroComponent } from './components/collection-hero/collection-hero.component';
import { CollectionStatsComponent } from './components/collection-stats/collection-stats.component';
import { CollectionTemplatesComponent } from './components/collection-templates/collection-templates.component';
import { CollectionListComponent } from './components/collection-list/collection-list.component';
import { CollectionDrawerComponent } from './components/collection-drawer/collection-drawer.component';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [
    CollectionHeroComponent,
    CollectionStatsComponent,
    CollectionTemplatesComponent,
    CollectionListComponent,
    CollectionDrawerComponent
],
  templateUrl: './collection.component.html',
})
export class CollectionComponent implements OnInit {
  private readonly collectionService = inject(CollectionsService);
  constructor(private authService: AuthService) {
  }

  // SECTION 1 : templates
  isLoading = true;
  error: unknown = null;
  templates: TemplateListItemDTO[] = [];
  templateNameById = new Map<number, string>();
  templateById = new Map<number, TemplateListItemDTO>();

  // SECTION 2 : mes collections
  isLoadingUser = true;
  errorUser: unknown = null;
  myCollections: UserCollectionListItemDTO[] = [];
  rowLoading = new Set<number>();
  rowError = new Map<number, unknown>();
  detailCache = new Map<number, UserCollectionDetailDTO>();

  // UI state
  searchTerm = '';
  filterArchetype = 'all';
  filterProgress: 'all' | 'empty' | 'inprogress' | 'complete' = 'all';
  templateSearchTerm = '';
  templatePage = 1;
  readonly templatePageSize = 6;
  readonly getProgressPercentFn = (id: number) => this.getProgressPercent(id);
  readonly formatDateFn = (value?: string) => this.formatDate(value);

  drawerOpen = false;
  selectedCollectionId: number | null = null;


  ngOnInit(): void {
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.loadAllData();
  }

  // ✅ Charge templates, collections et tous les détails d’un coup
  private loadAllData(): void {
    this.isLoading = true;
    this.isLoadingUser = true;
    this.error = null;
    this.errorUser = null;

    forkJoin({
      templates: this.collectionService.getTemplates().pipe(
        catchError(err => {
          console.error('Erreur templates :', err);
          this.error = err;
          return of<TemplateListItemDTO[]>([]);
        })
      ),
      collections: this.collectionService.listUserCollections().pipe(
        catchError(err => {
          console.error('Erreur collections :', err);
          this.errorUser = err;
          return of<UserCollectionListItemDTO[]>([]);
        })
      ),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe(({ templates, collections }) => {
        this.templates = templates ?? [];
        this.templatePage = 1;
        this.myCollections = collections ?? [];

        // Map rapide pour retrouver les noms de template
        this.templateNameById.clear();
        this.templateById.clear();
        this.templates.forEach(t => {
          this.templateNameById.set(t.id, t.name);
          this.templateById.set(t.id, t);
        });

        if (!collections.length) {
          this.isLoadingUser = false;
          return;
        }

        // Charger les détails de chaque collection
        forkJoin(
          collections.map(c =>
            this.collectionService.getUserCollection(c.id).pipe(
              catchError(err => {
                console.error(`Erreur chargement détail ${c.id}`, err);
                return of(null);
              })
            )
          )
        )
          .pipe(finalize(() => (this.isLoadingUser = false)))
          .subscribe(details => {
            details.forEach(d => {
              if (!d) return;
              this.detailCache.set(d.id, d);
              // si le backend embed le template, on garde le nom
              if (d.template?.id && d.template?.name) {
                this.templateNameById.set(d.template.id, d.template.name);
              }
            });
          });
      });
  }

  reloadCollections(): void {
    this.collectionService.listUserCollections().subscribe({
      next: (collections: UserCollectionListItemDTO[]) => {
        // Mise à jour douce sans perdre les détails connus
        const existingIds = new Set(collections.map(c => c.id));
        [...this.detailCache.keys()].forEach(id => {
          if (!existingIds.has(id)) this.detailCache.delete(id);
        });

        this.myCollections = collections;
      },
      error: (err: unknown) => {
        console.error('Erreur de rechargement des collections', err);
      }
    });
  }



  openCollectionDrawer(id: number): void {
    this.selectedCollectionId = id;
    this.drawerOpen = true;
    if (!this.detailCache.has(id)) {
      this.fetchCollectionDetail(id);
    }
  }

  closeCollectionDrawer(): void {
    this.drawerOpen = false;
    this.selectedCollectionId = null;
  }

  private fetchCollectionDetail(id: number): void {
    this.rowError.delete(id);
    this.rowLoading.add(id);

    this.collectionService
      .getUserCollection(id)
      .pipe(finalize(() => this.rowLoading.delete(id)))
      .subscribe({
        next: (detail) => {
          if (detail) {
            this.detailCache.set(id, detail);
          } else {
            console.warn(`Aucun détail renvoyé pour la collection ${id}`);
            this.rowError.set(id, new Error('Aucune donnée reçue'));
          }
        },
        error: (err) => {
          console.error('Erreur lors du chargement du détail', err);
          this.rowError.set(id, err);
        },
      });
  }




  // -------- Helpers d’affichage --------
  getAxisLabels(axis: unknown): string[] {
    if (Array.isArray(axis)) return axis.map((it) => this.labelOf(it));
    if (axis && typeof axis === 'object') {
      const o = axis as Record<string, unknown>;
      if (Array.isArray(o['values'])) return (o['values'] as unknown[]).map(v => this.labelOf(v));
      if (Array.isArray(o['items'])) return (o['items'] as unknown[]).map(v => this.labelOf(v));
      const vals = Object.values(o);
      if (vals.every(v => v == null || ['string', 'number', 'boolean'].includes(typeof v)))
        return vals.map(v => String(v ?? ''));
      return [JSON.stringify(axis)];
    }
    return [];
  }

  private labelOf(item: unknown): string {
    if (item == null) return '';
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return String(o['label'] ?? o['name'] ?? o['value'] ?? o['key'] ?? JSON.stringify(o));
    }
    return String(item);
  }

  get templateArchetypes(): string[] {
    const values = new Set(this.templates.map(t => t.archetype).filter(Boolean));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  get filteredTemplates(): TemplateListItemDTO[] {
    const term = this.templateSearchTerm.trim().toLowerCase();
    if (!term) return this.templates;
    return this.templates.filter((t) =>
      `${t.name} ${t.archetype}`.toLowerCase().includes(term)
    );
  }

  get templateTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTemplates.length / this.templatePageSize));
  }

  get templatePageIndex(): number {
    return Math.min(this.templatePage, this.templateTotalPages);
  }

  get pagedTemplates(): TemplateListItemDTO[] {
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

  getCollectionLabel(collectionId: number): string {
    return (
      this.detailCache.get(collectionId)?.name ??
      this.myCollections.find(c => c.id === collectionId)?.name ??
      `#${collectionId}`
    );
  }

  getCollectionTemplateName(collectionId: number): string {
    const templateId =
      this.detailCache.get(collectionId)?.templateId ??
      this.myCollections.find(c => c.id === collectionId)?.templateId ??
      0;
    return this.templateNameById.get(templateId) ?? `#${templateId}`;
  }

  get filteredCollections(): UserCollectionListItemDTO[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.myCollections.filter((c) => {
      const template = this.templateById.get(c.templateId);
      const archetype = template?.archetype ?? '';
      if (this.filterArchetype !== 'all' && archetype !== this.filterArchetype) {
        return false;
      }

      if (term) {
        const haystack = `${c.name} ${template?.name ?? ''} ${archetype}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (this.filterProgress !== 'all') {
        const progress = this.getProgressPercent(c.id);
        if (progress === null) return false;
        if (this.filterProgress === 'empty' && progress !== 0) return false;
        if (this.filterProgress === 'complete' && progress !== 100) return false;
        if (this.filterProgress === 'inprogress' && (progress === 0 || progress === 100)) return false;
      }

      return true;
    });
  }

  get totalCollections(): number {
    return this.myCollections.length;
  }

  get totalChecked(): number {
    return this.aggregateStats().checked;
  }

  get totalCells(): number {
    return this.aggregateStats().total;
  }

  get completionPercent(): number {
    const total = this.totalCells;
    if (!total) return 0;
    return Math.round((this.totalChecked / total) * 100);
  }

  get selectedCollectionDetail(): UserCollectionDetailDTO | null {
    if (!this.selectedCollectionId) return null;
    return this.detailCache.get(this.selectedCollectionId) ?? null;
  }

  get selectedProgressPercent(): number {
    if (!this.selectedCollectionId) return 0;
    return this.getProgressPercent(this.selectedCollectionId) ?? 0;
  }

  // -------- Checkbox helpers --------
  isChecked(detail: UserCollectionDetailDTO, x: number, y: number): boolean {
    return detail.checked?.includes(`${x}|${y}`) ?? false;
  }

  toggleLocal(detail: UserCollectionDetailDTO, x: number, y: number): void {
    const key = `${x}|${y}`;
    const isNowChecked = !this.isChecked(detail, x, y);

    if (!detail.checked) detail.checked = [];
    if (isNowChecked) detail.checked.push(key);
    else detail.checked = detail.checked.filter(v => v !== key);

    this.collectionService.patchCell(detail.id, x, y, isNowChecked).subscribe({
      next: (updated) => (detail.checked = updated),
      error: (err) => {
        console.error('Erreur mise à jour case', err);
        // revert si erreur
        if (isNowChecked) detail.checked = detail.checked.filter(v => v !== key);
        else detail.checked.push(key);
      },
    });
  }

  // -------- Création / Suppression --------
  loadingTemplateId: number | null = null;

  createFromTemplate(templateId: number): void {
    // Récupère le nom du template pour aider l'utilisateur
    const templateName = this.templateNameById.get(templateId) ?? `Collection ${templateId}`;
    const defaultName = `${templateName} — perso`;

    // Demande à l'utilisateur un nom
    const name = window.prompt(
      `Nom de votre nouvelle collection basée sur "${templateName}" :`,
      defaultName
    );

    if (!name || !name.trim()) return;

    // Indique que ce template est en cours d’ajout
    this.loadingTemplateId = templateId;

    // Ajoute temporairement une collection "en cours de création"
    const temp: UserCollectionListItemDTO = {
      id: -1,
      name: name.trim() + " (en cours)",
      templateId,
    };
    this.myCollections = [temp, ...this.myCollections];

    // 🔄 Requête backend
    this.collectionService.createUserCollection(templateId, name.trim()).subscribe({
      next: () => {
        this.loadingTemplateId = null;
        this.reloadCollections(); // recharge uniquement mes collections
      },
      error: (err) => {
        console.error('Erreur création collection :', err);
        this.loadingTemplateId = null;
        this.myCollections = this.myCollections.filter(c => c.id !== -1);
        alert("Une erreur est survenue lors de la création de la collection.");
      },
    });
  }




  deleteCollection(collectionId: number): void {
    if (!confirm('Voulez-vous vraiment supprimer cette collection ?')) return;
    this.collectionService.deleteUserCollection(collectionId).subscribe({
      next: () => {
        this.myCollections = this.myCollections.filter(c => c.id !== collectionId);
        this.detailCache.delete(collectionId);
        if (this.selectedCollectionId === collectionId) this.closeCollectionDrawer();
      },
      error: (err) => {
        console.error('Erreur suppression collection :', err);
        alert('Erreur lors de la suppression.');
      },
    });
  }

  // === AJOUT MODAL ADMIN ===
  showTemplateModal = false;
  isAdmin = false; // ⚠️ à remplacer par ton AuthService plus tard
  newTemplate = {
    name: '',
    archetype: '',
    axisX: [] as { label: string }[],
    axisY: [] as { label: string }[],
  };

  openTemplateModal(): void {
    this.showTemplateModal = true;
  }

  closeTemplateModal(): void {
    this.showTemplateModal = false;
    this.newTemplate = { name: '', archetype: '', axisX: [], axisY: [] };
  }

  addAxisValue(axis: 'x' | 'y'): void {
    const target = axis === 'x' ? this.newTemplate.axisX : this.newTemplate.axisY;
    target.push({ label: '' });
  }

  removeAxisValue(axis: 'x' | 'y', index: number): void {
    const target = axis === 'x' ? this.newTemplate.axisX : this.newTemplate.axisY;
    target.splice(index, 1);
  }

  createTemplate(): void {
    if (!this.newTemplate.name.trim() || !this.newTemplate.archetype.trim()) {
      alert('Veuillez renseigner un nom et un archétype.');
      return;
    }

    const payload = {
      name: this.newTemplate.name.trim(),
      archetype: this.newTemplate.archetype.trim(),
      axisX: this.newTemplate.axisX.map((x) => x.label),
      axisY: this.newTemplate.axisY.map((y) => y.label),
    };

    this.collectionService.createTemplate(payload).subscribe({
      next: () => {
        this.closeTemplateModal();
        this.loadAllData(); // ⬅ recharge uniquement les templates globaux
      },
      error: (err) => {
        console.error('Erreur création template :', err);
        alert('Erreur lors de la création du template.');
      },
    });
  }

  // -------- Collection stats helpers --------
  getProgressPercent(collectionId: number): number | null {
    const detail = this.detailCache.get(collectionId);
    if (!detail) return null;
    const total = this.getTotalCells(detail);
    if (!total) return 0;
    const checked = detail.checked?.length ?? 0;
    return Math.min(100, Math.round((checked / total) * 100));
  }

  getTotalCells(detail: UserCollectionDetailDTO): number {
    const axes = this.getAxisCounts(detail);
    return axes.xCount * axes.yCount;
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private getAxisCounts(detail: UserCollectionDetailDTO): { xCount: number; yCount: number } {
    const tpl = detail.template as { axisX?: unknown; axisY?: unknown } | undefined;
    const axisX = this.getAxisLabels(tpl?.axisX ?? (detail as { axisX?: unknown }).axisX);
    const axisY = this.getAxisLabels(tpl?.axisY ?? (detail as { axisY?: unknown }).axisY);
    return { xCount: axisX.length, yCount: axisY.length };
  }

  private aggregateStats(): { checked: number; total: number } {
    let checked = 0;
    let total = 0;
    this.myCollections.forEach((c) => {
      const detail = this.detailCache.get(c.id);
      if (!detail) return;
      const cells = this.getTotalCells(detail);
      total += cells;
      checked += detail.checked?.length ?? 0;
    });
    return { checked, total };
  }



}


