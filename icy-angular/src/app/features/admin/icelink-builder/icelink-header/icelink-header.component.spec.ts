import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkHeaderComponent } from './icelink-header.component';

describe('IcelinkHeaderComponent', () => {
  let component: IcelinkHeaderComponent;
  let fixture: ComponentFixture<IcelinkHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
