import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompositionGroup, OperationComposition } from './operation-composition.model';
import { OperationMyAssignmentComponent } from './operation-my-assignment.component';
import { OperationOrgChartComponent } from './operation-org-chart.component';

function group(partial: Partial<CompositionGroup> & { id: number; name: string }): CompositionGroup {
  return { parentId: null, description: null, capacity: null, effectiveMode: 'FREE', container: false, memberCount: 0, freeSeats: null, ownFreeSeats: null, responsibleUsername: null, members: [], ...partial };
}

const crew = (count: number) => Array.from({ length: count }, (_, index) => ({ userId: `u${index}`, username: `Membre ${index + 1}` }));

/** Alpha (12 places, responsable Faramir) : Polaris sur validation, Escadrille libre et complète ; Bravo géré ; Charlie libre. */
function composition(partial: Partial<OperationComposition> = {}): OperationComposition {
  return {
    present: true, myGroupId: null, myRequest: null,
    groups: [
      group({ id: 1, name: 'Alpha', capacity: 12, container: true, memberCount: 6, freeSeats: 6, ownFreeSeats: 6, responsibleUsername: 'Faramir' }),
      group({ id: 2, name: 'Polaris', parentId: 1, capacity: 8, effectiveMode: 'VALIDATION', memberCount: 2, freeSeats: 6, ownFreeSeats: 6, members: [{ userId: 'me', username: 'Moi' }, { userId: 'u1', username: 'Thorn' }] }),
      group({ id: 3, name: 'Escadrille', parentId: 1, capacity: 4, memberCount: 4, freeSeats: 0, ownFreeSeats: 0, members: crew(4) }),
      group({ id: 4, name: 'Bravo', effectiveMode: 'MANAGED', memberCount: 12, members: crew(12) }),
      group({ id: 5, name: 'Charlie', description: 'Soutien médical', memberCount: 0 })
    ],
    ...partial
  };
}

