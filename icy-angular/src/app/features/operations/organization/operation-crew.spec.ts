import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../../../core/services/catalog/catalog.service';
import { EventService } from '../../../core/services/event/event.service';
import { OperationConfirmService } from '../operation-confirm.service';
import { OperationCrewBuilderComponent } from './operation-crew-builder.component';
import { OperationCrewPanelComponent } from './operation-crew-panel.component';
import { CrewPreset, OperationCrew } from './operation-crew.model';
import { OrganizationGroup } from './operation-organization.model';
import { OperationStructureTreeComponent } from './operation-structure-tree.component';

function group(partial: Partial<OrganizationGroup> & { id: number; name: string }): OrganizationGroup {
  return { parentId: null, description: null, capacity: null, assignmentMode: 'INHERITED', effectiveMode: 'FREE', sortOrder: 0, responsibleUserId: null, responsibleUsername: null, container: false, memberCount: 0, members: [], pendingRequests: 0, ...partial };
}

const alpha = group({ id: 1, name: 'Alpha', container: true, memberCount: 3 });
const carrackGroup = group({ id: 2, name: 'Équipage Carrack', parentId: 1, capacity: 6, memberCount: 3 });
const bravo = group({ id: 3, name: 'Bravo', memberCount: 1, members: [{ userId: 'u9', username: 'Syl' }] });
const charlie = group({ id: 4, name: 'Charlie' });

const crew: OperationCrew = {
  groupId: 2, shipModelId: 286, shipModelName: 'Carrack', shipModelImageUrl: '/img/carrack.jpg', positionMode: 'SELF', manageable: true,
  positions: [
    { id: 10, label: 'Pilote', icon: 'pilot', capacity: 1, taken: 1, sortOrder: 0 },
    { id: 11, label: 'Artilleur', icon: null, capacity: null, taken: 1, sortOrder: 1 }
  ],
  members: [
    { userId: 'u1', username: 'Kael', positionId: 10 },
    { userId: 'u2', username: 'Mira', positionId: 11 },
    { userId: 'u3', username: 'Tobias', positionId: null }
  ]
};

const preset: CrewPreset = { id: 'p1', name: 'Carrack — Exploration', description: null, shipModelId: 286, shipModelName: 'Carrack', shipModelImageUrl: null, capacity: 6, positionMode: 'MANAGED',
  positions: [{ label: 'Pilote', icon: 'pilot', capacity: 1 }, { label: 'Ingénieur', icon: 'wrench', capacity: 2 }], archived: false };

