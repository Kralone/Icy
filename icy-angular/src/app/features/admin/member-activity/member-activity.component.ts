import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { MemberActivityService } from '../../../core/services/member/member-activity.service';
import {
  ActivityMember, ActivitySettings, ActivityState, MessageTemplate, ReminderCampaign, STATE_LABELS, decisionLabel, deliveryReasonLabel
} from '../../../core/services/member/member-activity';
import { memberRank, specialtyLabel } from '../../../core/services/user/member-rank';
import { UserService } from '../../../core/services/user/user.service';
import { CampaignComposerComponent } from './campaign-composer.component';
import { CampaignDetailComponent } from './campaign-detail.component';
import { CampaignHistoryComponent } from './campaign-history.component';
import { MemberDrawerComponent } from './member-drawer.component';
import { MessageTemplatesComponent } from './message-templates.component';

export type ActivityTab = 'membres' | 'campagnes' | 'messages';
export type StateFilter = 'TOUS' | ActivityState;

const RANK_LABELS: Record<string, string> = {
  ADMIN: 'Directeur', OFFICIER: 'Officier', SPECIALISTE: 'Spécialiste', INGENIEUR: 'Ingénieur', ASSOCIE: 'Associé', JUNIOR: 'Junior'
};

/**
 * Activité des membres et rappels aux inactifs : qui est actif, qui décroche, qui a été prévenu et ce qu'il a répondu.
 * Les rappels se préparent en campagne : l'officier les envoie lui-même ou les confie au bot, tout de suite ou à une heure donnée.
 */
@Component({
  selector: 'app-member-activity',
  templateUrl: './member-activity.component.html',
  styleUrl: './member-activity.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, FormsModule, RouterLink, CampaignComposerComponent, CampaignDetailComponent, CampaignHistoryComponent, MemberDrawerComponent, MessageTemplatesComponent]
})
export class MemberActivityComponent implements OnInit {
  private readonly api = inject(MemberActivityService);
  private readonly users = inject(UserService);

  tab: ActivityTab = 'membres';
  loading = true;
  error: string | null = null;

  settings: ActivitySettings = { watchDays: 14, inactiveDays: 30 };
  members: ActivityMember[] = [];
  campaigns: ReminderCampaign[] = [];
  templates: MessageTemplate[] = [];

  filter: StateFilter = 'INACTIF';
  search = '';
  selected = new Set<string>();

  composerOpen = false;
  openCampaignId: number | null = null;
  drawerMember: ActivityMember | null = null;

  settingsOpen = false;
  settingsDraft: ActivitySettings = { watchDays: 14, inactiveDays: 30 };
  settingsError: string | null = null;

  readonly stateLabels = STATE_LABELS;
  readonly decisionLabel = decisionLabel;
  readonly reasonLabel = deliveryReasonLabel;
  readonly filters: { key: StateFilter; label: string }[] = [
    { key: 'INACTIF', label: 'Inactifs' },
    { key: 'A_SURVEILLER', label: 'À surveiller' },
    { key: 'EN_PAUSE', label: 'En pause' },
    { key: 'ACTIF', label: 'Actifs' },
    { key: 'TOUS', label: 'Tous' }
  ];

  /** Seule la Direction change les seuils d'activité. */
  isDirector = false;

  ngOnInit(): void {
    this.users.getMyProfile().subscribe({
      next: response => (this.isDirector = (response?.data?.roles ?? []).some(role => (role ?? '').toUpperCase() === 'ADMIN')),
      error: () => undefined
    });
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.api.overview().pipe(finalize(() => (this.loading = false))).subscribe({
      next: overview => {
        this.settings = overview.settings;
        this.members = overview.members ?? [];
        const known = new Set(this.members.map(member => member.userId));
        this.selected = new Set([...this.selected].filter(id => known.has(id)));
        if (this.drawerMember) this.drawerMember = this.members.find(member => member.userId === this.drawerMember?.userId) ?? null;
      },
      error: () => (this.error = 'Impossible de charger l’activité des membres pour le moment.')
    });
    this.loadCampaigns();
    this.api.templates().subscribe({ next: templates => (this.templates = templates ?? []), error: () => undefined });
  }

  loadCampaigns(): void {
    this.api.campaigns().subscribe({ next: campaigns => (this.campaigns = campaigns ?? []), error: () => undefined });
  }

  setTab(tab: ActivityTab): void {
    this.tab = tab;
    if (tab !== 'campagnes') this.openCampaignId = null;
  }

  // ==== Liste ====
  count(state: StateFilter): number {
    return state === 'TOUS' ? this.members.length : this.members.filter(member => member.state === state).length;
  }

