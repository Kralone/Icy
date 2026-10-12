import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OperationEditorComponent } from './operation-editor.component';
import { EventService } from '../../core/services/event/event.service';
import { CatalogService } from '../../core/services/catalog/catalog.service';
import { UserService } from '../../core/services/user/user.service';
import { HotToastService } from '@ngxpert/hot-toast';

describe('OperationEditorComponent', () => {
  let component: OperationEditorComponent;
  let fixture: ComponentFixture<OperationEditorComponent>;
  let updateOperation: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
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
          getOperationGroupsForEdit: vi.fn(() => of({ data: [] })),
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
    expect(fixture.nativeElement.querySelector('.save-indicator__state').textContent).toContain('Non enregistré');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Serveur injoignable');
    expect(component.form.briefing).toBe('À conserver');
    expect(component.canLeave).toBeDefined();

    fixture.nativeElement.querySelector('.save-indicator__detail button').click();
    fixture.detectChanges();

    expect(updateOperation).toHaveBeenCalledTimes(2);
    expect(component.saveError).toBe(false);
    expect(fixture.nativeElement.querySelector('.save-indicator__state').textContent).toContain('Enregistré');
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
      expect(fixture.nativeElement.querySelector('.save-indicator__state').textContent).toContain('Modifications en cours');
      expect(updateOperation).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1500);
      fixture.detectChanges();

      expect(updateOperation).toHaveBeenCalledTimes(1);
      expect(updateOperation.mock.calls[0][1]).toMatchObject({ briefing: 'Première frappe', expectedRevision: 7 });
      expect(fixture.nativeElement.querySelector('.save-indicator__state').textContent).toContain('Enregistré');
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
      expect(fixture.nativeElement.querySelector('.save-indicator__state').textContent).toContain('Modifications non enregistrées');
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
});
