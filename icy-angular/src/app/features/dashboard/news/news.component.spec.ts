import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewsComponent } from './news.component';
import {coreTestProviders} from '@testing/test-providers';

describe('NewsComponent', () => {
  let component: NewsComponent;
  let fixture: ComponentFixture<NewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('prefers the article image and falls back without broken empty images', () => {
    const news = {id: 1, title: 'CIG', content: '', author: 'ICY', createdAt: '',
      imageUrl: 'https://media.robertsspaceindustries.com/article.jpg',
      type: {id: 1, name: 'CIG', color: '#fff', imageUrl: '/images/type.png'}};
    expect(component.newsImage(news)).toBe(news.imageUrl);
    component.imageFailed(news);
    expect(component.newsImage(news)).toBe('/images/type.png');
    component.imageFailed(news);
    expect(component.newsImage(news)).toBeNull();
    expect(component.newsImage({...news, imageUrl: null, type: null})).toBeNull();
  });
});
