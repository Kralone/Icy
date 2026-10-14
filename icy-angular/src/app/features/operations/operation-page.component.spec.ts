import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { OperationPageComponent } from './operation-page.component';
import { EventService } from '../../core/services/event/event.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { OperationConfirmService } from './operation-confirm.service';

describe('OperationPageComponent', () => {
  let component: OperationPageComponent;
  let fixture: ComponentFixture<OperationPageComponent>;
  let http: HttpTestingController;
  let getParticipations: ReturnType<typeof vi.fn>;
  let setParticipationStatus: ReturnType<typeof vi.fn>;
  let leaveOperationGroup: ReturnType<typeof vi.fn>;
  let getMyHangar: ReturnType<typeof vi.fn>;
  const board = { organizer: false, present: [], maybe: [], unavailable: [], unassigned: [{ userId: 'u9', username: 'Syl' }], groups: [], requests: [{ id: 'r1', member: { userId: 'u8', username: 'Jax' }, groupId: 3, groupName: 'Escadrille', currentGroupId: null, currentGroupName: null, createdAt: null }] };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let live: Subject<void>;
  const me = { status: 1, user: { id: 'me', username: 'Moi' } };
  const other = { status: 0, user: { id: 'other', username: 'Autre' } };

  async function render(finished = false): Promise<void> {
    fixture = TestBed.createComponent(OperationPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2026-10-20T20:00:00', endDateTime: '2026-10-20T23:00:00', finished } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.participation-actions button'));
  }

  beforeEach(async () => {
    getParticipations = vi.fn().mockReturnValue(of({ data: [other] }));
    setParticipationStatus = vi.fn(() => of({}));
    leaveOperationGroup = vi.fn(() => of({}));
    getMyHangar = vi.fn(() => of({ data: [] }));
    toast = { success: vi.fn(), error: vi.fn() };
    live = new Subject<void>();
    await TestBed.configureTestingModule({
      imports: [OperationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'op' })) } },
        { provide: EventService, useValue: { getParticipations, setParticipationStatus, getMyHangar, leaveOperationGroup, getOperationCoordination: vi.fn(() => of(board)), getOperationCrews: vi.fn(() => of([])),
          approveOperationAssignment: vi.fn(() => of({})), requestOperationGroup: vi.fn(() => of({ code: 2033 })) } },
        { provide: AuthService, useValue: { getUserIdFromToken: vi.fn(() => 'me') } },
        { provide: HotToastService, useValue: toast },
        { provide: WebSocketService, useValue: { watchOperation: vi.fn(() => live.asObservable()) } },
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('gives an organizer the editor link and the coordination board, and neither to a plain member', async () => {
    await render();
    expect(fixture.nativeElement.querySelector('.section-nav__manage')).toBeNull();
    expect(component.coordination).toBeNull();

    fixture = TestBed.createComponent(OperationPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/users/me/profile').flush({ data: { roles: ['officier'] } });
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2026-10-20T20:00:00', endDateTime: '2026-10-20T23:00:00', finished: false } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.section-nav__manage').getAttribute('href')).toBe('/icy/operations/op/edit');
    expect(component.coordination).toEqual(board);
  });

  it('reads counters, lists and the active button back from the server after each answer', async () => {
    await render();
    expect(fixture.nativeElement.querySelector('.hero__present').textContent).toContain('0 confirmé');
    expect(fixture.nativeElement.querySelector('.crew-group.status-maybe h4').textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]')).toBeNull();

    getParticipations.mockReturnValue(of({ data: [other, me] }));
    buttons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setParticipationStatus).toHaveBeenCalledWith('op', 1);
    expect(getParticipations).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.hero__present').textContent).toContain('1 confirmé');
    expect(fixture.nativeElement.querySelector('.crew-group.status-confirmed h4').textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]').textContent).toContain('Présent');
    expect(fixture.nativeElement.querySelector('.crew-group.status-confirmed').textContent).toContain('Moi');
    expect(toast.success).toHaveBeenCalledWith('Présence enregistrée : Présent.');
  });

  it('reports a failed answer once, in the panel, without the browser technical message', async () => {
    await render();
    setParticipationStatus.mockReturnValue(throwError(() => ({ status: 0, error: new TypeError('Failed to fetch') })));

    buttons()[2].click();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert: string = fixture.nativeElement.querySelector('.participation-error').textContent;
    expect(alert).toContain('Votre réponse n’a pas été enregistrée. Veuillez réessayer.');
    expect(alert).toContain('Recharger les participations');
    expect(alert).not.toContain('Failed to fetch');
    expect(toast.error).not.toHaveBeenCalled();
    expect(getParticipations).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.crew-group.status-maybe').textContent).toContain('Autre');
  });

  it('shows the mission at a glance: type, title, schedule, meeting point, status, then briefing and objectives', async () => {
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'Escorte Nyx', allowShipProposals: false, startDateTime: '2099-11-20T20:30:00', endDateTime: '2099-11-20T23:30:00', finished: false,
      meetingPoint: 'Levski', typeName: 'Escorte', typeBackgroundColor: '#27647c', briefing: 'Protéger le convoi.', objectives: JSON.stringify([{ kind: 'SECONDAIRE', text: 'Aucune perte' }, { kind: 'PRINCIPAL', text: 'Convoi arrivé' }]) } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const hero: string = fixture.nativeElement.querySelector('app-operation-hero').textContent;
    expect(hero).toContain('Opération · Escorte');
    expect(hero).toContain('Escorte Nyx');
    expect(hero).toContain('20h30 – 23h30');
    expect(hero).toContain('Levski');
    expect(hero).toContain('À venir');
    // Sans image de mission ni image de type : un aplat aux couleurs du type, pas d'image cassée.
    expect(fixture.nativeElement.querySelector('.hero__image')).toBeNull();
    expect(fixture.nativeElement.querySelector('.panel--briefing').textContent).toContain('Protéger le convoi.');
    const objectives: string = fixture.nativeElement.querySelector('.panel--objectives').textContent;
    expect(objectives.indexOf('Convoi arrivé')).toBeLessThan(objectives.indexOf('Aucune perte'));
    expect(Array.from(fixture.nativeElement.querySelectorAll('.section-nav button')).map(button => (button as HTMLElement).textContent!.trim())).toEqual(['Mon affectation', 'Présence', 'Briefing', 'Organisation', 'Flotte']);
  });

  it('reads my assignment back from the server after I leave my group', async () => {
    const group = { id: 3, parentId: null, name: 'Escadrille', capacity: null, effectiveMode: 'VALIDATION', container: false, memberCount: 1, freeSeats: null, ownFreeSeats: null, responsibleUsername: null, members: [{ userId: 'me', username: 'Moi' }] };
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
    http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: 3, myRequest: null, groups: [group] } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mine__group').textContent).toContain('Escadrille');

    const confirmSpy = vi.spyOn(TestBed.inject(OperationConfirmService), 'ask').mockResolvedValue(true);
    try {
      (Array.from(fixture.nativeElement.querySelectorAll('.mine__actions button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent!.includes('Quitter'))!).click();
      // Le texte prévient qu'il faudra une nouvelle validation pour revenir.
      expect(confirmSpy.mock.calls[0][0].message).toContain('Y revenir demandera une nouvelle validation.');
      await fixture.whenStable();
      expect(leaveOperationGroup).toHaveBeenCalledWith('op');
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: null, myRequest: null, groups: [{ ...group, memberCount: 0, members: [] }] } });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.mine__group').textContent).toContain('Aucune affectation');
      expect(toast.success).toHaveBeenCalledWith('Vous avez quitté votre groupe.');
    } finally { confirmSpy.mockRestore(); }
  });

  describe('mise à jour sans recharger la page', () => {
    const group = { id: 3, parentId: null, name: 'Minage FPS', capacity: 4, effectiveMode: 'VALIDATION', container: false, memberCount: 0, freeSeats: 4, ownFreeSeats: 4, responsibleUsername: null, members: [] as Array<{ userId: string; username: string }> };
    const joined = { ...group, memberCount: 1, freeSeats: 3, ownFreeSeats: 3, members: [{ userId: 'me', username: 'Moi' }] };

    async function renderWith(composition: object): Promise<void> {
      fixture = TestBed.createComponent(OperationPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
      http.expectOne('/api/operations/op/composition').flush({ data: composition });
      http.match(() => true).forEach(request => request.flush({ data: [] }));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('reads my assignment and the chart again once a request is decided from the coordination board', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: { id: 'r1', groupId: 3, groupName: 'Minage FPS' }, groups: [group] });
      expect(fixture.nativeElement.querySelector('#affectation').textContent).toContain('Minage FPS');

      component.decideRequest('op', 'r1', true);
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: 3, myRequest: null, groups: [joined] } });
      fixture.detectChanges();

      expect(component.composition?.myGroupId).toBe(3);
      expect(component.composition?.myRequest).toBeNull();
      expect(fixture.nativeElement.querySelector('#organisation').textContent).toContain('Moi');
      expect(toast.success).toHaveBeenCalledWith('Demande acceptée.');
    });

    it('clears my pending request and keeps the counters once it is refused', async () => {
      const eventService = TestBed.inject(EventService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
      eventService['refuseOperationAssignment'] = vi.fn(() => of({}));
      await renderWith({ present: true, myGroupId: null, myRequest: { id: 'r1', groupId: 3, groupName: 'Minage FPS' }, groups: [group] });

      component.decideRequest('op', 'r1', false);
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: null, myRequest: null, groups: [group] } });
      fixture.detectChanges();

      expect(eventService['refuseOperationAssignment']).toHaveBeenCalledWith('r1');
      expect(component.composition?.myRequest).toBeNull();
      expect(component.composition?.groups[0].memberCount).toBe(0);
      expect(toast.success).toHaveBeenCalledWith('Demande refusée.');
    });

    it('does not send a second read while the previous one is still waiting for the server', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: null, groups: [group] });
      component.refreshQuietly();
      component.refreshQuietly();
      expect(http.match('/api/operations/op/composition').length).toBe(1);
    });

    it('shows what other members did at the next quiet refresh, without a loading state', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: null, groups: [group] });
      const someoneElse = { ...group, memberCount: 1, freeSeats: 3, ownFreeSeats: 3, members: [{ userId: 'u7', username: 'Nova' }] };

      component.refreshQuietly();
      expect(component.participationLoading).toBe(false);
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: null, myRequest: null, groups: [someoneElse] } });
      http.match(() => true).filter(request => !request.cancelled).forEach(request => request.flush({ data: [] }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#organisation').textContent).toContain('Nova');
    });

    it('reads the sheet again as soon as the server reports a change made by someone else', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: null, groups: [group] });
      expect(TestBed.inject(WebSocketService).watchOperation).toHaveBeenCalledWith('op');
      const someoneElse = { ...group, memberCount: 1, freeSeats: 3, ownFreeSeats: 3, members: [{ userId: 'u7', username: 'Nova' }] };

      live.next(); live.next(); live.next();
      await new Promise(resolve => setTimeout(resolve, OperationPageComponent.LIVE_DEBOUNCE_MS + 50));
      // Trois signaux rapprochés : une seule relecture.
      const reads = http.match('/api/operations/op/composition');
      expect(reads.length).toBe(1);
      reads[0].flush({ data: { present: true, myGroupId: null, myRequest: null, groups: [someoneElse] } });
      http.match(() => true).filter(request => !request.cancelled).forEach(request => request.flush({ data: [] }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#organisation').textContent).toContain('Nova');
    });

    it('waits for an action in progress instead of refreshing over it', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: null, groups: [group] });
      component.assignmentBusy = true;
      component.refreshQuietly();
      http.expectNone('/api/operations/op/composition');
    });

    it('says the place is taken when the server places an organizer directly instead of filing a request', async () => {
      await renderWith({ present: true, myGroupId: null, myRequest: null, groups: [group] });
      component.requestGroup('op', group as never);
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: 3, myRequest: null, groups: [joined] } });
      expect(toast.success).toHaveBeenCalledWith('Vous avez rejoint Minage FPS.');
    });
  });

  it('keeps the coordination board folded until asked, and says what is waiting in it', async () => {
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
    fixture.detectChanges();
    // Un groupe m'est délégué : le tableau de coordination est chargé.
    http.expectOne('/api/operations/op/groups').flush({ data: [{ id: 3, name: 'Escadrille', assignmentMode: 'FREE', responsibleUserId: 'me' }] });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const fold: HTMLButtonElement = fixture.nativeElement.querySelector('.fold');
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(fold.textContent).toContain('1 demande en attente');
    expect(fold.textContent).toContain('1 sans affectation');
    expect((fixture.nativeElement.querySelector('app-operation-coordination-board') as HTMLElement).hidden).toBe(true);

    (Array.from(fixture.nativeElement.querySelectorAll('.section-nav button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent!.includes('Coordination'))!).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fold').getAttribute('aria-expanded')).toBe('true');
    expect((fixture.nativeElement.querySelector('app-operation-coordination-board') as HTMLElement).hidden).toBe(false);
  });

  it('tells an unreadable hangar from an empty one, and reads it again on demand', async () => {
    getMyHangar.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    getParticipations.mockReturnValue(of({ data: [me] }));
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: true, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
    const hangar = (): string => fixture.nativeElement.querySelector('.hangar').textContent;
    expect(hangar()).toContain('Votre hangar n’a pas pu être chargé.');
    expect(hangar()).not.toContain('aucun vaisseau dans votre hangar');

    (fixture.nativeElement.querySelector('.hangar button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getMyHangar).toHaveBeenCalledTimes(2);
    expect(hangar()).toContain('aucun vaisseau dans votre hangar');
    expect(hangar()).not.toContain('n’a pas pu être chargé');
  });

  it('treats the 404 the server sends for an empty hangar as an empty hangar, not a failure', async () => {
    getMyHangar.mockReturnValue(throwError(() => ({ status: 404 })));
    getParticipations.mockReturnValue(of({ data: [me] }));
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: true, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
    http.match(() => true).forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
    const hangar: string = fixture.nativeElement.querySelector('.hangar').textContent;
    expect(hangar).toContain('Vous n’avez encore aucun vaisseau dans votre hangar.');
    expect(hangar).not.toContain('n’a pas pu être chargé');
    expect(fixture.nativeElement.querySelector('.hangar a').getAttribute('href')).toBe('/icy/hangar');
  });

  it('lets an organizer accept a proposed ship from the sheet, and nobody else', async () => {
    const eventService = TestBed.inject(EventService) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    eventService['acceptOperationShipProposal'] = vi.fn(() => of({}));
    const proposed = [{ id: 's1', shipId: 7, shipName: 'Prospector', status: 'PROPOSED', ownerUserId: 'other', ownerUsername: 'Autre', ownerPresent: true, inHangar: true, groupId: null, requirementId: null }];
    const open = async (roles: string[]): Promise<void> => {
      fixture = TestBed.createComponent(OperationPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      http.expectOne('/api/users/me/profile').flush({ data: { roles } });
      http.expectOne('/api/operations/op').flush({ data: { id: 'op', title: 'QA', allowShipProposals: true, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } });
      http.match(() => true).forEach(request => request.flush({ data: [] }));
      fixture.detectChanges();
      // La flotte n'est demandée qu'une fois la fiche affichée.
      http.match(request => request.url === '/api/operations/op/ships').forEach(request => request.flush({ data: proposed }));
      http.match(() => true).forEach(request => request.flush({ data: [] }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const accept = (): HTMLButtonElement | undefined => (Array.from(fixture.nativeElement.querySelectorAll('#flotte button')) as HTMLButtonElement[]).find(button => button.textContent!.startsWith('Accepter'));

    await open(['USER']);
    expect(accept()).toBeUndefined();

    await open(['OFFICIER']);
    expect(fixture.nativeElement.querySelector('#flotte').textContent).not.toContain('Modifier le besoin');
    accept()!.click();
    expect(eventService['acceptOperationShipProposal']).toHaveBeenCalledWith('op', 's1');
    expect(toast.success).toHaveBeenCalledWith('Vaisseau accepté.');
  });

  it('locks the answers of a finished operation', async () => {
    await render(true);

    expect(buttons().every(button => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Opération terminée.');
  });

  const sheet = { data: { id: 'op', title: 'QA', allowShipProposals: false, startDateTime: '2099-10-20T20:00:00', endDateTime: '2099-10-20T23:00:00', finished: false } };

  async function settle(): Promise<void> {
    http.match(request => request.url !== '/api/operations/op').forEach(request => request.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('names a missing or refused operation without offering a useless retry', async () => {
    for (const [status, title] of [[404, 'Opération introuvable'], [403, 'Accès refusé']] as Array<[number, string]>) {
      fixture = TestBed.createComponent(OperationPageComponent);
      fixture.detectChanges();
      http.expectOne('/api/operations/op').flush({ message: 'refus' }, { status, statusText: 'Erreur' });
      await settle();

      const error: HTMLElement = fixture.nativeElement.querySelector('.operation-error');
      expect(error.querySelector('h1')!.textContent).toBe(title);
      expect(error.textContent).not.toContain('connexion');
      expect(error.querySelector('button')).toBeNull();
      expect(error.querySelector('a')!.textContent).toContain('Retour au calendrier');
    }
  });

  it('offers a retry when the server cannot be reached, and shows the sheet once it answers', async () => {
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').error(new ProgressEvent('error'));
    await settle();

    const error: HTMLElement = fixture.nativeElement.querySelector('.operation-error');
    expect(error.querySelector('h1')!.textContent).toBe('Serveur injoignable');
    expect(getParticipations).toHaveBeenCalledTimes(1);

    (error.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush(sheet);
    await settle();

    expect(fixture.nativeElement.querySelector('.operation-error')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-operation-hero').textContent).toContain('QA');
    expect(getParticipations).toHaveBeenCalledTimes(2);
  });

  it('never states that no ship is needed when the needs could not be read, even if the ships were', async () => {
    fixture = TestBed.createComponent(OperationPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/operations/op').flush(sheet);
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne('/api/operations/op/ship-requirements').flush({ message: 'panne' }, { status: 500, statusText: 'Erreur' });
    http.expectOne('/api/operations/op/ships').flush({ data: [] });
    await settle();

    const fleet: string = fixture.nativeElement.querySelector('.panel--fleet').textContent;
    expect(fleet).toContain('La flotte n’a pas pu être chargée.');
    expect(fleet).toContain('Les besoins de vaisseaux n’ont pas pu être chargés.');
    expect(fleet).not.toContain('Aucun besoin de vaisseau');
    // Les appareils, eux, ont été lus : leur liste vide est un fait.
    expect(fleet).toContain('Aucun appareil proposé');

    (fixture.nativeElement.querySelector('.panel--fleet .operation-coordination__error button') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne('/api/operations/op/ship-requirements').flush({ data: [] });
    http.expectOne('/api/operations/op/ships').flush({ data: [] });
    await settle();

    const reread: string = fixture.nativeElement.querySelector('.panel--fleet').textContent;
    expect(reread).not.toContain('n’a pas pu être chargée');
    expect(reread).toContain('Aucun besoin de vaisseau');
  });
});
