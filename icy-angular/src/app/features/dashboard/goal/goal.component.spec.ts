import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalComponent } from './goal.component';
import {coreTestProviders} from '@testing/test-providers';

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
});
