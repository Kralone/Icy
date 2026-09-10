import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalSubComponent } from './goal-sub.component';
import {HttpTestingController} from '@angular/common/http/testing';
import {coreTestProviders} from '@testing/test-providers';

describe('GoalSubComponent', () => {
  let component: GoalSubComponent;
  let fixture: ComponentFixture<GoalSubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalSubComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalSubComponent);
    component = fixture.componentInstance;
    component.goal = {
      id: 1,
      name: 'Objectif de test',
      description: '',
      target: 1,
      current: 0,
      pinned: false,
      completed: false,
      createdAt: new Date(0).toISOString(),
      parentId: null,
      subGoals: [],
    };
    component.disableAnimation = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves progress and displays an error when a contribution fails', () => {
    component.goal.target = 10;
    component.goal.current = 2;
    component.increment(1, 1);
    TestBed.inject(HttpTestingController).expectOne('/api/goals/1/increment?delta=1').flush({}, {status: 503, statusText: 'Unavailable'});
    fixture.detectChanges();
    expect(component.goal.current).toBe(2);
    expect(component.loading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('La contribution n’a pas été enregistrée');
  });

  it('locks contributions under a completed parent for non-admin members', () => {
    component.parentCompleted = true;
    component.increment(1, 1);
    TestBed.inject(HttpTestingController).expectNone('/api/goals/1/increment?delta=1');
    expect(component.goal.current).toBe(0);
  });

  it('does not present a filtered parent as a leaf and keeps full totals', () => {
    component.goal.__allSubGoals = [{...component.goal, id: 2, parentId: 1, current: 2, target: 5}];
    expect(component.isLeaf(component.goal)).toBe(false);
    expect(component.getTotalProgress(component.goal)).toEqual({current: 2, target: 5});
  });

  it('exposes retry for contributions without claiming the list is empty', () => {
    component.toggleParticipations();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/goals/1/participations?limit=6').flush({}, {status: 503, statusText: 'Unavailable'});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Réessayer');
    expect(fixture.nativeElement.textContent).not.toContain('Aucune participation.');
    component.loadParticipations();
    http.expectOne('/api/goals/1/participations?limit=6').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucune participation.');
  });

  it('removes collapsed children from keyboard navigation', () => {
    component.goal.subGoals = [{...component.goal, id: 2, parentId: 1, subGoals: []}];
    component.showChildren = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-goal-sub')).not.toBeNull();
    component.toggleChildrenVisibility();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-goal-sub')).toBeNull();
  });
});
