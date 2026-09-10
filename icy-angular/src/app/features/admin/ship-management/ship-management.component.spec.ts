import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShipManagementComponent } from './ship-management.component';
import {coreTestProviders} from '@testing/test-providers';

describe('ShipManagementComponent', () => {
  let component: ShipManagementComponent;
  let fixture: ComponentFixture<ShipManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShipManagementComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShipManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('directs ship changes to synchronization while preserving brand management', () => {
    const page = fixture.nativeElement;
    expect(page.querySelector('a[href="/icy/admin/uex-cache"]')).toBeTruthy();
    expect(page.textContent).toContain('Catalogue synchronisé automatiquement');
    expect(page.textContent).not.toContain('Ajouter un vaisseau');
    expect(page.querySelector('input[placeholder="Nom du vaisseau"]')).toBeNull();
    expect(page.querySelector('input[placeholder="Nom de la marque"]')).toBeTruthy();
  });
});
