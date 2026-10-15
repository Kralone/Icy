import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalComponent } from './goal.component';
import {coreTestProviders} from '@testing/test-providers';
import { HttpTestingController } from '@angular/common/http/testing';

describe('GoalComponent', () => {
  let component: GoalComponent;
  let fixture: ComponentFixture<GoalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a compact pinned goal and reveals its details on demand', () => {
    const http = TestBed.inject(HttpTestingController);
    http.match(() => true).forEach(request => request.flush({
      id: 7, name: 'Stocker 10 000 SCU', description: 'Remplir le hangar de Lorville.', createdAt: '2026-09-01T10:00:00', completed: false,
      subGoals: [
        { id: 8, name: 'Quantanium', current: 500, target: 500, subGoals: [] },
        { id: 9, name: 'Laranite', current: 100, target: 400, subGoals: [] }
      ]
    }));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Stocker 10 000 SCU');
    expect(element.textContent).toContain('1 étape terminée sur 2');
    expect(element.textContent).not.toContain('Remplir le hangar');
    expect(element.textContent).not.toContain('Laranite');

    const toggle = element.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('Remplir le hangar');
    expect(element.textContent).toContain('Laranite');
  });
});
