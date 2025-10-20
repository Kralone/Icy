import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {News} from '../../../model/news.model';
import {NewsType} from '../../../model/news-type.model';

@Injectable({ providedIn: 'root' })
export class NewsService {
  private baseUrl = '/api/news';

  constructor(private http: HttpClient) {}

  // === NEWS ===
  getNews(page: number = 0, size: number = 10): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}?page=${page}&size=${size}`);
  }

  createNews(news: Partial<News>): Observable<News> {
    return this.http.post<News>(this.baseUrl, news);
  }

  updateNews(id: number, news: Partial<News>): Observable<News> {
    return this.http.put<News>(`${this.baseUrl}/${id}`, news);
  }

  deleteNews(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // === TYPES ===
  getTypes(): Observable<NewsType[]> {
    return this.http.get<NewsType[]>(`${this.baseUrl}/types`);
  }

  createType(type: Partial<NewsType>): Observable<NewsType> {
    return this.http.post<NewsType>(`${this.baseUrl}/types`, type);
  }

  updateType(id: number, type: Partial<NewsType>): Observable<NewsType> {
    return this.http.put<NewsType>(`${this.baseUrl}/types/${id}`, type);
  }

  deleteType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/types/${id}`);
  }
}
