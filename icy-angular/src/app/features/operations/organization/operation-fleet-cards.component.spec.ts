import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FleetRequirement, FleetShip, OperationFleetCardsComponent } from './operation-fleet-cards.component';

function need(partial: Partial<FleetRequirement> & { id: string }): FleetRequirement {
  return { groupId: null, shipModelId: 42, quantity: 2, status: 'OPEN', shipModelName: 'Prospector', shipModelImageUrl: 'https://img/prospector.jpg', accepted: 0, proposed: 0, missing: 2, ...partial };
}

function ship(partial: Partial<FleetShip> & { id: string }): FleetShip {
  return { shipId: 42, ownerUserId: 'u1', ownerUsername: 'Mira', status: 'PROPOSED', shipName: 'Prospector', shipImageUrl: 'https://img/prospector.jpg', inHangar: true, ownerPresent: true, ...partial };
}

const groups = [{ id: 1, name: 'Alpha', parentId: null }, { id: 2, name: 'Minage', parentId: 1 }, { id: 3, name: 'Bravo', parentId: null }];

describe('OperationFleetCardsComponent', () => {
  let fixture: ComponentFixture<OperationFleetCardsComponent>;
  const text = (selector: string): string[] => Array.from(fixture.nativeElement.querySelectorAll(selector)).map(element => (element as HTMLElement).textContent!.replace(/\s+/g, ' ').trim());

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationFleetCardsComponent] }).compileComponents();
    fixture = TestBed.createComponent(OperationFleetCardsComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('requirements', [need({ id: 'n1', groupId: 2, accepted: 1, proposed: 1, missing: 1 }), need({ id: 'n2', shipModelId: null, shipModelName: null, shipModelImageUrl: null, quantity: 1, accepted: 1, missing: 0 })]);
    fixture.componentRef.setInput('ships', [
      ship({ id: 's1', status: 'ACCEPTED', groupId: 2, requirementId: 'n1' }),
      ship({ id: 's2', ownerUserId: 'u2', ownerUsername: 'Thorn', groupId: 2, requirementId: 'n1' }),
      ship({ id: 's3', ownerUserId: 'u3', ownerUsername: 'Syl', shipName: 'Cutlass', shipImageUrl: null, status: 'ACCEPTED', groupId: 3, inHangar: false, ownerPresent: false })
    ]);
    fixture.detectChanges();
  });

  it('separates needs from offered ships and shows what is still missing', () => {
    const needs = text('.card--need');
    expect(needs[0]).toContain('Prospector');
    expect(needs[0]).toContain('Minage');
    expect(needs[0]).toContain('Recherché × 2');
    // Couvert : le besoin n'est plus « recherché ».
    expect(needs[1]).toContain('Prévu × 1');
    expect(needs[0]).toContain('Manque 1 sur 2');
    expect(needs[0]).toContain('1 à valider');
    expect(needs[1]).toContain('Tout modèle');
    expect(needs[1]).toContain('Couvert');
    expect(needs[1]).toContain('Sans image');

    // Les appareils proposés pour un besoin sont dans sa carte, les propositions à valider devant.
    const linked = text('.card--need:first-child .need-ship');
    expect(linked.length).toBe(2);
    expect(linked[0]).toContain('Propriétaire : Thorn');
    expect(linked[0]).toContain('Proposé');
    expect(linked[1]).toContain('Accepté');
    // Ils ne sont pas répétés dans la liste des autres appareils.
    const others = text('.card--ship');
    expect(others.length).toBe(1);
    expect(others[0]).toContain('Cutlass');
    expect(text('.fleet__block h4')).toEqual(['Besoins', 'Autres appareils proposés']);
  });

  it('lists every ship when needs are not shown, and marks a covered need clearly', () => {
    expect(fixture.nativeElement.querySelector('.card--need.is-covered .tag--covered').textContent).toContain('Couvert');
    fixture.componentRef.setInput('showRequirements', false);
    fixture.detectChanges();
    expect(text('.card--ship').length).toBe(3);
    expect(text('.fleet__block h4')).toEqual(['Appareils proposés']);
    expect(text('.card--ship')[0]).toContain('répond au besoin Prospector');
    expect(fixture.nativeElement.querySelector('.card--ship img').getAttribute('src')).toBe('https://img/prospector.jpg');
  });

  it('flags a ship that left the hangar or whose owner is no longer present, without hiding it', () => {
    const cutlass = text('.card--ship').find(card => card.includes('Cutlass'))!;
    expect(cutlass).toContain('Absent du hangar');
    expect(cutlass).toContain('Propriétaire non présent');
    expect(cutlass).toContain('Accepté');
  });

  it('limits a group view to its own needs and ships, sub-groups included', () => {
    fixture.componentRef.setInput('scopeGroupId', 1);
    fixture.detectChanges();
    expect(text('.card--need').length).toBe(1);
    expect(text('.need-ship').length).toBe(2);
    expect(text('.card--ship').length).toBe(0);

    fixture.componentRef.setInput('scopeGroupId', 3);
    fixture.detectChanges();
    expect(text('.fleet__empty')[0]).toContain('Aucun besoin de vaisseau pour ce groupe');
    expect(text('.card--ship').length).toBe(1);
  });

  it('gives a member only the withdrawal of their own ship, and an organizer the decisions', () => {
    fixture.componentRef.setInput('currentUserId', 'u2');
    fixture.detectChanges();
    expect(text('.card__actions button')).toEqual(['Retirer ma proposition : Prospector']);

    fixture.componentRef.setInput('organizer', true);
    fixture.detectChanges();
    const accepted: string[] = [];
    const declined: string[] = [];
    fixture.componentInstance.accept.subscribe(id => accepted.push(id));
    fixture.componentInstance.decline.subscribe(id => declined.push(id));
    const pending: HTMLElement = fixture.nativeElement.querySelector('.need-ship[data-status="PROPOSED"]');
    // L'organisateur n'a que deux décisions : accepter ou refuser.
    expect(Array.from(pending.querySelectorAll('.card__actions button')).map(button => button.textContent!.trim().split(' ')[0])).toEqual(['Accepter', 'Refuser', 'Retirer']);
    (pending.querySelector('.accept') as HTMLButtonElement).click();
    (pending.querySelector('.refuse') as HTMLButtonElement).click();
    expect(accepted).toEqual(['s2']);
    expect(declined).toEqual(['s2']);
    expect(fixture.nativeElement.querySelector('.card--need .card__actions')).not.toBeNull();
  });

  it('is read-only once the operation is over', () => {
    fixture.componentRef.setInput('organizer', true);
    fixture.componentRef.setInput('currentUserId', 'u2');
    fixture.componentRef.setInput('locked', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(0);
    expect(text('.card--ship').length + text('.need-ship').length).toBe(3);
  });

  it('says that needs or ships could not be read instead of presenting them as empty', () => {
    fixture.componentRef.setInput('requirements', []);
    fixture.componentRef.setInput('ships', []);
    fixture.componentRef.setInput('requirementsUnavailable', true);
    fixture.detectChanges();
    expect(text('.fleet__empty')).toEqual(['Les besoins de vaisseaux n’ont pas pu être chargés.', 'Aucun appareil proposé en dehors des besoins.']);

    fixture.componentRef.setInput('requirementsUnavailable', false);
    fixture.componentRef.setInput('shipsUnavailable', true);
    fixture.detectChanges();
    expect(text('.fleet__empty')).toEqual(['Aucun besoin de vaisseau.', 'Les appareils proposés n’ont pas pu être chargés.']);
  });

  it('never leaves an unsaved pilot showing: the list returns to the saved one until the server confirms', () => {
    fixture.componentRef.setInput('organizer', true);
    fixture.componentRef.setInput('members', [{ id: 'u1', username: 'Mira' }, { id: 'u2', username: 'Thorn' }]);
    fixture.detectChanges();
    const chosen: Array<{ proposalId: string; userId: string | null }> = [];
    fixture.componentInstance.pilot.subscribe(value => chosen.push(value));
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.card__pilot select');
    expect(select.value).toBe('');

    select.value = 'u2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    // La demande est partie, mais rien n'est encore enregistré : la liste montre toujours « Non désigné ».
    expect(chosen.length).toBe(1);
    expect(chosen[0].userId).toBe('u2');
    expect(select.value).toBe('');

    // Choisir de nouveau le pilote déjà enregistré ne déclenche rien.
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(chosen.length).toBe(1);

    // Après un enregistrement réussi, la relecture apporte le nouveau pilote.
    const ships = (fixture.componentInstance.ships() as FleetShip[]).map(ship => ship.id === chosen[0].proposalId ? { ...ship, pilotUserId: 'u2', pilotUsername: 'Thorn' } : ship);
    fixture.componentRef.setInput('ships', ships);
    fixture.detectChanges();
    const saved: HTMLSelectElement = Array.from(fixture.nativeElement.querySelectorAll('.card__pilot select') as NodeListOf<HTMLSelectElement>).find(item => item.value === 'u2')!;
    expect(saved).toBeTruthy();

    // Retirer le pilote envoie « aucun » et garde l'affichage du pilote enregistré en attendant.
    saved.value = '';
    saved.dispatchEvent(new Event('change'));
    expect(chosen[1]).toEqual({ proposalId: chosen[0].proposalId, userId: null });
    expect(saved.value).toBe('u2');
  });
});
