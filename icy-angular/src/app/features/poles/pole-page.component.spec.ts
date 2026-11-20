import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { coreTestProviders } from '@testing/test-providers';
import { PoleHome } from '../../core/services/pole/pole';
import { PolePageComponent } from './pole-page.component';

describe('PolePageComponent', () => {
  let fixture: ComponentFixture<PolePageComponent>;
  let http: HttpTestingController;

  async function open(slug: string): Promise<void> {
    const params = convertToParamMap({ pole: slug });
    await TestBed.configureTestingModule({
      imports: [PolePageComponent],
      providers: [...coreTestProviders, { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } }]
    }).compileComponents();
    fixture = TestBed.createComponent(PolePageComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  const home = (key: string, changes: Partial<PoleHome> = {}): PoleHome => ({ key, specialists: [], canManage: false, stats: [], activity: [], agenda: [], news: [], ...changes });
  const news = { id: 7, title: 'Sortie Quantanium', content: 'Samedi 21h.', authorName: 'Ada', createdAt: '2026-11-18T21:00:00' };
  const find = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string) => find(testId)!.textContent!.replace(/\s+/g, ' ').trim();
  const button = (label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(b => b.textContent!.trim() === label)!;

  async function load(slug: string, body: PoleHome): Promise<void> {
    await open(slug);
    http.expectOne(`/api/poles/${body.key}`).flush(body);
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const field = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('shows the Industrie pole: referent, stats, tools by group, news and recent activity', async () => {
    await load('industrie', home('INDUSTRIE', {
      specialists: [{ id: '1', username: 'Ada' }],
      stats: [{ key: 'MINING_SHEETS_30D', value: 6 }, { key: 'MINING_SALES_30D', value: 1250000 }, { key: 'INCONNU', value: 3 }],
      activity: [{ kind: 'MINING_SHEET', id: 'abc', name: 'Aaron Halo', date: '2026-11-19', status: 'ACTIVE' }],
      news: [news]
    }));

    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Industrie');
    expect(text('pole-referents')).toContain('RéférentAda');
    expect(find('pole-manage')).toBeNull();
    expect(text('pole-stats')).toMatch(/Fiches de minage\s*6\s*30 derniers jours/);
    expect(text('pole-stats')).toMatch(/Ventes de minerai\s*1.250.000\s*aUEC/);
    expect(find('pole-stats')!.querySelectorAll('.pole-stat').length).toBe(2);
    const groups = Array.from(find('pole-tools')!.querySelectorAll('h2')).map(title => title.textContent);
    expect(groups).toEqual(['Outils', 'Guides']);
    const tools = Array.from(fixture.nativeElement.querySelectorAll('a.pole-tool')) as HTMLAnchorElement[];
    expect(tools.map(tool => tool.getAttribute('href'))).toContain('/icy/outils/fiches-minage');
    expect(tools.length).toBe(5);
    expect(text('pole-news')).toMatch(/Sortie Quantanium\s*18 novembre 2026 · Ada\s*Samedi 21h\./);
    expect(find('pole-activity')!.querySelector('a')!.getAttribute('href')).toBe('/icy/outils/fiches-minage/abc');
    expect(text('pole-activity')).toContain('En cours');
  });

  it('lists the upcoming events and operations of the pole, each opening its own page', async () => {
    await load('industrie', home('INDUSTRIE', {
      agenda: [
        { id: 'e1', kind: 'EVENT', title: 'Sortie Quantanium', type: 'Minage', imageUrl: '/images/minage.webp', startDateTime: '2026-11-21T21:00:00', endDateTime: '2026-11-21T23:00:00' },
        { id: 'o1', kind: 'OPERATION', title: 'Opération Halo', type: null, imageUrl: null, startDateTime: '2026-11-28T21:00:00', endDateTime: '2026-11-28T23:00:00' }
      ]
    }));
    const links = Array.from(find('pole-agenda')!.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/icy/events?eventId=e1', '/icy/operations/o1']);
    expect(links[0].textContent!.replace(/\s+/g, ' ')).toMatch(/Événement · Minage\s*Sortie Quantanium\s*samedi 21 novembre à 21:00/);
    expect(links[0].querySelector('img')!.getAttribute('src')).toBe('https://iceforge.fr/images/minage.webp');
    expect(links[1].textContent).toContain('Opération');
    expect(links[1].querySelector('img')!.getAttribute('src')).toBe('assets/images/poles/industrie.jpg');
  });

  it('says so when a pole has no referent, no tool and no news, and hides empty sections', async () => {
    await load('militaire', home('MILITAIRE'));
    expect(text('pole-referents')).toBe("Aucun référent pour l'instant");
    expect(text('pole-tools')).toContain("Ce pôle n'a pas encore d'outil dédié.");
    expect(text('pole-news')).toContain('Aucune actualité publiée pour ce pôle.');
    expect(find('pole-stats')).toBeNull();
    expect(find('pole-activity')).toBeNull();
    expect(find('pole-agenda')).toBeNull();
  });

  it('lets a manager publish, edit and delete news', async () => {
    await load('industrie', home('INDUSTRIE', { canManage: true }));
    expect(find('pole-news-form')).toBeNull();
    find('pole-manage')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    button('Publier').click();
    fixture.detectChanges();
    expect(text('pole-news-form')).toContain('Le titre et le texte sont obligatoires.');

    type('input[name="title"]', ' Sortie Quantanium ');
    type('textarea[name="content"]', 'Samedi 21h.');
    button('Publier').click();
    const post = http.expectOne({ method: 'POST', url: '/api/poles/INDUSTRIE/news' });
    expect(post.request.body).toEqual({ title: 'Sortie Quantanium', content: 'Samedi 21h.' });
    post.flush(news);
    fixture.detectChanges();
    expect(text('pole-news')).toContain('Sortie Quantanium');

    button('Modifier').click();
    fixture.detectChanges();
    await fixture.whenStable();
    type('input[name="title"]', 'Sortie reportée');
    button('Enregistrer').click();
    const put = http.expectOne({ method: 'PUT', url: '/api/poles/INDUSTRIE/news/7' });
    expect(put.request.body).toEqual({ title: 'Sortie reportée', content: 'Samedi 21h.' });
    put.flush({ ...news, title: 'Sortie reportée', updatedAt: '2026-11-19T10:00:00' });
    fixture.detectChanges();
    expect(text('pole-news')).toContain('Sortie reportée');
    expect(text('pole-news')).toContain('modifiée');

    button('Supprimer').click();
    fixture.detectChanges();
    http.expectNone({ method: 'DELETE', url: '/api/poles/INDUSTRIE/news/7' });
    button('Confirmer la suppression').click();
    http.expectOne({ method: 'DELETE', url: '/api/poles/INDUSTRIE/news/7' }).flush(null);
    fixture.detectChanges();
    expect(text('pole-news')).toContain('Aucune actualité publiée pour ce pôle.');
  });

  it('shows the server message when publishing is refused', async () => {
    await load('industrie', home('INDUSTRIE', { canManage: true }));
    find('pole-manage')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    type('input[name="title"]', 'Titre');
    type('textarea[name="content"]', 'Texte');
    button('Publier').click();
    http.expectOne({ method: 'POST', url: '/api/poles/INDUSTRIE/news' }).flush({ message: 'Refusé.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text('pole-news-form')).toContain('Refusé.');
  });

  it('offers to retry when the pole cannot be loaded, and keeps the tools', async () => {
    await open('industrie');
    http.expectOne('/api/poles/INDUSTRIE').flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a.pole-tool').length).toBe(5);
    find('pole-error')!.querySelector('button')!.click();
    http.expectOne('/api/poles/INDUSTRIE').flush(home('INDUSTRIE', { specialists: [{ id: '1', username: 'Ada' }] }));
    fixture.detectChanges();
    expect(find('pole-error')).toBeNull();
    expect(text('pole-referents')).toContain('Ada');
  });

  it('replaces a tool image that does not load with the pole image, once', async () => {
    await load('industrie', home('INDUSTRIE'));
    const image = fixture.nativeElement.querySelector('a.pole-tool img') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    expect(image.getAttribute('src')).toBe('assets/images/poles/industrie.jpg');
    image.setAttribute('src', 'autre.jpg');
    image.dispatchEvent(new Event('error'));
    expect(image.getAttribute('src')).toBe('autre.jpg');
  });

  it('sends an unknown pole back to the poles menu', async () => {
    const params = convertToParamMap({ pole: 'inconnu' });
    await TestBed.configureTestingModule({
      imports: [PolePageComponent],
      providers: [...coreTestProviders, { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } }]
    }).compileComponents();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(PolePageComponent);
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/icy/poles'], { replaceUrl: true });
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
