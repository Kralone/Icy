import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkBlockTextComponent } from './icelink-block-text.component';

describe('IcelinkBlockTextComponent', () => {
  let component: IcelinkBlockTextComponent;
  let fixture: ComponentFixture<IcelinkBlockTextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkBlockTextComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkBlockTextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
