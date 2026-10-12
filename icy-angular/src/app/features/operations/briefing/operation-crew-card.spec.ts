import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperationCrew } from '../organization/operation-crew.model';
import { CompositionGroup, OperationComposition } from './operation-composition.model';
import { OperationCrewCardComponent } from './operation-crew-card.component';
import { OperationMyAssignmentComponent } from './operation-my-assignment.component';
import { OperationOrgChartComponent } from './operation-org-chart.component';

const crew: OperationCrew = {
  groupId: 2, shipModelId: 286, shipModelName: 'Carrack', shipModelImageUrl: '/img/carrack.jpg', positionMode: 'SELF', manageable: false,
  positions: [
    { id: 10, label: 'Pilote', icon: 'pilot', capacity: 1, taken: 1, sortOrder: 0 },
    { id: 11, label: 'Artilleur', icon: 'target', capacity: 2, taken: 1, sortOrder: 1 },
    { id: 12, label: 'Soutien', icon: null, capacity: null, taken: 0, sortOrder: 2 }
  ],
  members: [
    { userId: 'u1', username: 'Kael', positionId: 10 },
    { userId: 'me', username: 'Moi', positionId: 11 },
    { userId: 'u3', username: 'Tobias', positionId: null }
  ]
};

function group(partial: Partial<CompositionGroup> & { id: number; name: string }): CompositionGroup {
  return { parentId: null, description: null, capacity: null, effectiveMode: 'FREE', container: false, memberCount: 0, freeSeats: null, ownFreeSeats: null, responsibleUsername: null, members: [], ...partial };
}

function composition(partial: Partial<OperationComposition> = {}): OperationComposition {
  return {
    present: true, myGroupId: 2, myRequest: null,
    groups: [
      group({ id: 1, name: 'Alpha', container: true, memberCount: 3 }),
      group({ id: 2, name: 'Équipage Carrack', parentId: 1, capacity: 6, memberCount: 3, freeSeats: 3, ownFreeSeats: 3, members: crew.members }),
      group({ id: 3, name: 'Escorte', memberCount: 1, members: [{ userId: 'u9', username: 'Syl' }] })
    ],
    ...partial
  };
}

describe('OperationCrewCardComponent', () => {
  let fixture: ComponentFixture<OperationCrewCardComponent>;

  async function render(inputs: Record<string, unknown> = {}): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [OperationCrewCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationCrewCardComponent);
    fixture.componentRef.setInput('crew', crew);
    fixture.componentRef.setInput('currentUserId', 'me');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows the ship, its status, each position with its occupants, and who has no position', async () => {
    const element = await render({ requirements: [{ id: 'r', groupId: 2, shipModelId: 286, quantity: 1, status: 'OPEN', accepted: 0, proposed: 1, missing: 1 }] });
    expect(element.querySelector('.crewcard__ship img')!.getAttribute('src')).toBe('/img/carrack.jpg');
    expect(element.querySelector('.crewcard__text strong')!.textContent).toBe('Carrack');
    expect(element.querySelector('.crewcard__status')!.textContent).toContain('proposé, à valider');
    const rows = Array.from(element.querySelectorAll('.crewcard__positions li')).map(row => Array.from(row.querySelectorAll('strong, .crewcard__count, .crewcard__names, .crewcard__nobody, .tag')).map(node => node.textContent!.trim()).join(' | '));
    expect(rows).toEqual(['Pilote | 1 / 1 | Kael | Complet', 'Artilleur | 1 / 2 | Moi Vous | Votre poste', 'Soutien | 0 · sans limite | Libre']);
    expect(element.querySelector('.crewcard__unplaced')!.textContent).toContain('Tobias');
  });

  it('lets me change or leave my position only when the crew leaves the choice to its members', async () => {
    let element = await render();
    expect(element.querySelectorAll('button').length).toBe(0);
    expect(element.querySelector('.crewcard__mode')!.textContent).toContain('Chaque membre choisit son poste');

    fixture.componentRef.setInput('canChoose', true);
    fixture.detectChanges();
    const asked: Array<number | null> = [];
    fixture.componentInstance.choose.subscribe(value => asked.push(value));
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
    // Le poste complet n'offre aucun bouton ; le mien offre « Quitter », le poste libre « Passer ici ».
    expect(buttons.map(button => button.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Quitter le poste Artilleur', 'Passer ici : poste Soutien']);
    buttons[1].click();
    buttons[0].click();
    expect(asked).toEqual([12, null]);
  });

  it('says that positions are assigned by the responsibles, and shows a free crew without positions', async () => {
    const element = await render({ crew: { ...crew, positionMode: 'MANAGED' } });
    expect(element.querySelector('.crewcard__mode')!.textContent).toContain('attribués par les responsables');

    fixture.componentRef.setInput('crew', { ...crew, positions: [], members: crew.members.map(member => ({ ...member, positionId: null })) });
    fixture.detectChanges();
    expect(element.querySelector('.crewcard__positions')).toBeNull();
    expect(element.textContent).toContain('Équipage libre');
    // Mon nom passe en premier, avec la mention « Vous ».
    expect(element.querySelector('.crewcard__unplaced')!.textContent!.replace(/\s+/g, ' ')).toContain('Moi Vous, Kael, Tobias');

    const many = Array.from({ length: 12 }, (_, index) => ({ userId: `m${index}`, username: `Membre ${index + 1}`, positionId: null }));
    fixture.componentRef.setInput('crew', { ...crew, positions: [], members: [...many, { userId: 'me', username: 'Moi', positionId: null }] });
    fixture.detectChanges();
    const more = element.querySelector<HTMLButtonElement>('.crewcard__more')!;
    expect(more.textContent).toContain('+ 5 autres');
    expect(element.querySelectorAll('.crewcard__unplaced .you').length).toBe(1);
    more.click();
    fixture.detectChanges();
    expect(element.querySelector('.crewcard__unplaced')!.textContent).toContain('Membre 12');
  });
});

