import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../../../core/services/catalog/catalog.service';
import { EventService } from '../../../core/services/event/event.service';
import { routes } from '../../../app.routes';
import { CrewPreset } from '../../operations/organization/operation-crew.model';
import { CrewPresetsComponent } from './crew-presets.component';

const carrack: CrewPreset = { id: 'p1', name: 'Carrack — Exploration', description: 'Sortie longue', shipModelId: 286, shipModelName: 'Carrack', shipModelImageUrl: '/img/carrack.jpg', capacity: 6, positionMode: 'MANAGED', archived: false,
  positions: [{ label: 'Pilote', icon: 'pilot', capacity: 1 }, { label: 'Ingénieur', icon: 'wrench', capacity: null }] };
const old: CrewPreset = { id: 'p2', name: 'MOLE — Extraction', description: null, shipModelId: null, shipModelName: 'MOLE', shipModelImageUrl: null, capacity: null, positionMode: 'SELF', archived: true, positions: [] };

describe('CrewPresetsComponent', () => {
  let fixture: ComponentFixture<CrewPresetsComponent>;
  let events: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    events = {
      getCrewPresetLibrary: vi.fn(() => of([carrack, old])),
      saveCrewPreset: vi.fn(() => of(carrack)),
      setCrewPresetArchived: vi.fn(() => of({}))
    };
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CrewPresetsComponent],
      providers: [provideRouter([]), { provide: EventService, useValue: events }, { provide: HotToastService, useValue: toast }, { provide: CatalogService, useValue: { browse: vi.fn(() => of({ data: { items: [] } })) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(CrewPresetsComponent);
    fixture.detectChanges();
  });

  it('lists illustrated presets, hides archived ones until asked, and filters by preset or ship name', () => {
    const element: HTMLElement = fixture.nativeElement;
    const titles = () => Array.from(element.querySelectorAll('.card')).map(card => card.querySelector('h3')!.firstChild!.textContent!.trim() + (card.querySelector('.badge') ? ' [archivé]' : ''));
    expect(titles()).toEqual(['Carrack — Exploration']);
    expect(element.querySelector('.card img')!.getAttribute('src')).toBe('/img/carrack.jpg');
    expect(element.querySelector('.card__facts')!.textContent).toContain('6 places · Attribués par les responsables');
    expect(Array.from(element.querySelectorAll('.chips li')).map(node => node.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Pilote1', 'Ingénieur']);

    fixture.componentInstance.showArchived.set(true);
    fixture.detectChanges();
    expect(titles()).toEqual(['Carrack — Exploration', 'MOLE — Extraction [archivé]']);
    expect(element.textContent).toContain('hors catalogue');

    fixture.componentInstance.filter.set('mole');
    fixture.detectChanges();
    expect(titles()).toEqual(['MOLE — Extraction [archivé]']);
  });

  it('refuses to save without a ship, a name, or with invalid positions, before any request', () => {
    const page = fixture.componentInstance;
    page.create();
    expect(page.draftError()).toContain('vaisseau');
    page.chooseModel({ id: 286, name: 'Carrack', imageUrl: '/img/carrack.jpg' } as any);
    expect(page.draft()!.name).toBe('Carrack — ');
    expect(page.draftError()).toContain('nom');
    page.set('name', 'Carrack — Combat');
    page.addPosition();
    expect(page.draftError()).toContain('Chaque poste');
    page.setPosition(0, { label: 'Pilote', capacity: 0 });
    expect(page.draftError()).toContain('1 à 1000');
    page.setPosition(0, { capacity: 1 });
    page.addPosition();
    page.setPosition(1, { label: ' pilote ' });
    expect(page.draftError()).toContain('Deux postes');
    page.save();
    expect(events['saveCrewPreset']).not.toHaveBeenCalled();
  });

  it('creates a preset with its ordered positions, then reloads the library', () => {
    const page = fixture.componentInstance;
    page.create();
    page.chooseModel({ id: 286, name: 'Carrack', imageUrl: '' } as any);
    page.set('name', ' Carrack — Combat ');
    page.set('capacity', page.toNumber('8'));
    page.set('positionMode', 'MANAGED');
    page.addPosition();
    page.setPosition(0, { label: 'Artilleur', capacity: 4, icon: 'target' });
    page.addPosition();
    page.setPosition(1, { label: 'Pilote', capacity: 1, icon: 'pilot' });
    page.movePosition(1, -1);
    page.save();

    expect(events['saveCrewPreset']).toHaveBeenCalledWith(null, { name: 'Carrack — Combat', description: null, shipModelId: 286, capacity: 8, positionMode: 'MANAGED',
      positions: [{ label: 'Pilote', icon: 'pilot', capacity: 1 }, { label: 'Artilleur', icon: 'target', capacity: 4 }] });
    expect(page.draft()).toBeNull();
    expect(events['getCrewPresetLibrary']).toHaveBeenCalledTimes(2);
  });

  it('edits an existing preset, asks for a ship again when its model left the catalog, and archives or restores', () => {
    const page = fixture.componentInstance;
    page.edit(carrack);
    expect(page.draft()).toMatchObject({ id: 'p1', capacity: 6, positionMode: 'MANAGED', model: { id: 286, name: 'Carrack' } });
    page.removePosition(1);
    page.save();
    expect(events['saveCrewPreset'].mock.calls[0][0]).toBe('p1');
    expect(events['saveCrewPreset'].mock.calls[0][1].positions).toEqual([{ label: 'Pilote', icon: 'pilot', capacity: 1 }]);

    page.edit(old);
    expect(page.draft()!.model).toBeNull();
    expect(page.draftError()).toContain('vaisseau');
    page.draft.set(null);

    page.setArchived(carrack, true);
    page.setArchived(old, false);
    expect(events['setCrewPresetArchived'].mock.calls).toEqual([['p1', true], ['p2', false]]);
  });

  it('keeps the entry and says so when the server refuses the write', () => {
    const page = fixture.componentInstance;
    events['saveCrewPreset'].mockReturnValueOnce(throwError(() => ({ status: 401 })));
    page.edit(carrack);
    page.save();
    expect(toast['error']).toHaveBeenCalledWith('Seul un administrateur peut modifier les presets.');
    expect(page.draft()).not.toBeNull();
  });

  it('is reachable by administrators only', () => {
    const find = (list: any[], path: string): any => list.flatMap(route => [route, ...(route.children ? [find(route.children, path)] : [])]).find(route => route?.path === path);
    const admin = (routes as any[]).flatMap(route => route.children ?? []).find(route => route.path === 'admin') ?? find(routes as any[], 'admin');
    const presets = admin.children.find((route: any) => route.path === 'crew-presets');
    expect(presets.data.roles).toEqual(['ADMIN']);
    expect(admin.data.roles).toEqual(['ADMIN', 'OFFICIER']);
  });
});
