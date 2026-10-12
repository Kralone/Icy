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

    const ships = text('.card--ship');
    // Les propositions à valider passent devant.
    expect(ships[0]).toContain('Propriétaire : Thorn');
    expect(ships[0]).toContain('Proposé');
    expect(ships[0]).toContain('répond au besoin Prospector');
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
    expect(text('.card--ship').every(card => card.includes('Prospector'))).toBe(true);

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
    const pending: HTMLElement = fixture.nativeElement.querySelector('.card--ship[data-status="PROPOSED"]');
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
    expect(text('.card--ship').length).toBe(3);
  });
});
