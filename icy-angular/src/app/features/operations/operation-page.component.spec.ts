import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HotToastService } from '@ngxpert/hot-toast';
import { OperationPageComponent } from './operation-page.component';
import { EventService } from '../../core/services/event/event.service';
import { AuthService } from '../../core/services/auth/auth.service';

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
    await TestBed.configureTestingModule({
      imports: [OperationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'op' })) } },
        { provide: EventService, useValue: { getParticipations, setParticipationStatus, getMyHangar, leaveOperationGroup, getOperationCoordination: vi.fn(() => of(board)) } },
        { provide: AuthService, useValue: { getUserIdFromToken: vi.fn(() => 'me') } },
        { provide: HotToastService, useValue: toast },
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
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

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      (Array.from(fixture.nativeElement.querySelectorAll('.mine__actions button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent!.includes('Quitter'))!).click();
      // Le texte prévient qu'il faudra une nouvelle validation pour revenir.
      expect(confirmSpy.mock.calls[0][0]).toContain('Y revenir demandera une nouvelle validation.');
      expect(leaveOperationGroup).toHaveBeenCalledWith('op');
      http.expectOne('/api/operations/op/composition').flush({ data: { present: true, myGroupId: null, myRequest: null, groups: [{ ...group, memberCount: 0, members: [] }] } });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.mine__group').textContent).toContain('Aucune affectation');
      expect(toast.success).toHaveBeenCalledWith('Vous avez quitté votre groupe.');
    } finally { confirmSpy.mockRestore(); }
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
    expect(hangar()).not.toContain('Votre hangar est vide');

    (fixture.nativeElement.querySelector('.hangar button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(getMyHangar).toHaveBeenCalledTimes(2);
    expect(hangar()).toContain('Votre hangar est vide');
    expect(hangar()).not.toContain('n’a pas pu être chargé');
  });

  it('locks the answers of a finished operation', async () => {
    await render(true);

    expect(buttons().every(button => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Opération terminée.');
  });
});
