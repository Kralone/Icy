import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { coreTestProviders } from '@testing/test-providers';
import { MemberDisciplineDrawerComponent } from './member-discipline-drawer.component';
import { DisciplineRecord, MemberWarning } from '../../../model/discipline.model';
import { consequence } from './discipline-messages';

function warning(overrides: Partial<MemberWarning> = {}): MemberWarning {
  return {
    id: 1, category: 'COMPORTEMENT', reason: 'Insultes en vocal', rank: 1, issuedByName: 'Vexa',
    createdAt: '2026-11-20T21:00:00', active: true, revokedAt: null, revokedByName: null, revokeReason: null,
    dmStatus: 'SENT', dmFailure: null, ...overrides
  };
}

function record(overrides: Partial<DisciplineRecord> = {}): DisciplineRecord {
  return {
    userId: 'u1', username: 'Torin', discordId: '42', active: true, threshold: 3, activeWarnings: 0,
    pendingDecision: false, canWarn: true, canDecide: false, warnings: [], sanctions: [], ...overrides
  };
}

describe('MemberDisciplineDrawerComponent', () => {
  let fixture: ComponentFixture<MemberDisciplineDrawerComponent>;
  let component: MemberDisciplineDrawerComponent;
  let http: HttpTestingController;
  let element: HTMLElement;

  function open(data: DisciplineRecord): void {
    fixture.componentRef.setInput('userId', data.userId);
    fixture.detectChanges();
    http.expectOne(`/api/admin/discipline/members/${data.userId}`).flush(data);
    fixture.detectChanges();
  }

  const text = (selector: string) => (element.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MemberDisciplineDrawerComponent], providers: coreTestProviders }).compileComponents();
    fixture = TestBed.createComponent(MemberDisciplineDrawerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('previews the bot message and sends the warning with its category and reason', () => {
    open(record({ activeWarnings: 1, warnings: [warning()] }));
    const changed = vi.fn();
    component.changed.subscribe(changed);

    expect(text('[data-testid="discipline-form"] h3')).toBe('2e avertissement');
    const submit = element.querySelector<HTMLButtonElement>('[data-testid="submit-warning"]')!;
    expect(submit.disabled).toBe(true);

    component.category.set('ABSENCE');
    component.reason.set('  Absent à l\'opération de samedi  ');
    fixture.detectChanges();
    expect(text('.dz-embed')).toContain('⚠️ 2e avertissement');
    expect(text('.dz-embed')).toContain('Motif : Absence sans prévenir');
    expect(text('.dz-embed')).toContain(consequence(2, 3));
    expect(element.querySelector('.dz-preview')?.getAttribute('data-tone')).toBe('orange');
    expect(submit.disabled).toBe(false);

    submit.click();
    const request = http.expectOne('/api/admin/discipline/members/u1/warnings');
    expect(request.request.body).toEqual({ category: 'ABSENCE', reason: 'Absent à l\'opération de samedi' });
    request.flush(record({ activeWarnings: 2, warnings: [warning({ id: 2, rank: 2, category: 'ABSENCE', dmStatus: 'PENDING' }), warning()] }));
    fixture.detectChanges();

    expect(changed).toHaveBeenCalled();
    expect(component.reason()).toBe('');
    expect(text('[role="status"]')).toContain('2e avertissement donné');
    expect(element.querySelectorAll('[data-testid="warning-entry"]').length).toBe(2);
    expect(text('[data-testid="discipline-state"]')).toBe('2 avertissements en cours sur 3');
  });

  it('shows a refused message with its reason and lets the officer resend it', () => {
    open(record({ activeWarnings: 1, warnings: [warning({ dmStatus: 'FAILED', dmFailure: 'dm_closed' })] }));
    expect(text('[data-testid="dm-failed"]')).toBe('Message non reçu : messages privés fermés');

    const resend = Array.from(element.querySelectorAll<HTMLButtonElement>('.dz-link')).find(b => b.textContent?.includes('Renvoyer'))!;
    resend.click();
    http.expectOne('/api/admin/discipline/warnings/1/resend').flush(record({ activeWarnings: 1, warnings: [warning({ dmStatus: 'PENDING' })] }));
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="dm-failed"]')).toBeNull();
  });

  it('revokes a warning with a reason and an optional notice', () => {
    open(record({ activeWarnings: 1, warnings: [warning()] }));
    element.querySelector<HTMLButtonElement>('[data-testid="revoke-warning"]')!.click();
    fixture.detectChanges();
    component.revokeReason = 'Erreur de personne';
    component.revokeNotify = false;
    element.querySelector<HTMLButtonElement>('[data-testid="confirm-revoke"]')!.click();

    const request = http.expectOne('/api/admin/discipline/warnings/1/revoke');
    expect(request.request.body).toEqual({ reason: 'Erreur de personne', notifyMember: false });
    request.flush(record({ warnings: [warning({ active: false, revokedAt: '2026-11-23T10:00:00', revokedByName: 'Vexa', revokeReason: 'Erreur de personne' })] }));
    fixture.detectChanges();
    expect(element.querySelector('.dz-entry.is-revoked')?.textContent).toContain('Levé le');
  });

  it('asks an officer to wait for a director at the threshold', () => {
    open(record({ activeWarnings: 3, pendingDecision: true, warnings: [warning({ rank: 3 })] }));
    expect(text('[data-testid="discipline-decision"]')).toContain('Un Directeur doit choisir');
    expect(element.querySelector('[data-testid="exclude-member"]')).toBeNull();
  });

  it('makes a director confirm an exclusion, then shows the manual Discord ban to do', () => {
    open(record({ activeWarnings: 3, pendingDecision: true, canDecide: true, warnings: [warning({ rank: 3 })] }));

    element.querySelector<HTMLButtonElement>('[data-testid="exclude-member"]')!.click();
    fixture.detectChanges();
    http.expectNone('/api/admin/discipline/members/u1/decision');
    expect(text('.dz-confirm')).toContain('Confirmer l\'exclusion de Torin');

    component.decisionNote = 'Récidive';
    element.querySelector<HTMLButtonElement>('[data-testid="confirm-exclusion"]')!.click();
    const decision = http.expectOne('/api/admin/discipline/members/u1/decision');
    expect(decision.request.body).toEqual({ decision: 'EXCLUDE', note: 'Récidive', notifyMember: true });
    decision.flush(record({
      active: false, activeWarnings: 3, canWarn: false, canDecide: true, warnings: [warning({ rank: 3 })],
      sanctions: [{ id: 7, decision: 'EXCLUDE', note: 'Récidive', decidedByName: 'Kralone', createdAt: '2026-11-23T11:00:00',
        discordBanDoneAt: null, discordBanDoneBy: null, dmStatus: 'PENDING', dmFailure: null }]
    }));
    fixture.detectChanges();

    expect(text('[data-testid="discipline-state"]')).toBe('Exclu · ban Discord à faire');
    expect(text('[data-testid="discipline-ban-todo"]')).toContain('42');
    element.querySelector<HTMLButtonElement>('[data-testid="confirm-ban"]')!.click();
    http.expectOne('/api/admin/discipline/sanctions/7/discord-ban').flush(record({ active: false, canWarn: false, canDecide: true }));
  });

  it('shows the server refusal', () => {
    open(record());
    component.category.set('AUTRE');
    component.reason.set('Motif');
    component.warn();
    http.expectOne('/api/admin/discipline/members/u1/warnings').flush(
      { message: 'Un Officier ne peut pas avertir un Officier ou un Directeur.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text('[role="alert"]')).toBe('Un Officier ne peut pas avertir un Officier ou un Directeur.');
  });
});
