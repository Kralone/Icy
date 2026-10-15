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

  it('sorts by account and last connection dates, newest first, with missing dates last', () => {
    component.loadUsers();
    http.expectOne('/api/users/all').flush({ data: [
      { id: 'a', username: 'Alpha', discordId: '1', active: true, roles: ['JUNIOR'], createdAt: '2025-03-01T10:00:00', lastSeenAt: null },
      { id: 'b', username: 'bravo', discordId: '2', active: true, roles: ['ADMIN'], createdAt: '2026-01-15T10:00:00', lastSeenAt: '2026-10-14T21:05:00' },
      { id: 'c', username: 'Charlie', discordId: '3', active: true, roles: ['OFFICIER'], createdAt: null, lastSeenAt: '2026-10-01T08:00:00' }
    ] });
    fixture.detectChanges();
    const names = () => component.paginatedUsers.map(user => user.username);
    expect(names()).toEqual(['Alpha', 'bravo', 'Charlie']);

    component.sortBy('createdAt');
    expect(names()).toEqual(['bravo', 'Alpha', 'Charlie']);
    component.sortBy('createdAt');
    expect(names()).toEqual(['Alpha', 'bravo', 'Charlie']);

    component.sortBy('lastSeenAt');
    expect(names()).toEqual(['bravo', 'Charlie', 'Alpha']);
    component.sortBy('role');
    expect(names()).toEqual(['bravo', 'Charlie', 'Alpha']);

    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('Rôle');
    const alpha = Array.from(element.querySelectorAll('tbody tr')).find(row => row.textContent!.includes('Alpha'))!;
    expect(alpha.textContent).toContain('Jamais');
    const charlie = Array.from(element.querySelectorAll('tbody tr')).find(row => row.textContent!.includes('Charlie'))!;
    expect(charlie.textContent).toContain('Non renseignée');
  });
});
