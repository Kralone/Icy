import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { coreTestProviders } from '@testing/test-providers';
import { AvailabilityEditorComponent } from './availability-editor.component';

describe('AvailabilityEditorComponent', () => {
  let fixture: ComponentFixture<AvailabilityEditorComponent>;
  let component: AvailabilityEditorComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AvailabilityEditorComponent], providers: coreTestProviders }).compileComponents();
    fixture = TestBed.createComponent(AvailabilityEditorComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/availability/me').flush({ slots: [{ day: 6, period: 'EVENING' }] });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const cell = (slot: string): HTMLButtonElement => fixture.nativeElement.querySelector(`[data-slot="${slot}"]`);

  it('coche les créneaux déjà enregistrés', () => {
    expect(cell('6-EVENING').getAttribute('aria-pressed')).toBe('true');
    expect(cell('5-EVENING').getAttribute('aria-pressed')).toBe('false');
    expect(component.dirty()).toBe(false);
  });

  it('bascule un jour entier puis enregistre la grille dans l’ordre de la semaine', () => {
    component.toggleDay(1);
    component.togglePeriod('EVENING');
    fixture.detectChanges();
    expect(component.count()).toBe(10);
    expect(component.dirty()).toBe(true);

    component.save();
    const request = http.expectOne('/api/availability/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.slots.slice(0, 5)).toEqual([
      { day: 1, period: 'MORNING' }, { day: 1, period: 'AFTERNOON' }, { day: 1, period: 'EVENING' }, { day: 1, period: 'NIGHT' },
      { day: 2, period: 'EVENING' }
    ]);
    request.flush({ slots: request.request.body.slots });
    expect(component.dirty()).toBe(false);
  });

  it('annule les modifications non enregistrées', () => {
    component.clear();
    expect(component.count()).toBe(0);
    component.reset();
    expect(component.count()).toBe(1);
  });

  it('bascule une case au clavier', () => {
    cell('3-MORNING').dispatchEvent(new MouseEvent('click', { detail: 0 }));
    fixture.detectChanges();
    expect(cell('3-MORNING').getAttribute('aria-pressed')).toBe('true');
  });
});
