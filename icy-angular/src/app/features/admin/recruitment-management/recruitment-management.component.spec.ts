import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecruitmentManagementComponent } from './recruitment-management.component';
import {coreTestProviders} from '@testing/test-providers';

describe('RecruitmentManagementComponent', () => {
  let component: RecruitmentManagementComponent;
  let fixture: ComponentFixture<RecruitmentManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecruitmentManagementComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecruitmentManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
