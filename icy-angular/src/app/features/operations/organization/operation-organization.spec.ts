import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperationStructureTreeComponent } from './operation-structure-tree.component';
import { OperationGroupPanelComponent } from './operation-group-panel.component';
import { OperationOverviewComponent } from './operation-overview.component';
import { GroupSettings, OrganizationGroup } from './operation-organization.model';

function group(partial: Partial<OrganizationGroup> & { id: number; name: string }): OrganizationGroup {
  return { parentId: null, description: null, capacity: null, assignmentMode: 'INHERITED', effectiveMode: 'FREE', sortOrder: 0, responsibleUserId: null, responsibleUsername: null, container: false, memberCount: 0, members: [], pendingRequests: 0, ...partial };
}

const alpha = group({ id: 1, name: 'Alpha', capacity: 12, container: true, memberCount: 6, pendingRequests: 2 });
const polaris = group({ id: 2, name: 'Équipage Polaris', parentId: 1, capacity: 8, assignmentMode: 'VALIDATION', effectiveMode: 'VALIDATION', memberCount: 4, responsibleUserId: 'u1', responsibleUsername: 'Faramir', pendingRequests: 2, members: [{ userId: 'u1', username: 'Faramir' }, { userId: 'u2', username: 'Kralone' }] });
const escadrille = group({ id: 3, name: 'Escadrille', parentId: 1, capacity: 4, sortOrder: 1, memberCount: 2 });
const bravo = group({ id: 4, name: 'Bravo', sortOrder: 1, memberCount: 3, members: [{ userId: 'u3', username: 'Syl' }] });
const all = [bravo, escadrille, polaris, alpha];

describe('OperationStructureTreeComponent', () => {
  let fixture: ComponentFixture<OperationStructureTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationStructureTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationStructureTreeComponent);
    fixture.componentRef.setInput('groups', all);
    fixture.componentRef.setInput('selectedId', 2);
    fixture.detectChanges();
  });

  it('shows groups in order with their subgroups, occupancy and what needs attention', () => {
    const nodes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.node'));
    expect(nodes.map(node => node.querySelector('.node__name')?.textContent)).toEqual(['Alpha', 'Équipage Polaris', 'Escadrille', 'Bravo']);
    expect(nodes[1].classList.contains('node--child')).toBe(true);
    expect(nodes[1].textContent).toContain('4 / 8');
    expect(nodes[1].textContent).toContain('Faramir');
    expect(nodes[1].textContent).toContain('2 demandes');
    expect(nodes[1].getAttribute('aria-current')).toBe('true');
  });

  it('draws a gauge only when a capacity is set', () => {
    const nodes: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.node'));
    expect(nodes[0].querySelector('.node__gauge')).not.toBeNull();
    expect(nodes[3].querySelector('.node__gauge')).toBeNull();
    expect(nodes[3].textContent).toContain('3 membres');
  });

  it('offers quick creation of a group and of a subgroup under a main group only', () => {
    const added: Array<number | 'root'> = [];
    fixture.componentInstance.addGroup.subscribe(() => added.push('root'));
    fixture.componentInstance.addSubgroup.subscribe(id => added.push(id));
    fixture.nativeElement.querySelector('.structure__add').click();
    const addChild: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.structure__add-child'));
    addChild[0].click();
    expect(addChild.length).toBe(2);
    expect(added).toEqual(['root', 1]);
  });

  it('explains what a group is when the structure is empty', () => {
    fixture.componentRef.setInput('groups', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.structure__empty').textContent).toContain('Aucun groupe');
  });
});

