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

  const chips = (element: HTMLElement): string[] => Array.from(element.querySelectorAll('.crewcard__positions li'))
    .map(item => `${item.querySelector('.chip__label')!.textContent!.trim()} ${item.querySelector('.chip__count')!.textContent!.trim()}${item.querySelector('button') ? ' [bouton]' : ''}${item.querySelector('.is-mine') ? ' [mien]' : ''}${item.querySelector('.is-full') ? ' [complet]' : ''}`);

  it('shows the ship, its status, each position as a compact chip, and who is aboard with their position', async () => {
    const element = await render({ requirements: [{ id: 'r', groupId: 2, shipModelId: 286, quantity: 1, status: 'OPEN', accepted: 0, proposed: 1, missing: 1 }] });
    expect(element.querySelector('.crewcard__ship img')!.getAttribute('src')).toBe('/img/carrack.jpg');
    expect(element.querySelector('.crewcard__text strong')!.textContent).toBe('Carrack');
    expect(element.querySelector('.crewcard__status')!.textContent).toContain('proposé, à valider');
    expect(chips(element)).toEqual(['Pilote 1 / 1 [complet]', 'Artilleur 1 / 2 [mien]', 'Soutien 0 · sans limite']);
    expect(element.querySelector('.crewcard__positions li')!.querySelector('.chip')!.getAttribute('title')).toBe('Pilote : Kael');
    // Moi d'abord, puis les autres, chacun avec son poste.
    expect(element.querySelector('.crewcard__aboard')!.textContent!.replace(/\s+/g, ' ')).toContain('Moi Vous (Artilleur), Kael (Pilote), Tobias (sans poste)');
  });

  it('lets me change or leave my position only when the crew leaves the choice to its members', async () => {
    const element = await render();
    expect(element.querySelectorAll('button').length).toBe(0);
    expect(element.querySelector('.crewcard__mode')!.textContent).toContain('Chaque membre choisit son poste');

    fixture.componentRef.setInput('canChoose', true);
    fixture.detectChanges();
    const asked: Array<number | null> = [];
    fixture.componentInstance.choose.subscribe(value => asked.push(value));
    // Le poste complet et le mien ne sont pas cliquables ; le poste libre l'est, et « Quitter mon poste » me laisse sans poste.
    expect(chips(element)).toEqual(['Pilote 1 / 1 [complet]', 'Artilleur 1 / 2 [mien]', 'Soutien 0 · sans limite [bouton]']);
    element.querySelector<HTMLButtonElement>('.chip--action')!.click();
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent!.includes('Quitter mon poste'))!.click();
    expect(asked).toEqual([12, null]);
  });

  it('joins the crew at the chosen position in one gesture, only when positions are chosen by members', async () => {
    const outsider = { ...crew, members: crew.members.filter(member => member.userId !== 'me'), positions: crew.positions.map(position => position.id === 11 ? { ...position, taken: 0 } : position) };
    const element = await render({ crew: outsider, canJoinAt: true });
    const joined: number[] = [];
    fixture.componentInstance.joinAt.subscribe(value => joined.push(value));
    expect(element.querySelector('.crewcard__mode')!.textContent).toContain('Choisissez un poste pour rejoindre');
    expect(chips(element)).toEqual(['Pilote 1 / 1 [complet]', 'Artilleur 0 / 2 [bouton]', 'Soutien 0 · sans limite [bouton]']);
    element.querySelector<HTMLButtonElement>('.chip--action')!.click();
    expect(joined).toEqual([11]);

    // Postes attribués par les responsables : les pastilles informent seulement.
    fixture.componentRef.setInput('crew', { ...outsider, positionMode: 'MANAGED' });
    fixture.detectChanges();
    expect(element.querySelectorAll('.chip--action').length).toBe(0);
    expect(element.querySelector('.crewcard__mode')!.textContent).toContain('attribués par les responsables');
  });

  it('shows a free crew without positions, my name first, and folds a long list', async () => {
    const element = await render({ crew: { ...crew, positions: [], members: crew.members.map(member => ({ ...member, positionId: null })) } });
    expect(element.querySelector('.crewcard__positions')).toBeNull();
    expect(element.textContent).toContain('Équipage libre');
    expect(element.querySelector('.crewcard__aboard')!.textContent!.replace(/\s+/g, ' ')).toContain('Moi Vous, Kael, Tobias');

    const many = Array.from({ length: 12 }, (_, index) => ({ userId: `m${index}`, username: `Membre ${index + 1}`, positionId: null }));
    fixture.componentRef.setInput('crew', { ...crew, positions: [], members: [...many, { userId: 'me', username: 'Moi', positionId: null }] });
    fixture.detectChanges();
    const more = element.querySelector<HTMLButtonElement>('.crewcard__more')!;
    expect(more.textContent).toContain('+ 5 autres');
    expect(element.querySelectorAll('.crewcard__aboard .you').length).toBe(1);
    more.click();
    fixture.detectChanges();
    expect(element.querySelector('.crewcard__aboard')!.textContent).toContain('Membre 12');
  });
});

