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
    http.expectOne('/api/admin/discipline').flush({ threshold: 3, members: [], discordBansToDo: [] });
    fixture.detectChanges();
    http.expectOne('/api/availability/members').flush([]);
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

  it('requires a pole for a Specialist and sends it with the member', () => {
    component.isAddUserModalOpen = true;
    component.newUser = { username: 'Torin', discordId: '42', role: 'ASSOCIE', treasurer: false, specialty: '' };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="specialty-choice"]')).toBeNull();

    component.newUser.role = 'SPECIALISTE';
    fixture.detectChanges();
    const choices: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="specialty-choice"] label'));
    expect(choices.map(choice => choice.textContent?.replace('✓', '').trim())).toEqual(['Logistique', 'Militaire', 'Industrie']);
    expect(choices.every(choice => choice.querySelector('input[type="radio"]'))).toBe(true);
    expect(component.specialtyMissing).toBe(true);
    component.addUser();
    http.expectNone('/api/users/create');

    component.newUser.specialty = 'INDUSTRIE';
    component.addUser();
    const created = http.expectOne('/api/users/create');
    expect(created.request.body).toEqual({ username: 'Torin', discordId: '42', role: 'SPECIALISTE', specialty: 'INDUSTRIE' });
    created.flush({});
    http.expectOne('/api/users/all').flush({ data: [] });
  });

  it('drops the pole when the rank is no longer Specialist', () => {
    component.editUser({ id: 'a', username: 'Torin', discordId: '42', active: true, createdAt: null, roles: ['SPECIALISTE'], specialty: 'MILITAIRE' });
    expect(component.newUser.specialty).toBe('MILITAIRE');

    component.newUser.role = 'OFFICIER';
    component.updateUser();
    const updated = http.expectOne('/api/users/update');
    expect(updated.request.body.specialty).toBeNull();
    updated.flush({});
    http.expectOne('/api/users/all').flush({ data: [] });
  });

  it('shows the rank first, in its colour, with the pole and the treasurer function below', () => {
    component.loadUsers();
    http.expectOne('/api/users/all').flush({ data: [
      { id: 'a', username: 'Alpha', discordId: '1', active: true, roles: ['SPECIALISTE'], specialty: 'LOGISTIQUE', createdAt: null },
      { id: 'b', username: 'Bravo', discordId: '2', active: true, roles: ['OFFICIER'], specialty: null, createdAt: null },
      { id: 'c', username: 'Charlie', discordId: '3', active: true, roles: ['TRESORIER', 'ASSOCIE'], specialty: null, createdAt: null }
    ] });
    fixture.detectChanges();

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
    const ranks = rows.map(row => row.querySelector('[data-testid="member-rank"]') as HTMLElement);
    expect(ranks.map(rank => rank.textContent?.trim())).toEqual(['Spécialiste', 'Officier', 'Associé']);
    expect(ranks.map(rank => rank.getAttribute('data-rank'))).toEqual(['SPECIALISTE', 'OFFICIER', 'ASSOCIE']);
    expect(rows[0].querySelector('[data-testid="member-specialty"]')?.textContent).toContain('Logistique');
    expect(rows[1].querySelector('[data-testid="member-specialty"], [data-testid="member-function"]')).toBeNull();
    expect(rows[2].querySelector('[data-testid="member-function"]')?.textContent).toContain('Trésorier');
  });

  it('shows active warnings per member, flags a pending decision and opens the record', () => {
    component.loadUsers();
    http.expectOne('/api/users/all').flush({ data: [
      { id: 'a', username: 'Alpha', discordId: '1', active: true, roles: ['JUNIOR'], createdAt: null },
      { id: 'b', username: 'Bravo', discordId: '2', active: true, roles: ['ASSOCIE'], createdAt: null },
      { id: 'c', username: 'Charlie', discordId: '3', active: true, roles: ['JUNIOR'], createdAt: null }
    ] });
    component.loadDiscipline();
    http.expectOne('/api/admin/discipline').flush({
      threshold: 3,
      members: [
        { userId: 'b', activeWarnings: 1, lastWarningAt: '2026-11-20T10:00:00', pendingDecision: false },
        { userId: 'c', activeWarnings: 3, lastWarningAt: '2026-11-22T10:00:00', pendingDecision: true }
      ],
      discordBansToDo: [{ sanctionId: 9, userId: 'z', username: 'Zulu', discordId: '99', decidedByName: 'Kralone', decidedAt: '2026-11-21T10:00:00' }]
    });
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const cells = Array.from(element.querySelectorAll<HTMLButtonElement>('[data-testid="discipline-cell"]'));
    expect(cells.map(cell => cell.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Avertir', '1 / 3', 'À décider']);
    expect(cells[2].querySelectorAll('.discipline-pip.is-on').length).toBe(3);

    const alerts = element.querySelector('[data-testid="discipline-alerts"]')!.textContent!.replace(/\s+/g, ' ');
    expect(alerts).toContain('Charlie · exclusion à décider');
    expect(alerts).toContain('Zulu · exclu, bannissement Discord à effectuer');

    cells[1].click();
    expect(component.disciplineUserId).toBe('b');
    fixture.detectChanges();
    http.expectOne('/api/admin/discipline/members/b').flush({
      userId: 'b', username: 'Bravo', discordId: '2', active: true, threshold: 3, activeWarnings: 1, pendingDecision: false,
      canWarn: true, canDecide: false, warnings: [], sanctions: []
    });
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="discipline-drawer"]')?.textContent).toContain('Bravo');
  });

  it('keeps the members list usable when warnings cannot be loaded', () => {
    component.loadUsers();
    http.expectOne('/api/users/all').flush({ data: [{ id: 'a', username: 'Alpha', discordId: '1', active: true, roles: ['JUNIOR'], createdAt: null }] });
    component.loadDiscipline();
    http.expectOne('/api/admin/discipline').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="discipline-cell"]')?.textContent?.trim()).toBe('—');
  });
});
