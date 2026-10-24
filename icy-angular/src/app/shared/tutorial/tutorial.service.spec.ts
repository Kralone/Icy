import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TutorialService } from './tutorial.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { TUTORIALS } from './tutorial-definitions';

const hangar = TUTORIALS.find(tutorial => tutorial.id === 'hangar')!;

describe('TutorialService', () => {
  let events: Subject<unknown>;
  let router: { url: string; events: Subject<unknown> };
  let http: HttpTestingController;
  let page: HTMLElement;
  let userId: string;

  const setup = (url: string) => {
    router.url = url;
    const service = TestBed.inject(TutorialService);
    http = TestBed.inject(HttpTestingController);
    service.start();
    return service;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    events = new Subject();
    router = { url: '/icy/dashboard', events };
    userId = 'u1';
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router }, { provide: AuthService, useValue: { getUserIdFromToken: () => userId } }] });
    page = document.createElement('div');
    page.innerHTML = '<div data-tuto="hangar-filters"></div><button data-tuto="hangar-add"></button>';
    document.body.appendChild(page);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return (this as HTMLElement).dataset['tuto'] ? { top: 10, left: 10, width: 100, height: 40, right: 110, bottom: 50, x: 10, y: 10, toJSON: () => ({}) } as DOMRect : new DOMRect();
    });
  });

  afterEach(() => {
    page.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts the page tutorial on the first visit, once the page has loaded, without the missing steps', () => {
    page.setAttribute('data-loading', 'true');
    const service = setup('/icy/hangar');
    expect(service.pageTutorial()?.id).toBe('hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });

    vi.advanceTimersByTime(1000);
    expect(service.active()).toBeNull();

    page.setAttribute('data-loading', 'false');
    vi.advanceTimersByTime(600);
    expect(service.active()?.tutorial.id).toBe('hangar');
    // L’étape « Fiche du vaisseau » n’a pas de carte à montrer.
    expect(service.active()?.steps.map(step => step.title)).toEqual(['Mon hangar', 'Ajouter un vaisseau', 'Rechercher']);
  });

  it('records completion with the tutorial version after the last step', () => {
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });
    vi.advanceTimersByTime(600);

    service.next();
    service.previous();
    expect(service.active()?.index).toBe(0);
    service.next();
    service.next();
    service.next();

    expect(service.active()).toBeNull();
    const save = http.expectOne('/api/users/me/tutorials/hangar');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ version: hangar.version, status: 'COMPLETED' });
    expect(JSON.parse(localStorage.getItem('icy.tutorials.u1')!)).toEqual({ hangar: hangar.version });
  });

  it('shows a step whose section appears after the tutorial has started', () => {
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });
    vi.advanceTimersByTime(600);
    expect(service.active()?.steps.length).toBe(3);

    const card = document.createElement('div');
    card.setAttribute('data-tuto', 'hangar-ship');
    page.appendChild(card);
    service.next();
    service.next();
    service.next();

    expect(service.step()?.title).toBe('Fiche du vaisseau');
    expect(service.active()?.index).toBe(3);
    expect(service.active()?.steps.length).toBe(4);
    service.previous();
    expect(service.step()?.title).toBe('Rechercher');
  });

  it('records a skipped tutorial as dismissed', () => {
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });
    vi.advanceTimersByTime(600);

    service.skip();

    expect(http.expectOne('/api/users/me/tutorials/hangar').request.body).toEqual({ version: hangar.version, status: 'DISMISSED' });
  });

  it('does not start a tutorial already seen in this version, but can replay it', () => {
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [{ tutorialId: 'hangar', version: hangar.version, status: 'DISMISSED' }] });
    vi.advanceTimersByTime(2000);
    expect(service.active()).toBeNull();

    expect(service.play(hangar)).toBe(true);
    expect(service.active()?.index).toBe(0);
  });

  it('uses the browser record when the server cannot be read', () => {
    localStorage.setItem('icy.tutorials.u1', JSON.stringify({ hangar: hangar.version }));
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush('erreur', { status: 500, statusText: 'Server Error' });
    vi.advanceTimersByTime(2000);
    expect(service.active()).toBeNull();
  });

  it('keeps each account apart when another player logs in on the same browser', () => {
    const service = setup('/icy/hangar');
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });
    vi.advanceTimersByTime(600);
    service.skip();
    http.expectOne('/api/users/me/tutorials/hangar').flush({ data: null });

    userId = 'u2';
    events.next(new NavigationEnd(2, '/icy/hangar', '/icy/hangar'));
    http.expectOne('/api/users/me/tutorials').flush({ data: [] });
    vi.advanceTimersByTime(600);
    expect(service.active()?.tutorial.id).toBe('hangar');
  });

  it('offers no tutorial on other pages and closes the running one when leaving its page', () => {
    const service = setup('/icy/dashboard');
    expect(service.pageTutorial()).toBeNull();
    http.expectNone('/api/users/me/tutorials');

    service.play(hangar);
    events.next(new NavigationEnd(1, '/icy/fleet', '/icy/fleet'));
    expect(service.active()).toBeNull();
    http.expectNone('/api/users/me/tutorials/hangar');
  });

  it('matches the operation sheet but not the creation form', () => {
    const operation = TUTORIALS.find(tutorial => tutorial.id === 'operation-page')!;
    expect(operation.matches('/icy/operations/42')).toBe(true);
    expect(operation.matches('/icy/operations/new')).toBe(false);
    expect(operation.matches('/icy/operations/42/edit')).toBe(false);
  });
});
