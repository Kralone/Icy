import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkPreviewComponent } from './icelink-preview.component';

describe('IceLinkPreviewComponent', () => {
  let component: IceLinkPreviewComponent;
  let fixture: ComponentFixture<IceLinkPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
