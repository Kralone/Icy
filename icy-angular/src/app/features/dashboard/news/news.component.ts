import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsService } from '../../../core/services/news/news.service';
import { News } from '../../../model/news.model';

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news.component.html',
})
export class NewsComponent implements OnInit {
  newsList: News[] = [];
  selectedNews: News | null = null;

  constructor(private newsService: NewsService) {}

  ngOnInit(): void {
    this.loadNews();
  }

  loadNews(): void {
    this.newsService.getNews(0, 10).subscribe({
      next: (data) => (this.newsList = data.content),
      error: (err) => console.error('Erreur chargement news', err),
    });
  }

  openModal(news: News): void {
    this.selectedNews = news;
  }

  closeModal(): void {
    this.selectedNews = null;
  }

  currentPage = 1;
  itemsPerPage = 3; // nombre d’articles par page

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
