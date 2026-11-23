import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';

import { DECISIONS, ReminderCampaign, ReminderDecision, TODAY_LABELS, TodayState, decisionLabel } from '../../../core/services/member/member-activity';

interface Segment { key: string; label: string; count: number; }

/** Part d'un total, en pourcentage arrondi. */
export function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

/** Une campagne est terminée quand chaque fiche a une décision. */
export function campaignDone(campaign: ReminderCampaign): boolean {
  const decided = Object.values(campaign.counts.decisions ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
  return campaign.status === 'EN_COURS' && campaign.counts.members > 0 && decided >= campaign.counts.members;
}

/** Partie : au moins un membre a été prévenu. */
export function campaignSent(campaign: ReminderCampaign): boolean {
  return campaign.status === 'EN_COURS' && campaign.counts.contacted > 0;
}

const TODAY_ORDER: TodayState[] = ['ACTIF', 'A_SURVEILLER', 'EN_PAUSE', 'INACTIF', 'PARTI'];

/**
 * Historique des campagnes de rappel : le bilan de chacune (réponses, décisions, qui est revenu depuis, où en sont
 * les membres aujourd'hui), puis les campagnes en cours et les anciennes.
 */
@Component({
  selector: 'app-campaign-history',
  templateUrl: './campaign-history.component.html',
  styleUrl: './campaign-history.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, NgTemplateOutlet]
})
export class CampaignHistoryComponent {
  readonly campaigns = input.required<ReminderCampaign[]>();
  readonly open = output<number>();
  readonly showInactive = output<void>();

  readonly percent = percent;
  readonly done = campaignDone;
  readonly todayLabels = TODAY_LABELS;

  /** Campagnes parties, de la plus récente à la plus ancienne. */
  get sent(): ReminderCampaign[] {
    return this.campaigns().filter(campaignSent)
      .sort((left, right) => this.dateOf(right).localeCompare(this.dateOf(left)));
  }

  get current(): ReminderCampaign[] {
    return this.campaigns().filter(campaign => campaign.status !== 'ANNULEE' && !campaignDone(campaign));
  }

  get archived(): ReminderCampaign[] {
    return this.campaigns().filter(campaign => campaign.status === 'ANNULEE' || campaignDone(campaign));
  }

  dateOf(campaign: ReminderCampaign): string {
    return campaign.sentAt ?? campaign.createdAt;
  }

  /** Totaux sur toutes les campagnes parties. Un membre rappelé deux fois compte deux fois. */
  get totals(): { campaigns: number; contacted: number; answered: number; cameBack: number; left: number } {
    const sent = this.sent;
    const sum = (pick: (campaign: ReminderCampaign) => number) => sent.reduce((total, campaign) => total + pick(campaign), 0);
    return {
      campaigns: sent.length,
      contacted: sum(campaign => campaign.counts.contacted),
      answered: sum(campaign => campaign.counts.answered),
      cameBack: sum(campaign => campaign.counts.cameBack ?? 0),
      left: sum(campaign => (campaign.counts.decisions?.QUITTE ?? 0))
    };
  }

  /** Décisions notées, puis les fiches encore sans décision. */
  decisionSegments(campaign: ReminderCampaign): Segment[] {
    const segments: Segment[] = DECISIONS.map(decision => ({
      key: decision.key, label: decision.label, count: campaign.counts.decisions?.[decision.key as ReminderDecision] ?? 0
    }));
    const decided = segments.reduce((total, segment) => total + segment.count, 0);
    segments.push({ key: 'TODO', label: 'Pas encore de décision', count: Math.max(0, campaign.counts.members - decided) });
    return segments.filter(segment => segment.count > 0);
  }

  /** Où en sont aujourd'hui les membres de la campagne. */
  todaySegments(campaign: ReminderCampaign): Segment[] {
    return TODAY_ORDER.map(state => ({ key: state, label: TODAY_LABELS[state], count: campaign.counts.states?.[state] ?? 0 }))
      .filter(segment => segment.count > 0);
  }

  segmentTitle(segments: Segment[]): string {
    return segments.map(segment => `${segment.label} : ${segment.count}`).join(' · ');
  }

  statusLabel(campaign: ReminderCampaign): string {
    switch (campaign.status) {
      case 'BROUILLON': return 'Brouillon';
      case 'PROGRAMMEE': return 'Programmée';
      case 'ANNULEE': return 'Annulée';
      default: return campaignDone(campaign) ? 'Terminée' : 'En cours';
    }
  }

  decisionEntries(campaign: ReminderCampaign): { key: string; label: string; count: number }[] {
    return Object.entries(campaign.counts.decisions ?? {})
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([key, count]) => ({ key, label: decisionLabel(key as ReminderDecision), count: count ?? 0 }));
  }
}
