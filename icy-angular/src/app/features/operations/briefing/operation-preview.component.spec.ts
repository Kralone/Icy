import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { FleetRequirement, FleetShip } from '../organization/operation-fleet-cards.component';
import { OrganizationGroup } from '../organization/operation-organization.model';
import { OperationPreviewComponent } from './operation-preview.component';
import { OperationSheet } from './operation-sheet.model';

const draft: OperationSheet = { id: 'op', title: 'Escorte Nyx', allowShipProposals: true, startDateTime: '2026-11-20T20:30:00', endDateTime: '2026-11-20T23:30:00', finished: false, publicationStatus: 'DRAFT',
  briefing: 'Protéger le convoi.', objectives: JSON.stringify([{ kind: 'PRINCIPAL', text: 'Convoi arrivé' }]), meetingPoint: 'Levski', typeName: 'Escorte', typeBackgroundColor: '#b45309', typeTextColor: '#fef3c7' };

function group(partial: Partial<OrganizationGroup> & { id: number; name: string }): OrganizationGroup {
  return { parentId: null, description: null, capacity: null, assignmentMode: 'INHERITED', effectiveMode: 'FREE', sortOrder: 0, responsibleUserId: null, responsibleUsername: null, container: false, memberCount: 0, members: [], pendingRequests: 0, ...partial };
}

const groups = [
  group({ id: 1, name: 'Alpha', capacity: 4, container: true, memberCount: 1 }),
  group({ id: 2, name: 'Escadrille', parentId: 1, capacity: 2, memberCount: 1, members: [{ userId: 'u1', username: 'Mira' }] }),
  group({ id: 3, name: 'Polaris', parentId: 1, effectiveMode: 'VALIDATION' })
];
const needs: FleetRequirement[] = [
  { id: 'n1', groupId: 2, shipModelId: 42, quantity: 2, status: 'OPEN', shipModelName: 'Prospector', shipModelImageUrl: null, accepted: 1, proposed: 0, missing: 1 },
  { id: 'n2', groupId: null, shipModelId: 7, quantity: 1, status: 'CANCELLED', shipModelName: 'Carrack', shipModelImageUrl: null, accepted: 0, proposed: 0, missing: 1 }
];
const ships: FleetShip[] = [{ id: 's1', shipId: 42, ownerUserId: 'u1', ownerUsername: 'Mira', groupId: 2, requirementId: 'n1', status: 'ACCEPTED', shipName: 'Prospector', shipImageUrl: null, inHangar: true, ownerPresent: true }];

describe('OperationPreviewComponent', () => {
  let fixture: ComponentFixture<OperationPreviewComponent>;
  let http: HttpTestingController;
  const text = (selector: string): string => (fixture.nativeElement.querySelector(selector) as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationPreviewComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OperationPreviewComponent);
    fixture.componentRef.setInput('operation', draft);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('requirements', needs);
    fixture.componentRef.setInput('ships', ships);
    fixture.detectChanges();
  });

  it('shows a draft as the published sheet will look: banner, briefing, objectives, organisation, fleet', () => {
    expect(text('app-operation-hero')).toContain('Opération · Escorte');
    expect(text('app-operation-hero')).toContain('Brouillon');
    expect(text('app-operation-hero')).toContain('Levski');
    // Pas de lien de navigation, pas de compteur inventé tant que personne n'a pu répondre.
    expect(fixture.nativeElement.querySelector('.hero__back')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hero__present')).toBeNull();
    expect(text('.panel--briefing')).toContain('Protéger le convoi.');
    expect(text('.panel--objectives')).toContain('Convoi arrivé');
    expect(text('app-operation-org-chart')).toContain('Alpha');
    expect(text('app-operation-org-chart')).toContain('Mira');
    expect(text('app-operation-org-chart')).toContain('Vaisseaux Prospector de Mira');
    expect(text('app-operation-fleet-cards')).toContain('Flotte prévue');
    expect(text('app-operation-fleet-cards')).toContain('Manque 1 sur 2');
    expect(text('app-operation-fleet-cards')).toContain('Appareils proposés');
    // Dans l'éditeur, le titre de l'aperçu n'est pas un second titre de niveau 1.
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
    // Un besoin annulé n'est pas montré aux participants.
    expect(text('app-operation-fleet-cards')).not.toContain('Carrack');
    expect(text('.panel--fleet')).toContain('Les membres présents pourront proposer un vaisseau de leur hangar.');
  });

  it('offers no participant action and never calls the server', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);
    // Restent seulement les boutons de présence, inactifs, et le repli des groupes.
    const active = buttons.filter(button => !button.disabled).map(button => button.className);
    expect(active.every(name => name.includes('root__toggle'))).toBe(true);
    expect(buttons.filter(button => button.disabled).length).toBe(3);
    expect(fixture.nativeElement.querySelector('.leaf__action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mine__actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.card__actions')).toBeNull();
    expect(text('app-operation-my-assignment')).toContain('Chaque participant verra ici son groupe');
    expect(text('.panel--presence')).toContain('Aperçu : les membres pourront répondre après la publication.');

    buttons.forEach(button => button.click());
    fixture.detectChanges();
    http.expectNone(() => true);
  });

  it('shows the answers already given once the operation is published', () => {
    fixture.componentRef.setInput('operation', { ...draft, publicationStatus: 'PUBLISHED' });
    // Tant que les réponses ne sont pas lues, pas de listes vides ni de compteur à zéro.
    fixture.componentRef.setInput('participationsState', 'loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.crew-group')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hero__present')).toBeNull();
    expect(text('.panel--presence')).toContain('Chargement des réponses des membres…');

    fixture.componentRef.setInput('participations', { confirmed: [{ user: { username: 'Mira' } }, { user: { username: 'Thorn' } }], maybe: [], refused: [] });
    fixture.componentRef.setInput('participationsState', 'ready');
    fixture.detectChanges();
    expect(text('.hero__present')).toContain('2 confirmés');
    expect(text('.crew-group.status-confirmed')).toContain('Thorn');
    expect(text('.panel--presence')).toContain('Aperçu : les membres répondent sur la fiche publiée.');
  });

  it('never shows an unread structure or fleet as empty, and follows the closure', () => {
    fixture.componentRef.setInput('organizationState', 'loading');
    fixture.componentRef.setInput('fleetError', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-operation-org-chart')).toBeNull();
    expect(text('.panel--organisation')).toContain('Chargement de l’organisation…');
    expect(fixture.nativeElement.querySelector('app-operation-fleet-cards')).toBeNull();
    expect(text('.panel--fleet')).toContain('La flotte n’a pas pu être chargée');

    fixture.componentRef.setInput('organizationState', 'ready');
    fixture.componentRef.setInput('fleetError', false);
    fixture.componentRef.setInput('operation', { ...draft, publicationStatus: 'PUBLISHED', locked: true, briefing: '' });
    fixture.componentRef.setInput('participationsState', 'ready');
    fixture.detectChanges();
    expect(text('.panel--briefing')).toContain('Aucun briefing.');
    expect(text('.panel--fleet')).toContain('Opération terminée : la flotte n’est plus modifiable.');
    expect(text('.panel--presence')).toContain('Opération terminée.');
  });
});
