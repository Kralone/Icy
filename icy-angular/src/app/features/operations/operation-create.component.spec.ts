import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HotToastService } from '@ngxpert/hot-toast';
import { OperationCreateComponent } from './operation-create.component';
import { EventService } from '../../core/services/event/event.service';
import { EventType } from '../../model/event-type.model';

describe('OperationCreateComponent', () => {
  let component: OperationCreateComponent;
  let fixture: ComponentFixture<OperationCreateComponent>;
  let types$: Subject<EventType[]>;
  let createOperation: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const combat: EventType = { name: 'Combat', textColor: '#ffffff', backgroundColor: '#123456', imageUrl: '' };

  beforeAll(() => registerLocaleData(localeFr));

  beforeEach(async () => {
    types$ = new Subject<EventType[]>();
    createOperation = vi.fn(() => of({ eventId: 'op-1' }));
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [OperationCreateComponent],
      providers: [
        // Comme l'application : sans zone, la vue ne se rafraîchit que si le composant le demande.
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EventService, useValue: { getAllTypes: vi.fn(() => types$), createOperation } },
        { provide: HotToastService, useValue: toast },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    component.form = { ...component.form, title: ' Escorte ', type: 'Combat', startDateTime: '2026-10-20T20:00', endDateTime: '2026-10-20T23:00' };
  }

  it('unlocks the closed type list as soon as the server answers, without user input', async () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.disabled).toBe(true);
    expect(select.textContent).toContain('Chargement des types…');

    types$.next([combat]);
    await fixture.whenStable();

    expect(select.disabled).toBe(false);
    expect(Array.from(select.options).map(option => option.textContent?.trim())).toEqual(['Choisir un type', 'Combat']);
  });

  it('shows a retry when the types cannot be loaded', async () => {
    types$.error(new Error('network'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain('Impossible de charger les types d’opération.');
    expect(component.invalid).toBe(true);
  });

  it('rejects a type that is not in the server list', async () => {
    types$.next([combat]);
    await fixture.whenStable();
    fillValidForm();
    component.form.type = 'Texte libre';

    component.create();

    expect(component.invalid).toBe(true);
    expect(createOperation).not.toHaveBeenCalled();
  });

  it('opens the editor with a toast after a valid creation', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    types$.next([combat]);
    await fixture.whenStable();
    fillValidForm();

    component.create();

    expect(createOperation.mock.calls[0][0].title).toBe('Escorte');
    expect(toast.success).toHaveBeenCalledWith('Brouillon d’opération créé.');
    expect(navigate).toHaveBeenCalledWith(['/icy/operations', 'op-1', 'edit']);
  });

  it('explains an unreachable server instead of the browser technical message', async () => {
    createOperation.mockReturnValue(throwError(() => ({ status: 0, error: new TypeError('Failed to fetch') })));
    types$.next([combat]);
    await fixture.whenStable();
    fillValidForm();

    component.create();
    await fixture.whenStable();

    const alert: string = fixture.nativeElement.querySelector('p.error').textContent;
    expect(alert).toContain('Serveur injoignable');
    expect(alert).not.toContain('Failed to fetch');
    expect(component.saving).toBe(false);
  });

  it('keeps the server message of a rejected creation', async () => {
    createOperation.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Type d’opération inconnu : « X ». Choisissez un type dans la liste.' } })));
    types$.next([combat]);
    await fixture.whenStable();
    fillValidForm();

    component.create();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('p.error').textContent).toContain('Type d’opération inconnu');
  });
});
