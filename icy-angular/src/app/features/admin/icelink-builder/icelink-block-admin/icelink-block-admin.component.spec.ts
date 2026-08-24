import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkBlockAdminComponent } from './icelink-block-admin.component';
import {coreTestProviders} from '@testing/test-providers';

describe('IceLinkBlockAdminComponent', () => {
  let component: IceLinkBlockAdminComponent;
  let fixture: ComponentFixture<IceLinkBlockAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkBlockAdminComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkBlockAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