describe('OperationCrewPanelComponent', () => {
  let fixture: ComponentFixture<OperationCrewPanelComponent>;
  let events: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let changed: number;

  async function render(inputs: Record<string, unknown> = {}): Promise<HTMLElement> {
    events = {
      getCrewPresets: vi.fn(() => of([preset])),
      addOperationPosition: vi.fn(() => of({})),
      updateOperationPosition: vi.fn(() => of({})),
      deleteOperationPosition: vi.fn(() => of({})),
      setOperationMemberPosition: vi.fn(() => of({})),
      updateOperationGroup: vi.fn(() => of({}))
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [OperationCrewPanelComponent],
      providers: [{ provide: EventService, useValue: events }, { provide: HotToastService, useValue: toast }, { provide: OperationConfirmService, useValue: { ask: vi.fn(() => Promise.resolve(true)) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationCrewPanelComponent);
    fixture.componentRef.setInput('operationId', 'op');
    fixture.componentRef.setInput('group', carrackGroup);
    fixture.componentRef.setInput('crew', crew);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows the ship, each position with its seats and occupants, and who has no position', async () => {
    const element = await render();
    expect(element.querySelector('.ship__text strong')!.textContent).toContain('Carrack');
    expect(element.querySelector('.ship img')!.getAttribute('src')).toBe('/img/carrack.jpg');
    const positions = Array.from(element.querySelectorAll('.position')).map(node => node.textContent!.replace(/\s+/g, ' '));
    expect(positions[0]).toContain('Pilote');
    expect(positions[0]).toContain('1 / 1');
    expect(positions[0]).toContain('Complet');
    expect(positions[0]).toContain('Kael');
    expect(positions[1]).toContain('1 · sans limite');
    expect(positions[1]).not.toContain('Complet');
    expect(element.querySelector('.unplaced')!.textContent).toContain('Tobias');
    expect(element.textContent).toContain('Aucun appareil demandé');
  });

  it('never presents a wanted ship as available', async () => {
    const need = { id: 'r1', groupId: 2, shipModelId: 286, quantity: 1, status: 'OPEN', accepted: 0, proposed: 0, missing: 1 };
    let element = await render({ requirements: [need] });
    expect(element.querySelector('.ship__status')!.textContent).toContain('Carrack recherché');
    fixture.componentRef.setInput('requirements', [{ ...need, proposed: 1 }]);
    fixture.detectChanges();
    expect(element.querySelector('.ship__status')!.textContent).toContain('proposé, à valider');
    fixture.componentRef.setInput('requirements', [{ ...need, accepted: 1, missing: 0 }]);
    fixture.detectChanges();
    expect(element.querySelector('.ship__status')!.textContent).toContain('Carrack confirmé');
  });

  it('adds a position after the existing ones, and refuses a duplicate name before any request', async () => {
    const element = await render();
    (element.querySelector('.add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.patch({ label: ' pilote ' });
    fixture.detectChanges();
    expect(element.querySelector('.pform__error')!.textContent).toContain('déjà');
    fixture.componentInstance.savePosition();
    expect(events['addOperationPosition']).not.toHaveBeenCalled();

    fixture.componentInstance.patch({ label: ' Ingénieur ', capacity: 2, icon: 'wrench' });
    fixture.componentInstance.savePosition();
    expect(events['addOperationPosition']).toHaveBeenCalledWith('op', 2, { label: 'Ingénieur', icon: 'wrench', capacity: 2, sortOrder: 2 });
    expect(changed).toBe(1);
  });

  it('refuses a capacity under the occupants and never offers to delete an occupied position', async () => {
    const element = await render({ crew: { ...crew, positions: [{ ...crew.positions[1], taken: 3 }] } });
    expect((element.querySelector('.position__actions .danger') as HTMLButtonElement).disabled).toBe(true);
    fixture.componentInstance.startEdit(fixture.componentInstance.crew().positions[0]);
    fixture.componentInstance.patch({ capacity: 2 });
    expect(fixture.componentInstance.draftError()).toContain('3 membres');
    fixture.componentInstance.savePosition();
    expect(events['updateOperationPosition']).not.toHaveBeenCalled();
  });

  it('assigns a member, blocks a full position for the others, and reloads after a refusal', async () => {
    const element = await render();
    const select = element.querySelector<HTMLSelectElement>('select[aria-label="Poste de Tobias"]')!;
    const options = Array.from(select.options).map(option => `${option.textContent!.trim()}:${option.disabled}`);
    expect(options).toEqual(['Sans poste:false', 'Pilote (complet):true', 'Artilleur:false']);

    fixture.componentInstance.assign({ member: crew.members[2], positionId: 11, select: { value: '11' } });
    expect(events['setOperationMemberPosition']).toHaveBeenCalledWith('op', 'u3', 11);
    fixture.componentInstance.assign({ member: crew.members[0], positionId: null, select: { value: '' } });
    expect(events['setOperationMemberPosition']).toHaveBeenCalledWith('op', 'u1', null);

    events['setOperationMemberPosition'].mockReturnValueOnce(throwError(() => ({ error: { message: 'Poste complet' } })));
    const refused = { value: '10' };
    fixture.componentInstance.assign({ member: crew.members[2], positionId: 10, select: refused });
    expect(toast['error']).toHaveBeenCalledWith('Poste complet');
    // La liste ne garde pas le poste refusé.
    expect(refused.value).toBe('');
    expect(changed).toBe(3);
  });

  it('changes who assigns the positions without touching the other group settings', async () => {
    await render();
    fixture.componentInstance.setMode('MANAGED');
    expect(events['updateOperationGroup']).toHaveBeenCalledWith('op', 2, { name: 'Équipage Carrack', description: '', capacity: 6, parentId: 1, assignmentMode: 'INHERITED', sortOrder: 0, responsibleUserId: null, positionMode: 'MANAGED' });
  });

  it('copies only the missing positions of a preset', async () => {
    await render();
    fixture.componentInstance.applyPreset('p1');
    expect(events['addOperationPosition']).toHaveBeenCalledTimes(1);
    expect(events['addOperationPosition']).toHaveBeenCalledWith('op', 2, { label: 'Ingénieur', icon: 'wrench', capacity: 2, sortOrder: 2 });
  });

  it('is read-only once the operation is over', async () => {
    const element = await render({ locked: true });
    expect(element.querySelector('.add')).toBeNull();
    expect(element.querySelector('.position__actions')).toBeNull();
    expect(element.querySelector('.members select')).toBeNull();
    expect(element.querySelector('.mode')).toBeNull();
    expect(element.querySelector('.members')!.textContent).toContain('Sans poste');
    expect(events['getCrewPresets']).not.toHaveBeenCalled();
  });
});

describe('OperationCrewBuilderComponent', () => {
  let fixture: ComponentFixture<OperationCrewBuilderComponent>;
  let events: Record<string, ReturnType<typeof vi.fn>>;
  const carrack = { id: 286, name: 'Carrack', manufacturer: 'Anvil', imageUrl: '/img/carrack.jpg' } as any;

  async function render(): Promise<OperationCrewBuilderComponent> {
    events = {
      getCrewPresets: vi.fn(() => of([preset])),
      createOperationGroup: vi.fn(() => of({ data: { id: 42 } })),
      createOperationShipRequirement: vi.fn(() => of({}))
    };
    await TestBed.configureTestingModule({
      imports: [OperationCrewBuilderComponent],
      providers: [{ provide: EventService, useValue: events }, { provide: CatalogService, useValue: { browse: vi.fn(() => of({ data: { items: [carrack] } })) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationCrewBuilderComponent);
    fixture.componentRef.setInput('operationId', 'op');
    fixture.componentRef.setInput('groups', [alpha, carrackGroup, bravo, charlie]);
    fixture.componentRef.setInput('crewIds', new Set([2]));
    fixture.componentRef.setInput('initialParentId', 1);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('offers only main groups that can hold a crew, and nothing can be created before a ship is chosen', async () => {
    const builder = await render();
    // Bravo a un membre affecté directement : il ne peut pas recevoir de sous-groupe.
    expect(builder.parents().map(parent => parent.name)).toEqual(['Alpha', 'Charlie']);
    expect(builder.parentId()).toBe(1);
    expect(builder.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.builder__actions')).toBeNull();
  });

  it('creates a free crew with its ship, a free name in its level, and the matching ship need', async () => {
    const builder = await render();
    builder.chooseModel(carrack);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ship-card strong').textContent).toContain('Carrack');
    expect(builder.name()).toBe('Équipage Carrack');
    const created: unknown[] = [];
    builder.created.subscribe(result => created.push(result));

    builder.submit();

    expect(events['createOperationGroup']).toHaveBeenCalledWith('op', { name: 'Équipage Carrack 2', description: '', capacity: null, parentId: 1, assignmentMode: 'INHERITED', sortOrder: 1, responsibleUserId: null, kind: 'CREW', shipModelId: 286, presetId: null });
    expect(events['createOperationShipRequirement']).toHaveBeenCalledWith('op', { groupId: 42, shipModelId: 286, quantity: 1, notes: '' });
    expect(created).toEqual([{ groupId: 42, openPositions: false }]);
  });

  it('creates from a preset, or with custom positions to name right after, and keeps the crew if the need fails', async () => {
    const builder = await render();
    builder.chooseModel(carrack);
    expect(events['getCrewPresets']).toHaveBeenCalledWith(286);
    builder.choosePreset(preset);
    builder.parentId.set(null);
    builder.addNeed.set(false);
    builder.submit();
    expect(events['createOperationGroup'].mock.calls[0][1]).toMatchObject({ kind: 'CREW', shipModelId: 286, presetId: 'p1', parentId: null, capacity: null });
    expect(events['createOperationShipRequirement']).not.toHaveBeenCalled();

    const created: any[] = [];
    builder.created.subscribe(result => created.push(result));
    builder.setup.set('custom');
    builder.presetId.set(null);
    builder.addNeed.set(true);
    events['createOperationShipRequirement'].mockReturnValueOnce(throwError(() => new Error('refus')));
    builder.submit();
    expect(events['createOperationGroup'].mock.calls[1][1]).toMatchObject({ presetId: null });
    expect(created[0]).toMatchObject({ groupId: 42, openPositions: true });
    expect(created[0].warning).toContain('besoin');
  });

  it('shows the server refusal and stays open', async () => {
    const builder = await render();
    builder.chooseModel(carrack);
    events['createOperationGroup'].mockReturnValueOnce(throwError(() => ({ error: { message: 'Un équipage ne peut pas contenir de sous-groupes' } })));
    builder.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.builder__error').textContent).toContain('sous-groupes');
    expect(builder.saving()).toBe(false);
  });
});

describe('OperationStructureTreeComponent with crews', () => {
  it('marks crews with their ship, offers a crew next to a group, and no subgroup under a crew', async () => {
    await TestBed.configureTestingModule({ imports: [OperationStructureTreeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OperationStructureTreeComponent);
    const polaris = group({ id: 5, name: 'Équipage Polaris', sortOrder: 5 });
    fixture.componentRef.setInput('groups', [alpha, carrackGroup, polaris]);
    fixture.componentRef.setInput('crewModels', new Map([[2, 'Carrack'], [5, 'Polaris']]));
    const asked: Array<number | null> = [];
    fixture.componentInstance.addCrew.subscribe(parent => asked.push(parent));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(Array.from(element.querySelectorAll('.node__crew')).map(node => node.textContent!.trim())).toEqual(['Carrack', 'Polaris']);
    const childAdds = Array.from(element.querySelectorAll<HTMLButtonElement>('.structure__add-child'));
    // Seul Alpha, groupe ordinaire, propose d'ajouter un sous-groupe ou un équipage ; l'équipage Polaris n'en propose aucun.
    expect(childAdds.map(button => button.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['+ Sous-groupe dans Alpha', '+ Équipage dans Alpha']);
    childAdds[1].click();
    (element.querySelector('.structure__add--crew') as HTMLButtonElement).click();
    expect(asked).toEqual([1, null]);
  });
});
