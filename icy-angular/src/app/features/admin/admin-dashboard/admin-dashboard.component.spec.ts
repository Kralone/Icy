import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AdminDashboardComponent } from './admin-dashboard.component';
import {coreTestProviders} from '@testing/test-providers';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/users/all').flush({ data: [] });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('stops loading and displays a retry action when members fail to load', () => {
    component.loadUsers();
    expect(component.isLoading).toBe(true);

    http.expectOne('/api/users/all').flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(component.loadError).toBe('Impossible de charger les membres pour le moment.');
    expect(fixture.nativeElement.querySelector('[data-testid="members-load-error"] button')?.textContent)
      .toContain('Réessayer');
  });

  it('retries the current members view from the error state', () => {
    component.setInactiveView(true);
    http.expectOne('/api/users/inactive').flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    const retryButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="members-load-error"] button'
    );
    retryButton.click();

    const retry = http.expectOne('/api/users/inactive');
    expect(component.isLoading).toBe(true);
    expect(component.loadError).toBeNull();
    retry.flush({ data: [] });

    expect(component.isLoading).toBe(false);
  });
});
