import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewsManagementComponent } from './news-management.component';
import {coreTestProviders} from '@testing/test-providers';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
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

  it('blocks saving and flags the missing fields instead of calling the API', () => {
    const newsService = TestBed.inject(NewsService);
    localStorage.clear();
    const create = vi.spyOn(newsService, 'createNews');
    component.openForm();
    component.newsForm.imageUrl = 'http://insecure.example/cover.jpg';
    component.saveNews();

    expect(create).not.toHaveBeenCalled();
    expect(component.titleError).toBeTruthy();
    expect(component.typeMissing).toBeTruthy();
    expect(component.contentError).toBeTruthy();
    expect(component.imageUrlError).toBeTruthy();
    expect(component.formError).toContain('Complétez');
  });

  it('shows the server message in the form when saving fails', () => {
    const newsService = TestBed.inject(NewsService);
    localStorage.clear();
    vi.spyOn(newsService, 'createNews').mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 400, error: { message: 'Image refusée.' } })));
    component.openForm();
    component.newsForm = { title: 'T', type: { id: 1, name: 'Annonce', color: '#38bdf8' }, content: '<p>C</p>', imageUrl: '' };
    component.saveNews();

    expect(component.formError).toBe('Image refusée.');
    expect(component.showForm).toBe(true);
    expect(component.isSaving).toBe(false);
  });

  it('asks for confirmation before deleting a news', () => {
    const newsService = TestBed.inject(NewsService);
    const remove = vi.spyOn(newsService, 'deleteNews').mockReturnValue(of(undefined));
    vi.spyOn(newsService, 'getNews').mockReturnValue(of({ content: [], totalPages: 0 }));
    const news = { id: 4, title: 'T', content: '', author: 'a', createdAt: '' } as any;

    component.askDeleteNews(news);
    expect(component.confirmDeleteId).toBe(4);
    expect(remove).not.toHaveBeenCalled();
    component.deleteNews(4);
    expect(remove).toHaveBeenCalledWith(4);
    expect(component.confirmDeleteId).toBeNull();
  });

  it('discards the local draft and restores the saved news', () => {
    localStorage.clear();
    const type = { id: 3, name: 'CIG Watch', color: '#00ffff' } as any;
    component.types = [type];
    const news = { id: 9, title: 'Saved', content: '<p>C</p>', imageUrl: null, author: 'a', createdAt: '', type } as any;
    localStorage.setItem('admin-news-draft-edit-9', JSON.stringify({ title: 'Draft', content: '<p>D</p>', savedAt: new Date().toISOString() }));

    component.openForm(news);
    expect(component.newsForm.title).toBe('Draft');
    component.discardDraft();

    expect(component.newsForm.title).toBe('Saved');
    expect(component.draftSavedAt).toBeNull();
    expect(localStorage.getItem('admin-news-draft-edit-9')).toBeNull();
    component.closeForm(false);
  });

  it('validates the type form before creating it', () => {
    const newsService = TestBed.inject(NewsService);
    const create = vi.spyOn(newsService, 'createType').mockReturnValue(of({} as any));
    vi.spyOn(newsService, 'getTypes').mockReturnValue(of([]));
    component.types = [{ id: 1, name: 'Annonce', color: '#38bdf8' }];

    component.typeForm = { name: 'annonce', color: '#38bdf8', imageUrl: '' };
    component.saveType();
    expect(component.typeNameError).toBe('Un type porte déjà ce nom.');
    expect(create).not.toHaveBeenCalled();

    component.typeForm = { name: ' Patch ', color: '#FACC15', imageUrl: '' };
    component.saveType();
    expect(create).toHaveBeenCalledWith({ name: 'Patch', color: '#facc15', imageUrl: undefined });
  });
});
