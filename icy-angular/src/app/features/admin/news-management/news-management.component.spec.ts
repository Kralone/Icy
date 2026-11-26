import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewsManagementComponent } from './news-management.component';
import {coreTestProviders} from '@testing/test-providers';
import { of } from 'rxjs';
import { NewsService } from '../../../core/services/news/news.service';

describe('NewsManagementComponent', () => {
  let component: NewsManagementComponent;
  let fixture: ComponentFixture<NewsManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsManagementComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewsManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends the edited image with the news update', () => {
    const newsService = TestBed.inject(NewsService);
    localStorage.clear();
    const update = vi.spyOn(newsService, 'updateNews').mockReturnValue(of({} as any));
    vi.spyOn(newsService, 'getNews').mockReturnValue(of({ content: [], totalPages: 0 }));
    const type = { id: 3, name: 'CIG Watch', color: '#00ffff' } as any;
    component.types = [type];
    component.openForm({ id: 7, title: 'T', content: '<p>C</p>', imageUrl: null, author: 'a', createdAt: '', type } as any);
    expect(component.newsForm.imageUrl).toBe('');

    component.newsForm.imageUrl = '  https://media.robertsspaceindustries.com/cover.jpg ';
    expect(component.previewImageUrl).toBe('https://media.robertsspaceindustries.com/cover.jpg');
    component.saveNews();

    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({
      imageUrl: 'https://media.robertsspaceindustries.com/cover.jpg', typeId: 3
    }));
  });
});
