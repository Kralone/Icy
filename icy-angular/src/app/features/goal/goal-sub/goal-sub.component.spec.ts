import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalSubComponent } from './goal-sub.component';
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
});
