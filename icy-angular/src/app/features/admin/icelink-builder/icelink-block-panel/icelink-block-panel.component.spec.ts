import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkBlockPanelComponent } from './icelink-block-panel.component';

describe('IcelinkBlockPanelComponent', () => {
  let component: IcelinkBlockPanelComponent;
  let fixture: ComponentFixture<IcelinkBlockPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkBlockPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkBlockPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
