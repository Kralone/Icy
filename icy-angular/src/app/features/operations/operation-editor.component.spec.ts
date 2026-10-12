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
    const operation = { id: 'op', title: 'QA', briefing: '', objectives: '[]', meetingPoint: '', imageUrl: '', allowShipProposals: false, publicationStatus: 'DRAFT', startDateTime: '2026-10-20T20:30:00' };
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
    component.save('op');
    fixture.detectChanges();

    expect(component.saveError).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Réessayer');
    expect(component.form.briefing).toBe('À conserver');

    fixture.nativeElement.querySelector('[role="alert"] button').click();
    fixture.detectChanges();

    expect(updateOperation).toHaveBeenCalledTimes(2);
    expect(component.saveError).toBe(false);
    expect(component.message).toBe('Opération enregistrée.');
    expect(updateOperation.mock.calls[0][1].briefing).toBe('À conserver');
    expect(updateOperation.mock.calls[1][1].briefing).toBe('À conserver');
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
