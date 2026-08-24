import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkBuilderComponent } from './icelink-builder.component';
import {coreTestProviders} from '@testing/test-providers';

describe('IceLinkBuilderComponent', () => {
  let component: IceLinkBuilderComponent;
  let fixture: ComponentFixture<IceLinkBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkBuilderComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
