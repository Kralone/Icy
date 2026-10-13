import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoordinationGroup, OperationCoordination, OperationCoordinationBoardComponent } from './operation-coordination-board.component';

function group(partial: Partial<CoordinationGroup> & { id: number; name: string }): CoordinationGroup {
  return { parentId: null, capacity: null, effectiveMode: 'FREE', container: false, memberCount: 0, freeSeats: null, ownFreeSeats: null, responsibleUsername: null, manageable: true, members: [], ...partial };
}

const coordination: OperationCoordination = {
  organizer: true,
  present: [{ userId: 'u1', username: 'Mira' }, { userId: 'u2', username: 'Thorn' }, { userId: 'u3', username: 'Syl' }],
  maybe: [{ userId: 'u4', username: 'Jax' }],
  unavailable: [],
  unassigned: [{ userId: 'u1', username: 'Mira' }],
  groups: [
    group({ id: 1, name: 'Alpha', capacity: 5, container: true, memberCount: 2, freeSeats: 3, manageable: false }),
    group({ id: 2, name: 'Polaris', parentId: 1, capacity: 1, effectiveMode: 'VALIDATION', memberCount: 1, freeSeats: 0, ownFreeSeats: 0, responsibleUsername: 'Faramir', members: [{ userId: 'u2', username: 'Thorn' }] }),
    group({ id: 3, name: 'Escadrille', parentId: 1, effectiveMode: 'MANAGED', memberCount: 1, freeSeats: 3, members: [{ userId: 'u3', username: 'Syl' }] })
  ],
  requests: [{ id: 'r1', member: { userId: 'u3', username: 'Syl' }, groupId: 2, groupName: 'Polaris', currentGroupId: 3, currentGroupName: 'Escadrille', createdAt: '2026-10-12T10:00:00Z' }]
};

describe('OperationCoordinationBoardComponent', () => {
  let fixture: ComponentFixture<OperationCoordinationBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationCoordinationBoardComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationCoordinationBoardComponent);
    fixture.componentRef.setInput('coordination', coordination);
    fixture.detectChanges();
  });

  it('answers at a glance: who is coming, who has no place, who is waiting', () => {
    const figures: string = fixture.nativeElement.querySelector('.board__figures').textContent;
    expect(figures).toContain('Présents3');
    expect(figures).toContain('Sans affectation1');
    expect(figures).toContain('Demandes en attente1');
    expect(fixture.nativeElement.querySelector('.person--unassigned').textContent).toContain('Mira');
    expect(fixture.nativeElement.querySelector('.board__others summary').textContent).toContain('Peut-être (1)');
  });

  it('shows a transfer request with the place kept, the target seats, and both decisions', () => {
    const request: HTMLElement = fixture.nativeElement.querySelector('.request');
    expect(request.textContent).toContain('Transfert de Escadrille vers Polaris');
    expect(request.textContent).toContain('1 / 1 · complet');
    expect(request.textContent).toContain('Garde sa place actuelle');
    const decisions: Array<{ requestId: string; approve: boolean }> = [];
    fixture.componentInstance.decide.subscribe(value => decisions.push(value));
    (request.querySelector('.accept') as HTMLButtonElement).click();
    (request.querySelector('.refuse') as HTMLButtonElement).click();
    expect(decisions).toEqual([{ requestId: 'r1', approve: true }, { requestId: 'r1', approve: false }]);
  });

  it('keeps the hierarchy and lets a manager move or remove a member, never into a full group', () => {
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.group'));
    expect(cards[0].querySelector('.group__head strong')?.textContent).toBe('Alpha');
    expect(cards[0].querySelectorAll('.group--child').length).toBe(2);
    expect(cards[1].textContent).toContain('Responsable : Faramir');

    const assigned: Array<{ userId: string; groupId: number }> = [];
    const removed: string[] = [];
    fixture.componentInstance.assign.subscribe(value => assigned.push(value));
    fixture.componentInstance.remove.subscribe(member => removed.push(member.username));

    (cards[2].querySelector('.person .place') as HTMLButtonElement).click();
    fixture.detectChanges();
    const choices: HTMLButtonElement[] = Array.from(cards[2].querySelectorAll('.picker button'));
    expect(choices.length).toBe(1);
    expect(choices[0].textContent).toContain('Polaris');
    expect(choices[0].disabled).toBe(true);
    (cards[2].querySelector('.person .refuse') as HTMLButtonElement).click();
    expect(removed).toEqual(['Syl']);

    (fixture.nativeElement.querySelector('.person--unassigned .place') as HTMLButtonElement).click();
    fixture.detectChanges();
    const open: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.person--unassigned .picker button'));
    open.find(choice => choice.textContent?.includes('Escadrille'))!.click();
    expect(assigned).toEqual([{ userId: 'u1', groupId: 3 }]);
  });

  it('allows a move between subgroups of a full parent, since the member is already counted there', () => {
    fixture.componentRef.setInput('coordination', { ...coordination, requests: [], groups: [
      group({ id: 1, name: 'Alpha', capacity: 2, container: true, memberCount: 2, freeSeats: 0, ownFreeSeats: 0, manageable: false }),
      group({ id: 2, name: 'Polaris', parentId: 1, memberCount: 1, freeSeats: 0, ownFreeSeats: null, members: [{ userId: 'u2', username: 'Thorn' }] }),
      group({ id: 3, name: 'Escadrille', parentId: 1, memberCount: 1, freeSeats: 0, ownFreeSeats: null, members: [{ userId: 'u3', username: 'Syl' }] })
    ] });
    fixture.detectChanges();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.group'));
    (cards[2].querySelector('.person .place') as HTMLButtonElement).click();
    fixture.detectChanges();
    const inside = cards[2].querySelector('.picker button') as HTMLButtonElement;
    expect(inside.textContent).toContain('Polaris');
    expect(inside.disabled).toBe(false);

    (fixture.nativeElement.querySelector('.person--unassigned .place') as HTMLButtonElement).click();
    fixture.detectChanges();
    const fromOutside: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.person--unassigned .picker button'));
    expect(fromOutside.every(choice => choice.disabled)).toBe(true);
  });

  it('hides actions on groups the user does not manage and explains an empty board', () => {
    fixture.componentRef.setInput('coordination', { ...coordination, organizer: false, unassigned: [], requests: [], groups: coordination.groups.map(item => ({ ...item, manageable: item.id === 3 })) });
    fixture.detectChanges();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.group'));
    expect(cards[1].querySelector('.place')).toBeNull();
    expect(cards[2].querySelector('.place')).not.toBeNull();

    fixture.componentRef.setInput('coordination', { organizer: true, present: [], maybe: [], unavailable: [], unassigned: [], groups: [], requests: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.board__empty').textContent).toContain('Personne n’est encore inscrit Présent');
  });
});
