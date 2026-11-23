import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReminderCampaign } from '../../../core/services/member/member-activity';
import { CampaignHistoryComponent } from './campaign-history.component';

function campaign(id: number, title: string, partial: Partial<Omit<ReminderCampaign, 'counts'>> & { counts?: Partial<ReminderCampaign['counts']> }): ReminderCampaign {
  return {
    id, title, body: '', mediaFile: null, mediaUrl: null, delivery: 'MANUEL', status: 'EN_COURS', scheduledAt: null,
    sentAt: null, createdBy: 'Kralone', createdAt: '2026-10-01T20:00:00', reminders: null, ...partial,
    counts: { members: 0, contacted: 0, pending: 0, failed: 0, answered: 0, decisions: {}, cameBack: 0, states: {}, ...partial.counts }
  };
}

describe('CampaignHistoryComponent', () => {
  let fixture: ComponentFixture<CampaignHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CampaignHistoryComponent] }).compileComponents();
    fixture = TestBed.createComponent(CampaignHistoryComponent);
  });

  it('reviews sent campaigns newest first and keeps finished ones apart', () => {
    fixture.componentRef.setInput('campaigns', [
      campaign(1, 'Octobre', { sentAt: '2026-10-08T20:00:00', counts: { members: 2, contacted: 2, answered: 2, cameBack: 1, decisions: { REVIENT: 1, QUITTE: 1 }, states: { ACTIF: 1, PARTI: 1 } } }),
      campaign(2, 'Novembre', { sentAt: '2026-11-12T20:00:00', counts: { members: 4, contacted: 2, answered: 1, cameBack: 0, decisions: { PAUSE: 1 } } }),
      campaign(3, 'Décembre', { status: 'PROGRAMMEE', delivery: 'BOT', counts: { members: 3 } }),
      campaign(4, 'Annulée', { status: 'ANNULEE', counts: { members: 1 } })
    ]);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.sent.map(entry => entry.title)).toEqual(['Novembre', 'Octobre']);
    expect(component.totals).toEqual({ campaigns: 2, contacted: 4, answered: 3, cameBack: 1, left: 1 });
    expect(component.current.map(entry => entry.title)).toEqual(['Novembre', 'Décembre']);
    expect(component.archived.map(entry => entry.title)).toEqual(['Octobre', 'Annulée']);
    expect(component.decisionSegments(component.sent[0]).map(segment => [segment.key, segment.count])).toEqual([['PAUSE', 1], ['TODO', 3]]);

    const rows = fixture.nativeElement.querySelectorAll('button.review__row');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Parti 1');
  });
});
