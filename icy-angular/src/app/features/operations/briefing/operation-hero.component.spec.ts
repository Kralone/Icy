import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OperationHeroComponent } from './operation-hero.component';
import { OperationSheet } from './operation-sheet.model';

const base: OperationSheet = { id: 'op', title: 'Escorte Nyx', allowShipProposals: false, startDateTime: '2026-11-20T20:30:00', endDateTime: '2026-11-20T23:30:00', finished: false, typeName: 'Escorte', typeBackgroundColor: '#b45309', typeTextColor: '#fef3c7' };

describe('OperationHeroComponent', () => {
  let fixture: ComponentFixture<OperationHeroComponent>;
  const show = (operation: Partial<OperationSheet>): void => { fixture.componentRef.setInput('operation', { ...base, ...operation }); fixture.detectChanges(); };
  const status = (): string => fixture.nativeElement.querySelector('.hero__status').textContent.trim();
  const image = (): HTMLImageElement | null => fixture.nativeElement.querySelector('.hero__image');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OperationHeroComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(OperationHeroComponent);
  });

  it('takes its status from the server, never from the browser clock', () => {
    show({});
    expect(status()).toBe('À venir');
    show({ started: true });
    expect(status()).toBe('En cours');
    show({ started: true, locked: true });
    expect(status()).toBe('Terminée');
    show({ finished: true });
    expect(status()).toBe('Terminée');
  });

  it('falls back from the mission image to the type image, then to a plain colour, per operation', () => {
    show({ imageUrl: 'https://img.example/mission.jpg', typeImageUrl: '/assets/images/type.jpg' });
    expect(image()!.getAttribute('src')).toBe('https://img.example/mission.jpg');
    image()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(image()!.getAttribute('src')).toBe('/assets/images/type.jpg');
    image()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(image()).toBeNull();

    // Une autre opération garde sa propre image : l'échec précédent ne la concerne pas.
    show({ id: 'other', imageUrl: 'https://img.example/autre.jpg' });
    expect(image()!.getAttribute('src')).toBe('https://img.example/autre.jpg');
    show({ id: 'unsafe', imageUrl: 'javascript:alert(1)' });
    expect(image()).toBeNull();
  });

  it('uses the type colours only as a valid pair', () => {
    show({});
    expect(fixture.nativeElement.querySelector('.hero').style.getPropertyValue('--type-accent')).toBe('#b45309');
    show({ typeTextColor: 'white' });
    expect(fixture.nativeElement.querySelector('.hero').style.getPropertyValue('--type-accent')).toBe('#27647c');
    expect(fixture.nativeElement.querySelector('.hero').style.getPropertyValue('--type-label')).toBe('#e3f4fb');
  });
});