  get visibleMembers(): ActivityMember[] {
    const term = this.search.trim().toLowerCase();
    return this.members
      .filter(member => this.filter === 'TOUS' || member.state === this.filter)
      .filter(member => !term || member.username.toLowerCase().includes(term))
      .sort((left, right) => right.daysInactive - left.daysInactive || left.username.localeCompare(right.username, 'fr'));
  }

  get activeCampaigns(): number {
    return this.campaigns.filter(campaign => campaign.status === 'EN_COURS' || campaign.status === 'PROGRAMMEE').length;
  }

  rankLabel(member: ActivityMember): string {
    const rank = memberRank(member.roles);
    const pole = rank === 'SPECIALISTE' ? specialtyLabel(member.specialty) : null;
    const treasurer = member.roles.some(role => (role ?? '').toUpperCase() === 'TRESORIER');
    return (RANK_LABELS[rank] ?? rank) + (pole ? ` · ${pole}` : '') + (treasurer ? ' · Trésorier' : '');
  }

  rankKey(member: ActivityMember): string {
    return memberRank(member.roles);
  }

  /** Jauge de 0 à 1 : la part du délai « inactif » déjà écoulée. */
  gauge(member: ActivityMember): number {
    return Math.min(1, member.daysInactive / Math.max(1, this.settings.inactiveDays));
  }

  daysText(days: number): string {
    if (days <= 0) return 'Aujourd’hui';
    if (days === 1) return 'Hier';
    return `${days} j`;
  }

  /** Une fiche encore ouverte : rappelée (ou en cours d'envoi) sans décision. */
  hasOpenReminder(member: ActivityMember): boolean {
    const reminder = member.reminder;
    return !!reminder && !reminder.decision;
  }

  reminderText(member: ActivityMember): string {
    const reminder = member.reminder;
    if (!reminder) return '';
    if (reminder.decision) return decisionLabel(reminder.decision);
    if (reminder.deliveryStatus === 'FAILED' && !reminder.contactedAt) return 'Envoi échoué';
    if (reminder.deliveryStatus === 'PENDING') return 'Envoi en cours';
    if (!reminder.contactedAt) return 'À prévenir';
    return reminder.answeredAt ? 'A répondu' : 'Sans réponse pour l’instant';
  }

  reminderTone(member: ActivityMember): string {
    const reminder = member.reminder;
    if (!reminder) return 'none';
    if (reminder.decision) return reminder.decision;
    if (reminder.deliveryStatus === 'FAILED' && !reminder.contactedAt) return 'FAILED';
    return reminder.contactedAt ? 'WAITING' : 'TODO';
  }

  toggle(member: ActivityMember): void {
    const next = new Set(this.selected);
    if (next.has(member.userId)) next.delete(member.userId); else next.add(member.userId);
    this.selected = next;
  }

  get allVisibleSelected(): boolean {
    const visible = this.visibleMembers;
    return visible.length > 0 && visible.every(member => this.selected.has(member.userId));
  }

  toggleAllVisible(): void {
    const next = new Set(this.selected);
    const select = !this.allVisibleSelected;
    for (const member of this.visibleMembers) {
      if (select) next.add(member.userId); else next.delete(member.userId);
    }
    this.selected = next;
  }

  /** Raccourci : les inactifs sans fiche ouverte, ceux qu'on n'a pas encore prévenus. */
  selectInactiveNotReminded(): void {
    this.selected = new Set(this.members.filter(member => member.state === 'INACTIF' && !this.hasOpenReminder(member)).map(member => member.userId));
    this.filter = 'INACTIF';
  }

  get selectedMembers(): ActivityMember[] {
    return this.members.filter(member => this.selected.has(member.userId));
  }

  clearSelection(): void {
    this.selected = new Set();
  }

  // ==== Campagnes ====
  campaignCreated(campaign: ReminderCampaign): void {
    this.composerOpen = false;
    this.selected = new Set();
    this.tab = 'campagnes';
    this.openCampaignId = campaign.id;
    this.reload();
  }

  openCampaign(id: number): void {
    this.tab = 'campagnes';
    this.openCampaignId = id;
  }

  // ==== Seuils ====
  openSettings(): void {
    this.settingsDraft = { ...this.settings };
    this.settingsError = null;
    this.settingsOpen = !this.settingsOpen;
  }

  saveSettings(): void {
    this.settingsError = null;
    this.api.updateSettings(this.settingsDraft).subscribe({
      next: settings => {
        this.settings = settings;
        this.settingsOpen = false;
        this.reload();
      },
      error: err => (this.settingsError = err?.error?.message ?? 'Seuils refusés.')
    });
  }
}
