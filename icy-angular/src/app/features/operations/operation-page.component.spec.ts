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
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [OperationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'op' })) } },
        { provide: EventService, useValue: { getParticipations, setParticipationStatus, getMyHangar: vi.fn(() => of({ data: [] })) } },
        { provide: AuthService, useValue: { getUserIdFromToken: vi.fn(() => 'me') } },
        { provide: HotToastService, useValue: toast },
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('reads counters, lists and the active button back from the server after each answer', async () => {
    await render();
    expect(fixture.nativeElement.querySelector('.operation-counts').textContent).toContain('0 confirmé(s) · 1 peut-être · 0 indisponible(s)');
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]')).toBeNull();

    getParticipations.mockReturnValue(of({ data: [other, me] }));
    buttons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setParticipationStatus).toHaveBeenCalledWith('op', 1);
    expect(getParticipations).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.operation-counts').textContent).toContain('1 confirmé(s) · 1 peut-être · 0 indisponible(s)');
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

  it('locks the answers of a finished operation', async () => {
    await render(true);

    expect(buttons().every(button => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Opération terminée.');
  });
});
