import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IceLinkHeaderComponent } from './icelink-header.component';

describe('IceLinkHeaderComponent', () => {
  let component: IceLinkHeaderComponent;
  let fixture: ComponentFixture<IceLinkHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IceLinkHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IceLinkHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
