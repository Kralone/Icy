import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkPreviewComponent } from './icelink-preview.component';

describe('IcelinkPreviewComponent', () => {
  let component: IcelinkPreviewComponent;
  let fixture: ComponentFixture<IcelinkPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
