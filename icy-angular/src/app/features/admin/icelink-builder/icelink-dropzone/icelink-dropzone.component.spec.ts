import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkDropzoneComponent } from './icelink-dropzone.component';

describe('IcelinkDropzoneComponent', () => {
  let component: IcelinkDropzoneComponent;
  let fixture: ComponentFixture<IcelinkDropzoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkDropzoneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkDropzoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
