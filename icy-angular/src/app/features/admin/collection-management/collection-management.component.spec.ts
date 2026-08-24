import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionManagementComponent } from './collection-management.component';
import {coreTestProviders} from '@testing/test-providers';

describe('CollectionManagementComponent', () => {
  let component: CollectionManagementComponent;
  let fixture: ComponentFixture<CollectionManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionManagementComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollectionManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
