import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkBuilderComponent } from './icelink-builder.component';

describe('IcelinkBuilderComponent', () => {
  let component: IcelinkBuilderComponent;
  let fixture: ComponentFixture<IcelinkBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
