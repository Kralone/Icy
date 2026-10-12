import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { OperationEditorComponent } from './operation-editor.component';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService } from '../../core/services/catalog/catalog.service';
import { UserService } from '../../core/services/user/user.service';
import { HotToastService } from '@ngxpert/hot-toast';

describe('OperationEditorComponent', () => {
  let component: OperationEditorComponent;
  let fixture: ComponentFixture<OperationEditorComponent>;
  let updateOperation: ReturnType<typeof vi.fn>;
  let createOperationGroup: ReturnType<typeof vi.fn>;
  let organizationGroups: any[];
  let assignOperationMember: ReturnType<typeof vi.fn>;
  const coordinationData = { organizer: true, present: [{ userId: 'u1', username: 'Mira' }], maybe: [], unavailable: [], unassigned: [{ userId: 'u1', username: 'Mira' }], requests: [], groups: [{ id: 3, parentId: null, name: 'Escadrille', capacity: 4, effectiveMode: 'MANAGED', container: false, memberCount: 0, freeSeats: 4, ownFreeSeats: 4, responsibleUsername: null, manageable: true, members: [] }] };

  beforeEach(async () => {
    organizationGroups = [];
    assignOperationMember = vi.fn(() => of({}));
    createOperationGroup = vi.fn(() => of({ data: { id: 5 } }));
    updateOperation = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValue(of({ data: {} }));
    const operation = { id: 'op', title: 'QA', briefing: '', objectives: '[]', meetingPoint: '', imageUrl: '', allowShipProposals: false, publicationStatus: 'DRAFT', startDateTime: '2026-10-20T20:30:00', revision: 7 };
    await TestBed.configureTestingModule({
      imports: [OperationEditorComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'op' })) } },
        { provide: EventService, useValue: {
          getOperationForEdit: vi.fn(() => of(operation)),
          getOperationOrganization: vi.fn(() => of({ defaultAssignmentMode: 'FREE', groups: [...organizationGroups] })),
          createOperationGroup,
          getOperationCoordination: vi.fn(() => of(coordinationData)),
          assignOperationMember,
          removeOperationMember: vi.fn(() => of({})),
          approveOperationAssignment: vi.fn(() => of({})),
          refuseOperationAssignment: vi.fn(() => of({})),
          getOperationShipRequirements: vi.fn(() => of({ data: [] })),
          getOperationShips: vi.fn(() => of({ data: [] })),
          getOperationAssignmentRequests: vi.fn(() => of({ data: [] })),
          updateOperation,
        } },
        { provide: CatalogService, useValue: { browse: vi.fn(() => of({ data: { items: [] } })) } },
        { provide: UserService, useValue: { getAllUsers: vi.fn(() => of({ data: [] })) } },
        { provide: HotToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers a retry after a save error and preserves the form payload', () => {
    component.form.briefing = 'À conserver';
    component.save();
    fixture.detectChanges();

    expect(component.saveError).toBe(true);
    const alert: HTMLElement = fixture.nativeElement.querySelector('.save-alert');
    expect(alert.querySelector('[role="alert"]')?.textContent).toContain('Modifications non enregistrées');
    expect(alert.querySelector('details')?.textContent).toContain('Serveur injoignable');
    expect(component.form.briefing).toBe('À conserver');

    (alert.querySelector('.save-alert__actions button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateOperation).toHaveBeenCalledTimes(2);
    expect(component.saveError).toBe(false);
    expect(fixture.nativeElement.querySelector('.save-alert')).toBeNull();
    expect(updateOperation.mock.calls[0][1].briefing).toBe('À conserver');
    expect(updateOperation.mock.calls[1][1].briefing).toBe('À conserver');
    expect(updateOperation.mock.calls[0][1].expectedRevision).toBe(7);
  });

  it('autosaves a draft after typing stops, without clicking save', () => {
    vi.useFakeTimers();
    try {
      updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
      textarea.value = 'Première frappe';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.autosave.status).toBe('dirty');
      expect(updateOperation).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1500);
      fixture.detectChanges();

      expect(updateOperation).toHaveBeenCalledTimes(1);
      expect(updateOperation.mock.calls[0][1]).toMatchObject({ briefing: 'Première frappe', expectedRevision: 7 });
      expect(component.autosave.status).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends pending changes when the editor is left, and blocks publication until the server confirms', () => {
    updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
    component.form.meetingPoint = 'Area18';
    component.touch();
    component.tab = 'publication';
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.editor-card button.primary').disabled).toBe(true);

    fixture.destroy();

    expect(updateOperation).toHaveBeenCalledTimes(1);
    expect(updateOperation.mock.calls[0][1].meetingPoint).toBe('Area18');
  });

  it('shows nothing about saving while everything works, and only a small activity mark during a write', () => {
    const pending = new Subject<{ revision: number }>();
    updateOperation.mockReset().mockReturnValue(pending);
    const header: HTMLElement = fixture.nativeElement.querySelector('header');
    const quiet = header.textContent;
    expect(fixture.nativeElement.querySelector('.save-activity, .save-alert')).toBeNull();

    component.form.briefing = 'Saisie';
    component.touch();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.save-activity, .save-alert')).toBeNull();

    component.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.save-activity')).not.toBeNull();
    expect(header.textContent).toBe(quiet);

    pending.next({ revision: 8 });
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.save-activity, .save-alert')).toBeNull();
    expect(header.textContent).toBe(quiet);
  });

  it('keeps both ways out of a conflict within reach, with the explanation on demand', () => {
    updateOperation.mockReset().mockReturnValue(throwError(() => ({ status: 409 })));
    component.form.briefing = 'Ma version';
    component.save();
    fixture.detectChanges();

    const alert: HTMLElement = fixture.nativeElement.querySelector('.save-alert');
    expect(alert.querySelector('[role="alert"]')?.textContent).toContain('Modifié ailleurs');
    expect(Array.from(alert.querySelectorAll('.save-alert__actions button')).map(button => button.textContent?.trim())).toEqual(['Garder ma version', 'Charger la version du serveur']);
    expect(alert.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(alert.querySelector('details p')?.textContent).toContain('autre organisateur');
  });

  it('saves the rest of the draft while the image address is still being typed', () => {
    updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
    component.form.briefing = 'Briefing';
    component.form.imageUrl = 'https:';
    component.save();
    fixture.detectChanges();

    expect(updateOperation.mock.calls[0][1]).toMatchObject({ briefing: 'Briefing', imageUrl: '' });
    expect(fixture.nativeElement.querySelector('.field-warning').textContent).toContain('Adresse incomplète');

    component.form.imageUrl = 'https://exemple.test/mission.webp';
    component.save();
    expect(updateOperation.mock.calls[1][1].imageUrl).toBe('https://exemple.test/mission.webp');
  });

  it('asks before leaving when changes cannot be saved, and not when a draft can still be sent', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      expect(component.canLeave()).toBe(true);

      updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
      component.form.meetingPoint = 'Area18';
      component.touch();
      expect(component.canLeave()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();

      updateOperation.mockReturnValue(throwError(() => ({ status: 0 })));
      component.save();
      expect(component.saveError).toBe(true);
      expect(component.canLeave()).toBe(false);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('creates a group in one click, selects it and opens its settings', () => {
    component.tab = 'organisation';
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-operation-overview')).not.toBeNull();

    organizationGroups.push({ id: 5, parentId: null, name: 'Nouveau groupe', description: '', capacity: null, assignmentMode: 'INHERITED', effectiveMode: 'FREE', sortOrder: 0, responsibleUserId: null, responsibleUsername: null, container: false, memberCount: 0, members: [], pendingRequests: 0 });
    fixture.nativeElement.querySelector('.structure__add').click();
    fixture.detectChanges();

    expect(createOperationGroup.mock.calls[0][1]).toMatchObject({ name: 'Nouveau groupe', parentId: null, assignmentMode: 'INHERITED', sortOrder: 0 });
    expect(component.selectedGroupId()).toBe(5);
    expect(fixture.nativeElement.querySelector('app-operation-group-panel form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.save-indicator, .save-row__state')).toBeNull();
  });

  it('saves the default assignment mode with the draft and applies it to groups without their own mode', () => {
    vi.useFakeTimers();
    try {
      updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
      component.organization.set({ defaultAssignmentMode: 'FREE', groups: [{ id: 1, parentId: null, name: 'Alpha', description: '', capacity: null, assignmentMode: 'INHERITED', effectiveMode: 'FREE', sortOrder: 0, responsibleUserId: null, responsibleUsername: null, container: false, memberCount: 0, members: [], pendingRequests: 0 }] });

      component.setDefaultMode('VALIDATION');
      vi.advanceTimersByTime(1500);

      expect(updateOperation.mock.calls[0][1].defaultAssignmentMode).toBe('VALIDATION');
      expect(component.organizationGroups()[0].effectiveMode).toBe('VALIDATION');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the organizer place an unassigned member from the coordination board, then reads the result back', () => {
    component.selectTab('permissions');
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const board: HTMLElement = fixture.nativeElement.querySelector('app-operation-coordination-board');
    expect(board.textContent).toContain('Sans affectation');

    (board.querySelector('.person--unassigned .place') as HTMLButtonElement).click();
    fixture.detectChanges();
    (board.querySelector('.picker button') as HTMLButtonElement).click();

    expect(assignOperationMember).toHaveBeenCalledWith('op', 'u1', 3);
    expect(TestBed.inject(EventService).getOperationCoordination).toHaveBeenCalledTimes(2);
  });

  it('does not autosave an operation that is already published', () => {
    vi.useFakeTimers();
    try {
      updateOperation.mockReset().mockReturnValue(of({ revision: 8 }));
      component.autosave.auto = false;
      component.form.briefing = 'Correction';
      component.touch();
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();

      expect(updateOperation).not.toHaveBeenCalled();
      expect(component.autosave.status).toBe('dirty');
      expect(fixture.nativeElement.querySelector('.save-row button').disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the participant preview without raw ISO date or technical status', () => {
    component.tab = 'publication';
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('DRAFT');
    expect(text).toContain('Brouillon');
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('previews the sheet with the same components as the published page, with unsaved entries and without writing', () => {
    updateOperation.mockClear();
    component.form.briefing = 'Briefing en cours de saisie';
    component.form.meetingPoint = 'Levski';
    component.tab = 'publication';
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const preview: HTMLElement = fixture.nativeElement.querySelector('app-operation-preview');
    expect(preview.querySelector('app-operation-hero')!.textContent).toContain('Levski');
    expect(preview.querySelector('.panel--briefing')!.textContent).toContain('Briefing en cours de saisie');
    expect(preview.querySelector('app-operation-org-chart')).not.toBeNull();
    expect(preview.querySelector('app-operation-fleet-cards')).not.toBeNull();
    // Afficher l'aperçu n'enregistre rien et ne crée ni groupe ni affectation.
    expect(updateOperation).not.toHaveBeenCalled();
    expect(createOperationGroup).not.toHaveBeenCalled();
    expect(assignOperationMember).not.toHaveBeenCalled();
  });
});
