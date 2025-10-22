import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { NewsService } from '../../../core/services/news/news.service';
import { News } from '../../../model/news.model';
import { NewsType } from '../../../model/news-type.model';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-news-management',
  standalone: true,
  templateUrl: './news-management.component.html',
  imports: [CommonModule, FormsModule, AngularEditorModule, RouterLink],
})
export class NewsManagementComponent implements OnInit {
  // === ACTUALITÉS ===
  news: News[] = [];
  isLoading = false;
  showForm = false;
  editingNews: News | null = null;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;

  // === TYPES DE NEWS ===
  types: NewsType[] = [];
  newType: Partial<NewsType> = {};
  editingType: NewsType | null = null;

  isTypeSubmitting = false;
  isTypeUpdating = false;

  // === FORMULAIRE NEWS ===
  newsForm = {
    title: '',
    type: null as NewsType | null,
    content: ''
  };

  // === CONFIGURATION DE L’ÉDITEUR RICHE ===
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '15rem',
    minHeight: '5rem',
    placeholder: 'Écris ton actualité ici... ✍️',
    translate: 'no',
    defaultFontName: 'Arial',
    toolbarHiddenButtons: [['insertVideo', 'insertHorizontalRule']],
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

  // -------------------------------
  // ACTUALITÉS
  // -------------------------------
  loadNews(): void {
    this.isLoading = true;
    this.newsService.getNews(this.currentPage, this.pageSize).subscribe({
      next: (data) => {
        this.news = data.content;
        this.totalPages = data.totalPages;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
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
        content: news.content
      };
    } else {
      this.editingNews = null;
      this.newsForm = { title: '', type: null, content: '' };
    }
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingNews = null;
    this.newsForm = { title: '', type: null, content: '' };
  }

  saveNews(): void {
    const payload = {
      title: this.newsForm.title,
      typeId: this.newsForm.type?.id,
      content: this.newsForm.content,
    };

    if (!payload.title || !payload.typeId || !payload.content) {
      alert('Veuillez remplir tous les champs avant de sauvegarder.');
      return;
    }

    if (this.editingNews) {
      // Mise à jour
      this.newsService.updateNews(this.editingNews.id, payload).subscribe({
        next: () => {
          this.loadNews();
          this.closeForm();
        },
        error: (err) => console.error('Erreur mise à jour news', err),
      });
    } else {
      // Création
      this.newsService.createNews(payload).subscribe({
        next: () => {
          this.loadNews();
          this.closeForm();
        },
        error: (err) => console.error('Erreur création news', err),
      });
    }
  }

  deleteNews(id: number): void {
    if (confirm('Supprimer cette actualité ?')) {
      this.newsService.deleteNews(id).subscribe(() => this.loadNews());
    }
  }

  // -------------------------------
  // TYPES DE NEWS
  // -------------------------------
  loadTypes(): void {
    this.newsService.getTypes().subscribe({
      next: (types) => (this.types = types),
    });
  }

  createType(): void {
    if (!this.newType.name || !this.newType.color) {
      alert('Veuillez renseigner le nom et la couleur du type.');
      return;
    }

    this.isTypeSubmitting = true;
    this.newsService.createType(this.newType).subscribe({
      next: () => {
        this.newType = {};
        this.isTypeSubmitting = false;
        this.loadTypes();
      },
      error: () => (this.isTypeSubmitting = false),
    });
  }

  editType(type: NewsType): void {
    // Copie défensive pour ne pas modifier directement dans la table
    this.editingType = { ...type };
  }

  cancelEdit(): void {
    this.editingType = null;
  }

  updateType(): void {
    if (!this.editingType) return;
    this.isTypeUpdating = true;

    this.newsService.updateType(this.editingType.id, this.editingType).subscribe({
      next: () => {
        this.isTypeUpdating = false;
        this.editingType = null;
        this.loadTypes();
      },
      error: () => (this.isTypeUpdating = false),
    });
  }

  deleteType(id: number): void {
    if (confirm('Supprimer ce type d’actualité ?')) {
      this.newsService.deleteType(id).subscribe(() => this.loadTypes());
    }
  }

  get selectedType(): NewsType | null {
    return this.newsForm.type;
  }




}
