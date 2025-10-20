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
}