describe('Crew on the participant sheet', () => {
  it('draws a crew as a ship unit in the chart, an ordinary group as before, and only my own crew offers a choice', async () => {
    await TestBed.configureTestingModule({ imports: [OperationOrgChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OperationOrgChartComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('composition', composition());
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.componentRef.setInput('crews', [crew]);
    const chosen: Array<number | null> = [];
    fixture.componentInstance.position.subscribe(value => chosen.push(value));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('app-operation-crew-card').length).toBe(1);
    // Le groupe ordinaire garde sa liste de membres.
    expect(Array.from(element.querySelectorAll('.members li')).map(item => item.textContent!.trim())).toEqual(['Syl']);
    const take = Array.from(element.querySelectorAll<HTMLButtonElement>('app-operation-crew-card button')).find(button => button.textContent!.includes('Passer ici'))!;
    take.click();
    expect(chosen).toEqual([12]);

    // « Choisir mon poste » : le groupe principal replié se déplie et la carte de mon équipage reçoit le focus.
    const alphaToggle = element.querySelector<HTMLButtonElement>('.root__toggle')!;
    if (alphaToggle.getAttribute('aria-expanded') === 'true') alphaToggle.click();
    fixture.detectChanges();
    expect(alphaToggle.getAttribute('aria-expanded')).toBe('false');
    fixture.componentInstance.reveal(2);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    expect(alphaToggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('operation-crew-2');

    // Un autre équipage que le mien, une opération terminée ou un membre non présent : aucun choix de poste.
    for (const change of [{ composition: composition({ myGroupId: 3 }) }, { readOnly: true }, { composition: composition({ present: false }) }] as Array<Record<string, unknown>>) {
      fixture.componentRef.setInput('composition', composition());
      fixture.componentRef.setInput('readOnly', false);
      for (const [name, value] of Object.entries(change)) fixture.componentRef.setInput(name, value);
      fixture.detectChanges();
      expect(element.querySelectorAll('app-operation-crew-card button').length).toBe(0);
    }
  });

  it('tells me my ship and my position, and whether I can choose it', async () => {
    await TestBed.configureTestingModule({ imports: [OperationMyAssignmentComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OperationMyAssignmentComponent);
    fixture.componentRef.setInput('composition', composition());
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.componentRef.setInput('crew', crew);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const facts = (): string[] => Array.from(element.querySelectorAll('.mine__facts > div')).map(row => `${row.querySelector('dt')!.textContent!.trim()}: ${row.querySelector('dd')!.textContent!.trim()}`);
    expect(facts()).toContain('Vaisseau: Carrack');
    expect(facts()).toContain('Poste: Artilleur');
    const asked: string[] = [];
    fixture.componentInstance.choosePosition.subscribe(() => asked.push('poste'));
    fixture.componentInstance.browse.subscribe(() => asked.push('groupe'));
    Array.from(element.querySelectorAll('button')).find(button => button.textContent!.trim() === 'Changer de poste')!.click();
    // « Changer de poste » mène à mon équipage, pas à la liste des groupes.
    expect(asked).toEqual(['poste']);

    fixture.componentRef.setInput('crew', { ...crew, positionMode: 'MANAGED', members: crew.members.map(member => ({ ...member, positionId: null })) });
    fixture.detectChanges();
    expect(facts()).toContain('Poste: Sans poste');
    expect(element.textContent).toContain('Poste défini par les responsables');
    expect(Array.from(element.querySelectorAll('button')).map(button => button.textContent!.trim())).not.toContain('Choisir mon poste');

    // Groupe ordinaire : aucune mention de vaisseau ni de poste.
    fixture.componentRef.setInput('crew', null);
    fixture.detectChanges();
    expect(element.querySelector('.mine__facts')!.textContent).not.toContain('Poste');
  });
});
