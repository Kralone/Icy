import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { HotToastService } from '@ngxpert/hot-toast';
import { NewsService } from '../../../core/services/news/news.service';
import { News } from '../../../model/news.model';
import { NewsType } from '../../../model/news-type.model';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { ColorFieldComponent } from '../../../shared/color-field/color-field.component';
import { normalizeHex } from '../../../shared/color-field/color-math';

/** Couleurs proposées pour les badges de type, posés en texte sombre sur le site. */
export const NEWS_TYPE_PRESETS = [
  '#38bdf8', '#22d3ee', '#2dd4bf', '#4ade80', '#a3e635', '#facc15', '#fbbf24', '#fb923c',
  '#f87171', '#fb7185', '#e879f9', '#c084fc', '#818cf8', '#60a5fa', '#cbd5e1', '#ffffff',
] as const;

const DEFAULT_TYPE_COLOR = '#38bdf8';

interface TypeForm { name: string; color: string; imageUrl: string; }

@Component({
  selector: 'app-news-management',
  standalone: true,
  templateUrl: './news-management.component.html',
  styleUrl: './news-management.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, FormsModule, AngularEditorModule, RouterLink, MarkdownPipe, ColorFieldComponent],
})
export class NewsManagementComponent implements OnInit, OnDestroy {
  private readonly toast = inject(HotToastService, { optional: true });
  private readonly draftStoragePrefix = 'admin-news-draft';
  private autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastAutoSavedPayload = '';
  private pendingDraftTypeId: number | null = null;
  /** Images qui n'ont pas pu être chargées : la vignette retombe sur l'image du type, puis sur la couleur. */
  private readonly failedImages = new Set<string>();

  readonly typePresets = NEWS_TYPE_PRESETS;

  // === ACTUALITÉS ===
  news: News[] = [];
  isLoading = false;
  loadError = '';
  showForm = false;
  editingNews: News | null = null;
  /** Actualité dont la suppression attend confirmation. */
  confirmDeleteId: number | null = null;
  pendingNewsId: number | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // === TYPES DE NEWS ===
  types: NewsType[] = [];
  typesLoading = false;
  /** Type en cours d'édition ; null : création. */
  editingType: NewsType | null = null;
  typeForm: TypeForm = emptyTypeForm();
  typeSubmitted = false;
  typeError = '';
  isTypeSaving = false;
  confirmDeleteTypeId: number | null = null;
  pendingTypeId: number | null = null;

  // === FORMULAIRE NEWS ===
  newsForm = {
    title: '',
    type: null as NewsType | null,
    content: '',
    imageUrl: ''
  };
  submitted = false;
  isSaving = false;
  formError = '';
  draftSavedAt: Date | null = null;