describe('OperationOrgChartComponent', () => {
  let fixture: ComponentFixture<OperationOrgChartComponent>;
  const card = (name: string): HTMLElement => Array.from(fixture.nativeElement.querySelectorAll('.leaf, .root--leaf') as NodeListOf<HTMLElement>).find(item => item.querySelector('h3, h4')!.textContent === name)!;
  const show = (value: OperationComposition, inputs: Record<string, unknown> = {}): void => {
    fixture.componentRef.setInput('composition', value);
    Object.entries(inputs).forEach(([key, input]) => fixture.componentRef.setInput(key, input));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationOrgChartComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationOrgChartComponent);
  });

  it('shows the hierarchy with head counts, capacities, modes, responsibles and members', () => {
    show(composition({ myGroupId: 2 }), { currentUserId: 'me' });
    const alpha: HTMLElement = fixture.nativeElement.querySelector('.root');
    expect(alpha.querySelector('h3')!.textContent).toBe('Alpha');
    expect(alpha.textContent).toContain('6 / 12');
    expect(alpha.textContent).toContain('Responsable : Faramir');
    expect(alpha.querySelectorAll('.leaf').length).toBe(2);
    expect(card('Polaris').textContent).toContain('Sur validation');
    expect(card('Polaris').querySelector('.members .is-me')!.textContent).toContain('Vous');
    expect(card('Polaris').textContent).toContain('Vous y êtes');
    expect(card('Escadrille').textContent).toContain('4 / 4');
    expect(card('Charlie').textContent).toContain('Soutien médical');
    expect(card('Charlie').textContent).toContain('Personne pour l’instant.');
  });

  it('offers only what the destination allows: join, request, full, managed', () => {
    const joined: string[] = [];
    const requested: string[] = [];
    show(composition());
    fixture.componentInstance.join.subscribe(item => joined.push(item.name));
    fixture.componentInstance.request.subscribe(item => requested.push(item.name));

    expect(card('Escadrille').querySelector('button')).toBeNull();
    expect(card('Escadrille').textContent).toContain('Complet');
    expect(card('Bravo').querySelector('.leaf__action button')).toBeNull();
    expect(card('Bravo').textContent).toContain('Un organisateur ou le responsable affecte les membres de ce groupe.');
    (card('Charlie').querySelector('.leaf__action button') as HTMLButtonElement).click();
    (card('Polaris').querySelector('.leaf__action button') as HTMLButtonElement).click();
    expect(joined).toEqual(['Charlie']);
    expect(requested).toEqual(['Polaris']);
    expect(card('Polaris').querySelector('.leaf__action button')!.textContent).toContain('Demander à rejoindre');
  });

  it('words a move as a transfer, and allows only one pending request', () => {
    show(composition({ myGroupId: 5 }), { currentUserId: 'me' });
    expect(card('Polaris').querySelector('.leaf__action button')!.textContent).toContain('Demander le transfert');

    show(composition({ myGroupId: 5, myRequest: { id: 'r1', groupId: 2, groupName: 'Polaris' } }));
    expect(card('Polaris').textContent).toContain('Demande envoyée');
    expect(card('Polaris').querySelector('.leaf__action button')).toBeNull();
    expect(card('Charlie').textContent).toContain('Vous y êtes');
  });

  it('explains a group blocked by its main group, keeps my name visible, and offers nothing when all is managed', () => {
    const blocked = composition();
    blocked.groups[0] = { ...blocked.groups[0], capacity: 6, freeSeats: 0, ownFreeSeats: 0 };
    blocked.groups[1] = { ...blocked.groups[1], freeSeats: 0 };
    show(blocked);
    // Polaris a encore de la place (2 / 8), mais Alpha a atteint son plafond.
    expect(card('Polaris').textContent).toContain('Groupe principal complet');
    expect(card('Polaris').querySelector('.leaf__count')!.classList.contains('is-full')).toBe(false);

    const crowded = composition({ myGroupId: 4 });
    crowded.groups[3] = { ...crowded.groups[3], members: [...crew(12), { userId: 'me', username: 'Zed' }] };
    show(crowded, { currentUserId: 'me' });
    expect(card('Bravo').querySelector('.members li')!.textContent).toContain('Zed');
  });

  it('is read-only for a member who is not present, and once the operation is over', () => {
    show(composition({ present: false }));
    expect(fixture.nativeElement.querySelectorAll('.leaf__action button').length).toBe(0);
    show(composition({ myGroupId: 2 }), { readOnly: true, currentUserId: 'me' });
    expect(fixture.nativeElement.querySelectorAll('.leaf__action button').length).toBe(0);
    expect(card('Polaris').textContent).toContain('Vous y êtes');
  });

  it('stays readable with many members: the first names, then the rest on demand', () => {
    show(composition());
    const bravo = card('Bravo');
    expect(bravo.querySelectorAll('.members li:not(.members__more)').length).toBe(8);
    const more = bravo.querySelector('.members__more button') as HTMLButtonElement;
    expect(more.textContent).toContain('+ 4 autres');
    more.click();
    fixture.detectChanges();
    expect(card('Bravo').querySelectorAll('.members li:not(.members__more)').length).toBe(12);
    expect(card('Bravo').querySelector('.members__more button')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('folds a main group and keeps its sub-groups reachable', () => {
    show(composition());
    const toggle = fixture.nativeElement.querySelector('.root__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    // Les sous-groupes restent dans le document, masqués : le bouton sait toujours ce qu'il commande.
    expect((fixture.nativeElement.querySelector('.root__children') as HTMLElement).hidden).toBe(true);
    expect(fixture.nativeElement.querySelector('.root__summary').textContent).toContain('2 sous-groupes');
    expect(fixture.nativeElement.querySelector('.root__toggle').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('OperationMyAssignmentComponent', () => {
  let fixture: ComponentFixture<OperationMyAssignmentComponent>;
  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  const buttons = (): string[] => Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map(button => button.textContent!.trim());
  const show = (value: OperationComposition | null, inputs: Record<string, unknown> = {}): void => {
    fixture.componentRef.setInput('composition', value);
    Object.entries(inputs).forEach(([key, input]) => fixture.componentRef.setInput(key, input));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationMyAssignmentComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationMyAssignmentComponent);
  });

  it('names my group, its parent, my responsible and my actions', () => {
    show(composition({ myGroupId: 2 }));
    expect(text()).toContain('Polaris');
    expect(text()).toContain('Groupe principalAlpha');
    // Le sous-groupe n'a pas de responsable : c'est celui du groupe parent.
    expect(text()).toContain('ResponsableFaramir');
    expect(buttons()).toEqual(['Changer de groupe', 'Quitter mon groupe']);
  });

  it('says that a transfer request keeps the current place, and lets me cancel it', () => {
    const cancelled: number[] = [];
    show(composition({ myGroupId: 5, myRequest: { id: 'r1', groupId: 2, groupName: 'Polaris' } }));
    fixture.componentInstance.cancelRequest.subscribe(() => cancelled.push(1));
    expect(text()).toContain('Transfert demandé');
    expect(text()).toContain('Polaris — vous gardez votre place actuelle jusqu’à la réponse.');
    (Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent!.includes('Annuler'))!).click();
    expect(cancelled.length).toBe(1);
  });

  it('guides a member without a group, and one who is not present', () => {
    show(composition());
    expect(text()).toContain('Aucune affectation');
    expect(buttons()).toEqual(['Choisir un groupe']);
    show(composition({ present: false }));
    expect(text()).toContain('Inscrivez-vous « Présent » pour rejoindre un groupe.');
    expect(buttons()).toEqual([]);
  });

  it('does not invite to choose when no group can be chosen', () => {
    const managed = composition();
    managed.groups = managed.groups.map(item => ({ ...item, effectiveMode: 'MANAGED' as const }));
    show(managed);
    expect(text()).toContain('un organisateur vous affectera');
    expect(buttons()).toEqual([]);
  });

  it('is read-only once the operation is over, and never shows a failed read as no assignment', () => {
    show(composition({ myGroupId: 2 }), { locked: true });
    expect(text()).toContain('Polaris');
    expect(text()).toContain('Opération terminée : votre affectation n’est plus modifiable.');
    expect(buttons()).toEqual([]);
    show(null, { locked: false, error: 'L’organisation n’a pas pu être chargée.' });
    expect(text()).not.toContain('Aucune affectation');
    expect(text()).toContain('n’a pas pu être lue');
    expect(buttons()).toEqual([]);
  });
});
