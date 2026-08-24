import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkBlockPanelComponent } from './icelink-block-panel.component';
import {coreTestProviders} from '@testing/test-providers';

describe('IceLinkBlockPanelComponent', () => {
  let component: IceLinkBlockPanelComponent;
  let fixture: ComponentFixture<IceLinkBlockPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkBlockPanelComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkBlockPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
