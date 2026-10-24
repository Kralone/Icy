import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TutorialOverlayComponent } from './tutorial-overlay.component';
import { TutorialService } from './tutorial.service';
import { TutorialDefinition } from './tutorial.model';

const demo: TutorialDefinition = {
  id: 'demo',
  version: 1,
  title: 'Démo',
  matches: () => false,
  steps: [
    { title: 'Bienvenue', text: 'Présentation de la page.' },
    { target: '#cible', title: 'Bouton', text: 'Ce bouton ajoute un vaisseau.' }
  ]
};

describe('TutorialOverlayComponent', () => {
  let fixture: ComponentFixture<TutorialOverlayComponent>;
  let service: TutorialService;
  let target: HTMLElement;

  beforeEach(async () => {
    target = document.createElement('button');
    target.id = 'cible';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 200, width: 120, height: 40, right: 320, bottom: 140, x: 200, y: 100, toJSON: () => ({}) } as DOMRect);
    await TestBed.configureTestingModule({
      imports: [TutorialOverlayComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { url: '/', events: new Subject() } }]
    }).compileComponents();
    service = TestBed.inject(TutorialService);
    fixture = TestBed.createComponent(TutorialOverlayComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    target.remove();
    vi.restoreAllMocks();
  });

  const bubble = () => fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement | null;

  it('renders nothing until a tutorial runs', () => {
    expect(fixture.nativeElement.querySelector('.tuto')).toBeNull();
  });

  it('shows each step with its counter and moves on with the buttons', async () => {
    service.play(demo);
    fixture.detectChanges();
    expect(bubble()?.textContent).toContain('1 / 2');
    expect(bubble()?.textContent).toContain('Bienvenue');
    expect(fixture.nativeElement.querySelector('.tuto__veil')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tuto__prev')).toBeNull();

    (fixture.nativeElement.querySelector('.tuto__next') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    fixture.detectChanges();
    expect(bubble()?.textContent).toContain('2 / 2');
    expect(bubble()?.textContent).toContain('Terminer');
    expect(target.scrollIntoView).toHaveBeenCalled();
    const spot = fixture.nativeElement.querySelector('.tuto__spot') as HTMLElement;
    expect(spot.style.top).toBe('92px');
    expect(spot.style.width).toBe('136px');

    (fixture.nativeElement.querySelector('.tuto__next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.active()).toBeNull();
    expect(fixture.nativeElement.querySelector('.tuto')).toBeNull();
  });

  it('closes with Escape and goes back with the left arrow', () => {
    service.play(demo);
    service.next();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(service.active()?.index).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(service.active()).toBeNull();
  });
});
