import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OperationDraftsComponent } from './operation-drafts.component';
import { EventService } from '../../../core/services/event/event.service';
import { UserService } from '../../../core/services/user/user.service';

describe('OperationDraftsComponent', () => {
  let fixture: ComponentFixture<OperationDraftsComponent>;
  let getOperationDrafts: ReturnType<typeof vi.fn>;
  let getAll: ReturnType<typeof vi.fn>;
  let roles: string[];
  const type = { name: 'Combat', textColor: '#ffffff', backgroundColor: '#123456', imageUrl: '' };
  const event = (id: string, title: string, start: string, finished: boolean, activityType = 'OPERATION') =>
    ({ id, title, type, description: '', startDateTime: start, endDateTime: start, createdAt: start, finished, activityType });

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [OperationDraftsComponent],
      providers: [provideRouter([]), { provide: EventService, useValue: { getOperationDrafts, getAll } }, { provide: UserService, useValue: { getMyProfile: () => of({ data: { roles } }) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationDraftsComponent);
    fixture.detectChanges();
  }

  const section = (name: string): HTMLElement => fixture.nativeElement.querySelector(`.block--${name}`);
  const titles = (name: string): string[] => Array.from(section(name).querySelectorAll('h3')).map(title => (title as HTMLElement).textContent!.trim());

  beforeEach(() => {
    getOperationDrafts = vi.fn(() => of([]));
    getAll = vi.fn(() => of([]));
    roles = ['OFFICIER'];
  });

  it('shows the crew presets entry below the history, to administrators only', async () => {
    await render();
    expect(section('presets')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/icy/admin/crew-presets"]')).toBeNull();

    TestBed.resetTestingModule();
    roles = ['ADMIN'];
    await render();
    const blocks = Array.from(fixture.nativeElement.querySelectorAll('.block')).map(block => (block as HTMLElement).className);
    expect(blocks.at(-1)).toContain('block--presets');
    expect(blocks.at(-2)).toContain('block--past');
    expect(section('presets').querySelector('a')!.getAttribute('href')).toBe('/icy/admin/crew-presets');
  });

  it('lists each draft with its title, dates and a link back to the editor', async () => {
    getOperationDrafts = vi.fn(() => of([
      { id: 'op-1', title: 'Escorte du convoi', type: 'Combat', startDateTime: '2026-10-20T20:00:00', endDateTime: '2026-10-20T23:00:00', updatedAt: '2026-10-12T09:30:00Z' }
    ]));
    await render();

    const card: HTMLElement = section('drafts').querySelector('.draft-card')!;
    expect(card.querySelector('h3')?.textContent).toContain('Escorte du convoi');
    expect(card.textContent).toContain('Date prévue');
    expect(card.textContent).toContain('2026');
    expect(card.textContent).toContain('Dernière modification');
    const resume = card.querySelector('a.resume') as HTMLAnchorElement;
    expect(resume.textContent).toContain('Reprendre l’édition');
    expect(resume.getAttribute('href')).toBe('/icy/operations/op-1/edit');
  });

  it('shows planned operations first and open, drafts and history folded', async () => {
    getAll = vi.fn(() => of([
      event('late', 'Plus tard', '2026-12-01T20:00:00', false),
      event('old', 'Ancienne', '2026-01-10T20:00:00', true),
      event('soon', 'Bientôt', '2026-11-01T20:00:00', false),
      event('recent', 'Récente', '2026-09-10T20:00:00', true),
      event('party', 'Soirée', '2026-11-05T20:00:00', false, 'EVENT')
    ]));
    await render();

    expect(titles('planned')).toEqual(['Bientôt', 'Plus tard']);
    expect(titles('past')).toEqual(['Récente', 'Ancienne']);
    expect(section('planned').tagName).toBe('SECTION');
    expect((section('drafts') as HTMLDetailsElement).open).toBe(false);
    expect((section('past') as HTMLDetailsElement).open).toBe(false);
    const links = Array.from(section('planned').querySelector('.draft-card')!.querySelectorAll('a')).map(link => link.getAttribute('href'));
    expect(links).toEqual(['/icy/operations/soon/edit', '/icy/operations/soon', '/icy/operations/new?from=soon']);
  });

  it('says so when there is no draft', async () => {
    await render();

    expect(section('drafts').querySelector('.empty')!.textContent).toContain('Aucun brouillon en cours');
    expect(section('planned').querySelector('.empty')!.textContent).toContain('Aucune opération prévue');
  });

  it('offers a retry when the drafts cannot be loaded', async () => {
    getOperationDrafts = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 0 }))).mockReturnValue(of([]));
    await render();

    expect(section('drafts').querySelector('[role="alert"]')!.textContent).toContain('Impossible de charger les brouillons.');
    (section('drafts').querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getOperationDrafts).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not present unreadable published operations as an empty list', async () => {
    getAll = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 500 }))).mockReturnValue(of([]));
    await render();

    expect(section('planned').querySelector('[role="alert"]')!.textContent).toContain('Impossible de charger les opérations publiées.');
    expect(section('planned').querySelector('.empty')).toBeNull();
    (section('planned').querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(section('planned').querySelector('.empty')).not.toBeNull();
  });
});