describe('Crew on the participant sheet', () => {
  it('lets a delegated responsible assign positions on their own crews only, and nobody once the operation is over', async () => {
    await TestBed.configureTestingModule({ imports: [OperationOrgChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OperationOrgChartComponent);
    // Je suis responsable de l'équipage Carrack, sans en être membre ; l'équipage Polaris est hors de ma délégation.
    const polaris: OperationCrew = { ...crew, groupId: 3, shipModelName: 'Polaris', manageable: false, members: [{ userId: 'u9', username: 'Syl', positionId: null }] };
    fixture.componentRef.setInput('composition', composition({ myGroupId: null }));
    fixture.componentRef.setInput('currentUserId', 'chef');
    fixture.componentRef.setInput('crews', [{ ...crew, manageable: true }, polaris]);
    const asked: Array<{ groupId: number; user: string; positionId: number | null }> = [];
    fixture.componentInstance.memberPosition.subscribe(event => asked.push({ groupId: event.groupId, user: event.change.member.username, positionId: event.change.positionId }));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    const panels = element.querySelectorAll('.crewcard__manage');
    expect(panels.length).toBe(1);
    expect(panels[0].closest('app-operation-crew-card')!.id).toBe('operation-crew-2');
    // Je ne suis membre d'aucun des deux : les pastilles me proposent seulement de rejoindre l'équipage, jamais de changer un poste.
    const offers = Array.from(element.querySelectorAll('app-operation-crew-card .chip--action'));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every(offer => offer.textContent!.includes('rejoindre l’équipage'))).toBe(true);
    const select = panels[0].querySelector<HTMLSelectElement>('select[aria-label="Poste de Tobias"]')!;
    expect(Array.from(select.options).map(option => `${option.textContent!.trim()}:${option.disabled}`)).toEqual(['Sans poste:false', 'Pilote (complet):true', 'Artilleur:false', 'Soutien:false']);
    select.value = '12';
    select.dispatchEvent(new Event('change'));
    const mine = panels[0].querySelector<HTMLSelectElement>('select[aria-label="Poste de Moi"]')!;
    mine.value = '';
    mine.dispatchEvent(new Event('change'));
    expect(asked).toEqual([{ groupId: 2, user: 'Tobias', positionId: 12 }, { groupId: 2, user: 'Moi', positionId: null }]);

    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    expect(element.querySelectorAll('.crewcard__manage').length).toBe(0);
    expect(element.querySelectorAll('app-operation-crew-card select').length).toBe(0);
  });

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
    element.querySelector<HTMLButtonElement>('app-operation-crew-card .chip--action')!.click();
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
      // Membre d'un autre groupe : les pastilles me font rejoindre l'équipage, elles ne changent pas mon poste.
      const joinable = change['composition'] === undefined ? false : (change['composition'] as OperationComposition).present && (change['composition'] as OperationComposition).myGroupId === 3;
      expect(element.querySelectorAll('app-operation-crew-card .chip--action').length).toBe(joinable ? 1 : 0);
    }
  });

  it('turns a free position into « join at this position », and keeps a quiet button to join without one', async () => {
    await TestBed.configureTestingModule({ imports: [OperationOrgChartComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OperationOrgChartComponent);
    fixture.componentRef.setInput('composition', composition({ myGroupId: null }));
    fixture.componentRef.setInput('currentUserId', 'nouveau');
    fixture.componentRef.setInput('crews', [crew]);
    const joinedAt: Array<{ group: number; position: number }> = [];
    const joined: number[] = [];
    fixture.componentInstance.joinAt.subscribe(event => joinedAt.push({ group: event.group.id, position: event.positionId }));
    fixture.componentInstance.join.subscribe(group => joined.push(group.id));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const card = element.querySelector('#operation-crew-2')!;
    // Pilote est complet ; Artilleur et Soutien me font rejoindre l'équipage à ce poste.
    const chips = Array.from(card.querySelectorAll<HTMLButtonElement>('.chip--action'));
    expect(chips.map(chip => chip.querySelector('.chip__label')!.textContent)).toEqual(['Artilleur', 'Soutien']);
    chips[1].click();
    const quiet = Array.from(element.querySelectorAll<HTMLButtonElement>('.leaf__action button')).find(button => button.textContent!.includes('Rejoindre sans poste'))!;
    quiet.click();
    expect(joinedAt).toEqual([{ group: 2, position: 12 }]);
    expect(joined).toEqual([2]);
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