  // === CONFIGURATION DE L’ÉDITEUR RICHE ===
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '18rem',
    minHeight: '10rem',
    placeholder: 'Contenu de l’actualité',
    translate: 'no',
    defaultFontName: 'Arial',
    toolbarHiddenButtons: [['insertVideo', 'insertHorizontalRule', 'fontName', 'customClasses']],
    toolbarPosition: 'top',
    sanitize: true,
  };

  constructor(private newsService: NewsService) {}

  // -------------------------------
  // INITIALISATION
  // -------------------------------
  ngOnInit(): void {
    this.loadNews();
    this.loadTypes();
  }

  ngOnDestroy(): void {
    this.stopAutoSave();
  }

  // -------------------------------
  // ACTUALITÉS
  // -------------------------------
  loadNews(): void {
    this.isLoading = true;
    this.loadError = '';
    this.newsService.getNews(this.currentPage, this.pageSize).subscribe({
      next: (data) => {
        this.news = data?.content ?? [];
        this.totalPages = data?.totalPages ?? 0;
        this.totalElements = data?.totalElements ?? this.news.length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Les actualités n’ont pas pu être chargées.';
      },
    });
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadNews();
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadNews();
    }
  }

  openForm(news?: News): void {
    if (news) {
      this.editingNews = news;
      this.newsForm = {
        title: news.title,
        type: this.types.find(t => t.id === news.type?.id) || null,
        content: news.content,
        imageUrl: news.imageUrl ?? ''
      };
    } else {
      this.editingNews = null;
      this.newsForm = { title: '', type: null, content: '', imageUrl: '' };
    }

    this.submitted = false;
    this.formError = '';
    this.confirmDeleteId = null;
    this.restoreDraft();
    this.showForm = true;
    this.startAutoSave();
    scrollToTop();
  }

  closeForm(preserveDraft = true): void {
    if (preserveDraft) {
      this.persistDraft();
    }
    this.stopAutoSave();
    this.showForm = false;
    this.editingNews = null;
    this.newsForm = { title: '', type: null, content: '', imageUrl: '' };
    this.submitted = false;
    this.formError = '';
    this.draftSavedAt = null;
    this.pendingDraftTypeId = null;
    this.lastAutoSavedPayload = '';
  }

  /** Abandonne le brouillon local et revient à la version enregistrée (ou à un formulaire vide). */
  discardDraft(): void {
    const news = this.editingNews ?? undefined;
    this.clearDraft();
    this.openForm(news);
  }

  get titleError(): string {
    return this.newsForm.title.trim() ? '' : 'Donnez un titre à l’actualité.';
  }

  get typeMissing(): string {
    return this.newsForm.type ? '' : 'Choisissez un type.';
  }

  get contentError(): string {
    return stripHtml(this.newsForm.content) ? '' : 'Rédigez le contenu.';
  }

  get imageUrlError(): string {
    const url = this.newsForm.imageUrl.trim();
    if (!url) return '';
    return /^https:\/\/\S+$/i.test(url) ? '' : 'Adresse https:// complète attendue.';
  }

  saveNews(): void {
    this.submitted = true;
    this.formError = '';
    const payload = {
      title: this.newsForm.title.trim(),
      typeId: this.newsForm.type?.id,
      content: this.newsForm.content,
      // An empty value removes the image; the backend accepts only https addresses.
      imageUrl: this.newsForm.imageUrl.trim(),
    };

    if (this.titleError || this.typeMissing || this.contentError || this.imageUrlError) {
      this.formError = 'Complétez les champs signalés avant d’enregistrer.';
      return;
    }

    const editing = this.editingNews;
    const request = editing
      ? this.newsService.updateNews(editing.id, payload)
      : this.newsService.createNews(payload);

    this.isSaving = true;
    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.clearDraft();
        if (!editing) this.currentPage = 0;
        this.loadNews();
        this.closeForm(false);
        this.toast?.success(editing ? 'Actualité enregistrée.' : 'Actualité publiée.');
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving = false;
        console.error(editing ? 'Erreur mise à jour news' : 'Erreur création news', err);
        this.formError = serverMessage(err, editing
          ? 'La mise à jour de l’actualité a échoué.'
          : 'La création de l’actualité a échoué.');
      },
    });
  }

  askDeleteNews(news: News): void {
    this.confirmDeleteId = news.id;
  }

  cancelDeleteNews(): void {
    this.confirmDeleteId = null;
  }

  deleteNews(id: number): void {
    this.pendingNewsId = id;
    this.newsService.deleteNews(id).subscribe({
      next: () => {
        this.pendingNewsId = null;
        this.confirmDeleteId = null;
        if (this.news.length === 1 && this.currentPage > 0) this.currentPage--;
        this.loadNews();
        this.toast?.success('Actualité supprimée.');
      },
      error: (err: HttpErrorResponse) => {
        this.pendingNewsId = null;
        this.toast?.error(serverMessage(err, 'Suppression impossible.'));
      },
    });
  }

  /** Image affichée pour une actualité : la sienne, sinon celle de son type, comme au tableau de bord. */
  newsImage(news: Pick<News, 'imageUrl' | 'type'>): string | null {
    return [news.imageUrl, news.type?.imageUrl]
      .map(url => url?.trim())
      .find((url): url is string => !!url && !this.failedImages.has(url)) ?? null;
  }

  imageFailed(url: string | null): void {
    if (url) this.failedImages.add(url);
  }

  excerpt(news: News): string {
    const text = stripHtml(news.content);
    return text.length > 160 ? text.slice(0, 157).trimEnd() + '…' : text;
  }

  isEdited(news: News): boolean {
    return this.editingNews?.id === news.id;
  }

  // -------------------------------
  // TYPES DE NEWS
  // -------------------------------
  loadTypes(): void {
    this.typesLoading = true;
    this.newsService.getTypes().subscribe({
      next: (types) => {
        this.types = [...(types ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        this.typesLoading = false;
        // Garde la sélection du formulaire alignée sur les objets rechargés.
        if (this.newsForm.type) {
          this.newsForm.type = this.types.find(t => t.id === this.newsForm.type!.id) ?? null;
        }
        this.resolvePendingDraftType();
      },
      error: () => (this.typesLoading = false),
    });
  }

  selectType(type: NewsType): void {
    this.newsForm.type = type;
  }

  startCreateType(): void {
    this.editingType = null;
    this.typeForm = emptyTypeForm();
    this.typeSubmitted = false;
    this.typeError = '';
  }

  editType(type: NewsType): void {
    this.editingType = type;
    this.typeForm = { name: type.name, color: normalizeHex(type.color) ?? type.color ?? DEFAULT_TYPE_COLOR, imageUrl: type.imageUrl ?? '' };
    this.typeSubmitted = false;
    this.typeError = '';
    this.confirmDeleteTypeId = null;
  }

  cancelEdit(): void {
    this.startCreateType();
  }

  get typeNameError(): string {
    const name = this.typeForm.name.trim();
    if (!name) return 'Donnez un nom au type.';
    if (name.length > 100) return '100 caractères au plus.';
    const duplicate = this.types.some(t => t.id !== this.editingType?.id && t.name.toLowerCase() === name.toLowerCase());
    return duplicate ? 'Un type porte déjà ce nom.' : '';
  }

  get typeColorError(): string {
    return normalizeHex(this.typeForm.color) ? '' : 'Choisissez une couleur.';
  }

  get typePreviewColor(): string {
    return normalizeHex(this.typeForm.color) ?? DEFAULT_TYPE_COLOR;
  }

  saveType(): void {
    this.typeSubmitted = true;
    this.typeError = '';
    if (this.typeNameError || this.typeColorError) return;

    const body: Partial<NewsType> = {
      name: this.typeForm.name.trim(),
      color: normalizeHex(this.typeForm.color)!,
      imageUrl: this.typeForm.imageUrl.trim() || undefined,
    };
    const editing = this.editingType;
    const request = editing
      ? this.newsService.updateType(editing.id, { ...editing, ...body })
      : this.newsService.createType(body);

    this.isTypeSaving = true;
    request.subscribe({
      next: () => {
        this.isTypeSaving = false;
        this.toast?.success(editing ? `Type « ${body.name} » enregistré.` : `Type « ${body.name} » créé.`);
        this.startCreateType();
        this.loadTypes();
        if (editing) this.loadNews();
      },
      error: (err: HttpErrorResponse) => {
        this.isTypeSaving = false;
        this.typeError = serverMessage(err, 'Enregistrement du type impossible.');
      },
    });
  }

  askDeleteType(type: NewsType): void {
    this.confirmDeleteTypeId = type.id;
  }

  cancelDeleteType(): void {
    this.confirmDeleteTypeId = null;
  }

  deleteType(type: NewsType): void {
    this.pendingTypeId = type.id;
    this.newsService.deleteType(type.id).subscribe({
      next: () => {
        this.pendingTypeId = null;
        this.confirmDeleteTypeId = null;
        if (this.editingType?.id === type.id) this.startCreateType();
        this.toast?.success(`Type « ${type.name} » supprimé.`);
        this.loadTypes();
      },
      error: (err: HttpErrorResponse) => {
        this.pendingTypeId = null;
        this.confirmDeleteTypeId = null;
        // La base refuse de supprimer un type encore porté par une actualité.
        this.toast?.error(err?.status === 409
          ? `« ${type.name} » est encore utilisé par des actualités : changez-leur de type avant de le supprimer.`
          : serverMessage(err, 'Suppression impossible.'));
      },
    });
  }

  get selectedType(): NewsType | null {
    return this.newsForm.type;
  }

  /** The news image wins over the type image, as on the dashboard and in Discord. */
  get previewImageUrl(): string | null {
    return this.newsForm.imageUrl.trim() || this.newsForm.type?.imageUrl || null;
  }

  get previewDate(): string {
    return this.editingNews?.createdAt ?? new Date().toISOString();
  }

  private startAutoSave(): void {
    this.stopAutoSave();
    this.autoSaveIntervalId = setInterval(() => this.persistDraft(), 5000);
  }

  private stopAutoSave(): void {
    if (!this.autoSaveIntervalId) {
      return;
    }
    clearInterval(this.autoSaveIntervalId);
    this.autoSaveIntervalId = null;
  }

  private getDraftStorageKey(): string {
    if (this.editingNews) {
      return `${this.draftStoragePrefix}-edit-${this.editingNews.id}`;
    }
    return `${this.draftStoragePrefix}-new`;
  }

  private buildDraftPayload(): {
    title: string;
    typeId: number | null | undefined;
    content: string;
    imageUrl: string;
    savedAt: string;
  } {
    return {
      title: this.newsForm.title,
      typeId: this.newsForm.type?.id,
      content: this.newsForm.content,
      imageUrl: this.newsForm.imageUrl,
      savedAt: new Date().toISOString(),
    };
  }

  private persistDraft(): void {
    if (!this.showForm) {
      return;
    }

    const hasContent = !!(this.newsForm.title?.trim() || this.newsForm.content?.trim() || this.newsForm.type);
    if (!hasContent) {
      return;
    }

    const payload = this.buildDraftPayload();
    const serializedPayload = JSON.stringify(payload);

    if (serializedPayload === this.lastAutoSavedPayload) {
      return;
    }

    try {
      localStorage.setItem(this.getDraftStorageKey(), serializedPayload);
      this.lastAutoSavedPayload = serializedPayload;
      this.draftSavedAt = new Date(payload.savedAt);
    } catch {
      // Ignore localStorage write failures (private mode/quota/etc.)
    }
  }

  private restoreDraft(): void {
    this.pendingDraftTypeId = null;
    this.lastAutoSavedPayload = '';
    this.draftSavedAt = null;
    const key = this.getDraftStorageKey();

    try {
      const rawDraft = localStorage.getItem(key);
      if (!rawDraft) {
        return;
      }

      const parsed = JSON.parse(rawDraft) as {
        title?: string;
        typeId?: number;
        content?: string;
        imageUrl?: string;
        savedAt?: string;
      };

      this.newsForm.title = parsed.title ?? this.newsForm.title;
      this.newsForm.content = parsed.content ?? this.newsForm.content;
      this.newsForm.imageUrl = parsed.imageUrl ?? this.newsForm.imageUrl;

      if (typeof parsed.typeId === 'number') {
        this.pendingDraftTypeId = parsed.typeId;
        this.resolvePendingDraftType();
      }

      this.draftSavedAt = parsed.savedAt ? new Date(parsed.savedAt) : null;
      this.lastAutoSavedPayload = rawDraft;
    } catch {
      // Ignore malformed draft content and keep current form values.
    }
  }

  private resolvePendingDraftType(): void {
    if (this.pendingDraftTypeId === null) {
      return;
    }

    const matchedType = this.types.find((type) => type.id === this.pendingDraftTypeId) ?? null;
    if (matchedType) {
      this.newsForm.type = matchedType;
      this.pendingDraftTypeId = null;
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.getDraftStorageKey());
    } catch {
      // Ignore localStorage failures.
    }
    this.lastAutoSavedPayload = '';
  }
}

function emptyTypeForm(): TypeForm {
  return { name: '', color: DEFAULT_TYPE_COLOR, imageUrl: '' };
}

function stripHtml(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function serverMessage(error: HttpErrorResponse | null | undefined, fallback: string): string {
  const message = error?.error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function scrollToTop(): void {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
