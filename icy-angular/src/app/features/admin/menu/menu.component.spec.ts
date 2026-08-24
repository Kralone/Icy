import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMenuComponent } from './menu.component';
import {coreTestProviders} from '@testing/test-providers';

describe('AdminMenuComponent', () => {
  let component: AdminMenuComponent;
  let fixture: ComponentFixture<AdminMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMenuComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
