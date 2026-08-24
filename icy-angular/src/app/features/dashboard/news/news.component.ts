import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsService } from '../../../core/services/news/news.service';
import { News } from '../../../model/news.model';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, MarkdownPipe, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './news.component.html',
})
export class NewsComponent implements OnInit {
  newsList: News[] = [];
  selectedNews: News | null = null;
  isLoading = true;

  constructor(private newsService: NewsService) {}

  ngOnInit(): void {
    this.loadNews();
  }

  loadNews(): void {
    this.isLoading = true;
    this.newsService.getNews(0, 10).subscribe({
      next: (data) => {
        this.newsList = data.content;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur chargement news', err);
        this.isLoading = false;
      },
    });
  }

  openModal(news: News): void {
    this.selectedNews = news;
  }

  closeModal(): void {
    this.selectedNews = null;
  }

  currentPage = 1;
  itemsPerPage = 4; // nombre d’articles par page

  get paginatedNews() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.newsList.slice(start, start + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.newsList.length / this.itemsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

}
