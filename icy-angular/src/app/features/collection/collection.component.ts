import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CollectionsService } from '../../core/services/collection/collection.service';
import {
  TemplateDetailDTO,
  TemplateListItemDTO,
  UserCollectionDetailDTO,
  UserCollectionListItemDTO
} from '../../model/collection.model';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [CommonModule, LoadingOverlayComponent, FormsModule],
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

  // SECTION 2 : mes collections
  isLoadingUser = true;
  errorUser: unknown = null;
  myCollections: UserCollectionListItemDTO[] = [];
// Accordéon
  expandedId: number | null = null;
  rowLoading = new Set<number>();                // ✅ un Set, pas un Map
  rowError = new Map<number, unknown>();         // ✅ Map ok pour stocker erreurs
  detailCache = new Map<number, UserCollectionDetailDTO>();

  userReloading = false; // nouveau: pour l'overlay sans vider la table


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
        this.myCollections = collections ?? [];

        // Map rapide pour retrouver les noms de template
        this.templateNameById.clear();
        this.templates.forEach(t => this.templateNameById.set(t.id, t.name));

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
    this.userReloading = true;

    this.collectionService.listUserCollections().subscribe({
      next: (collections: UserCollectionListItemDTO[]) => {
        // Mise à jour douce sans perdre les détails connus
        const existingIds = new Set(collections.map(c => c.id));
        [...this.detailCache.keys()].forEach(id => {
          if (!existingIds.has(id)) this.detailCache.delete(id);
        });

        this.myCollections = collections;
        this.userReloading = false;
      },
      error: (err: unknown) => {
        console.error('Erreur de rechargement des collections', err);
        this.userReloading = false;
      }
    });
  }



  // Trackers pour ngFor
  trackByIdTemplate = (_: number, item: TemplateListItemDTO) => item.id;
  trackByIdCollection = (_: number, item: UserCollectionListItemDTO) => item.id;

  // Accordéon
  toggleCollectionRow(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;

    // Si on ouvre une ligne et qu’on n’a pas encore ses détails → on les charge
    if (this.expandedId && !this.detailCache.has(id)) {
      this.fetchCollectionDetail(id);
    }
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

  getTemplateById(id: number) {
    return this.templates.find(t => t.id === id);
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
        if (this.expandedId === collectionId) this.expandedId = null;
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



}