describe('OperationGroupPanelComponent', () => {
  let fixture: ComponentFixture<OperationGroupPanelComponent>;

  async function render(selected: OrganizationGroup, tab = 'equipage'): Promise<void> {
    await TestBed.configureTestingModule({ imports: [OperationGroupPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationGroupPanelComponent);
    fixture.componentRef.setInput('group', selected);
    fixture.componentRef.setInput('groups', all);
    fixture.componentRef.setInput('members', [{ id: 'u1', username: 'Faramir' }, { id: 'u2', username: 'Kralone' }]);
    fixture.componentRef.setInput('openTab', tab);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows only the selected leaf group: seats, mode, responsible and crew', async () => {
    await render(polaris);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Sous-groupe de Alpha');
    expect(text).toContain('4 / 8');
    expect(text).toContain('4 places libres');
    expect(fixture.nativeElement.querySelector('.unsaved')).toBeNull();
    expect(text).toContain('Sur validation');
    expect(Array.from(fixture.nativeElement.querySelectorAll('.crew li')).map((item: any) => item.textContent.trim().slice(1))).toEqual(['Faramir', 'Kralone']);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('presents a group with subgroups as a container nobody joins directly', async () => {
    await render(alpha);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Par sous-groupe');
    expect(text).toContain('personne ne s’y inscrit directement');
    expect(fixture.nativeElement.querySelectorAll('.subgroups button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.crew')).toBeNull();
  });

  it('saves settings only when they are valid and changed', async () => {
    await render(polaris, 'reglages');
    const saved: GroupSettings[] = [];
    fixture.componentInstance.save.subscribe(value => saved.push(value));
    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('form .primary');
    expect(submit.disabled).toBe(true);

    fixture.componentInstance.setCapacity('3');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('la capacité ne peut pas être inférieure');
    expect(submit.disabled).toBe(true);

    fixture.componentInstance.setCapacity('');
    fixture.componentInstance.patch({ name: ' Escadrille ' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('porte déjà ce nom');
    expect(submit.disabled).toBe(true);

    fixture.componentInstance.patch({ name: 'Équipage Idris', assignmentMode: 'MANAGED' });
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
    fixture.componentInstance.submit();
    expect(saved).toEqual([{ name: 'Équipage Idris', description: '', capacity: null, parentId: 1, assignmentMode: 'MANAGED', sortOrder: 0, responsibleUserId: 'u1' }]);
  });

  it('keeps settings being typed when the same group is reloaded, and counts free seats within the parent limit', async () => {
    await render(escadrille, 'reglages');
    const dirty: boolean[] = [];
    fixture.componentInstance.dirtyChange.subscribe(value => dirty.push(value));
    fixture.componentInstance.patch({ name: 'Escadrille Alpha' });
    fixture.detectChanges();

    fixture.componentRef.setInput('group', { ...escadrille, sortOrder: 0, memberCount: 3 });
    fixture.componentRef.setInput('groups', [bravo, { ...alpha, capacity: 7, memberCount: 7 }, polaris, { ...escadrille, sortOrder: 0, memberCount: 3 }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.settings().name).toBe('Escadrille Alpha');
    expect(fixture.componentInstance.settings().sortOrder).toBe(0);
    expect(dirty.at(-1)).toBe(true);
    expect(fixture.componentInstance.freeSeats()).toBe(0);
    expect(fixture.nativeElement.querySelector('.unsaved')).not.toBeNull();
  });

  it('says the structure is loading instead of calling it empty', async () => {
    await TestBed.configureTestingModule({ imports: [OperationStructureTreeComponent] }).compileComponents();
    const tree = TestBed.createComponent(OperationStructureTreeComponent);
    tree.componentRef.setInput('groups', []);
    tree.componentRef.setInput('loaded', false);
    tree.detectChanges();
    expect(tree.nativeElement.querySelector('.structure__empty').textContent).toContain('en cours de chargement');
    expect(tree.nativeElement.querySelector('.structure__add').disabled).toBe(true);
  });

  it('opens the settings of a group that was just created and says where an inherited mode comes from', async () => {
    await render(escadrille, 'reglages');
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select[name="mode"]').textContent).toContain('Hérité de Alpha (Libre)');
  });
});

describe('OperationOverviewComponent', () => {
  let fixture: ComponentFixture<OperationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationOverviewComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationOverviewComponent);
  });

  it('maps the real structure with headcounts, members and what is pending', () => {
    fixture.componentRef.setInput('groups', all);
    fixture.detectChanges();
    const branches: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.branch'));
    expect(branches.length).toBe(2);
    expect(branches[0].querySelector('.branch__root')?.textContent).toContain('Alpha');
    expect(Array.from(branches[0].querySelectorAll('.leaf strong')).map(node => node.textContent)).toEqual(['Équipage Polaris', 'Escadrille']);
    expect(branches[0].textContent).toContain('Kralone');
    const figures: string = fixture.nativeElement.querySelector('.overview__figures').textContent;
    expect(figures).toContain('Membres affectés3');
    expect(figures).toContain('Demandes en attente2');
  });

  it('invites to create the first group and lets the organizer pick the default mode', () => {
    fixture.componentRef.setInput('groups', []);
    fixture.componentRef.setInput('defaultMode', 'VALIDATION');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overview__empty').textContent).toContain('L’organisation est vide');
    expect(fixture.nativeElement.querySelector('.overview__mode small').textContent).toContain('envoie une demande');
    const modes: string[] = [];
    fixture.componentInstance.defaultModeChange.subscribe(mode => modes.push(mode));
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change'));
    expect(modes).toEqual(['MANAGED']);
  });
});
