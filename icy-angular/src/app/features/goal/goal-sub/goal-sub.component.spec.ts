import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalSubComponent } from './goal-sub.component';

describe('GoalSubComponent', () => {
  let component: GoalSubComponent;
  let fixture: ComponentFixture<GoalSubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalSubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalSubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
