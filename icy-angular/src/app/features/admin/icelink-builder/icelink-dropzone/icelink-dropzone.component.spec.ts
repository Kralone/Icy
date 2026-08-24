import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkDropzoneComponent } from './icelink-dropzone.component';
import {coreTestProviders} from '@testing/test-providers';

describe('IceLinkDropzoneComponent', () => {
  let component: IceLinkDropzoneComponent;
  let fixture: ComponentFixture<IceLinkDropzoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkDropzoneComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkDropzoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
