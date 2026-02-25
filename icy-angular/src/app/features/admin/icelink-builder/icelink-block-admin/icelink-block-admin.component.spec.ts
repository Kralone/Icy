import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcelinkBlockAdminComponent } from './icelink-block-admin.component';

describe('IcelinkBlockAdminComponent', () => {
  let component: IcelinkBlockAdminComponent;
  let fixture: ComponentFixture<IcelinkBlockAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcelinkBlockAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcelinkBlockAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
