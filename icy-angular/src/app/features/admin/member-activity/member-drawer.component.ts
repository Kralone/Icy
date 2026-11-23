import { ChangeDetectionStrategy, Component, OnChanges, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MemberActivityService } from '../../../core/services/member/member-activity.service';
import {
  ActivityMember, ActivitySettings, MemberHistory, MessageTemplate, STATE_LABELS, decisionLabel, deliveryReasonLabel, discordPreviewHtml, renderMessage
} from '../../../core/services/member/member-activity';
import { memberRank, specialtyLabel } from '../../../core/services/user/member-rank';

const RANK_LABELS: Record<string, string> = {
  ADMIN: 'Directeur', OFFICIER: 'Officier', SPECIALISTE: 'Spécialiste', INGENIEUR: 'Ingénieur', ASSOCIE: 'Associé', JUNIOR: 'Junior'
};

/** Fiche d'un membre : son activité, la correction manuelle de son état, ses rappels et les messages du bot, une annonce à envoyer. */
@Component({
  selector: 'app-member-drawer',
  templateUrl: './member-drawer.component.html',
  styleUrl: './member-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, FormsModule]
})
export class MemberDrawerComponent implements OnChanges {
  private readonly api = inject(MemberActivityService);

  readonly member = input.required<ActivityMember>();
  readonly settings = input.required<ActivitySettings>();
  readonly templates = input<MessageTemplate[]>([]);
  readonly closed = output<void>();
  readonly changed = output<void>();
  readonly openCampaign = output<number>();

  history: MemberHistory | null = null;
  manualState: '' | 'ACTIF' | 'EN_PAUSE' = '';
  manualUntil = '';
  manualNote = '';
  savingManual = false;
  manualMessage: string | null = null;

  announceCode = '';
  announcing = false;
  announceMessage: string | null = null;
  announceError: string | null = null;

  readonly stateLabels = STATE_LABELS;
  readonly decisionLabel = decisionLabel;
  readonly reasonLabel = deliveryReasonLabel;
  readonly today = new Date().toISOString().slice(0, 10);

  private loadedFor: string | null = null;

  ngOnChanges(): void {
    const member = this.member();
    if (this.loadedFor === member.userId) return;
    this.loadedFor = member.userId;
    this.manualState = member.manual?.state ?? '';
    this.manualUntil = member.manual?.until ?? '';
    this.manualNote = member.manual?.note ?? '';
    this.manualMessage = null;
    this.announceMessage = null;
    this.announceError = null;
    this.announceCode = this.suggestedAnnouncement();
    this.loadHistory();
  }

  loadHistory(): void {
    this.api.history(this.member().userId).subscribe({ next: history => (this.history = history), error: () => (this.history = null) });
  }

  get rank(): string {
    return memberRank(this.member().roles);
  }

  get rankLabel(): string {
    const pole = this.rank === 'SPECIALISTE' ? specialtyLabel(this.member().specialty) : null;
    const treasurer = this.member().roles.some(role => (role ?? '').toUpperCase() === 'TRESORIER');
    return (RANK_LABELS[this.rank] ?? this.rank) + (pole ? ` · ${pole}` : '') + (treasurer ? ' · Trésorier' : '');
  }

  get promotionTemplates(): MessageTemplate[] {
    return this.templates().filter(template => template.category === 'PROMOTION');
  }

  /** Annonce qui correspond au grade actuel du membre. */
  private suggestedAnnouncement(): string {
    const member = this.member();
    const rank = memberRank(member.roles);
    const code = rank === 'SPECIALISTE' && member.specialty ? `PROMOTION_SPECIALISTE_${member.specialty.toUpperCase()}`
      : rank === 'JUNIOR' ? 'BIENVENUE_JUNIOR' : `PROMOTION_${rank}`;
    return this.promotionTemplates.some(template => template.code === code) ? code : (this.promotionTemplates[0]?.code ?? '');
  }

  get announcePreview(): string {
    const template = this.promotionTemplates.find(entry => entry.code === this.announceCode);
    if (!template) return '';
    const poleKey = ['INDUSTRIE', 'LOGISTIQUE', 'MILITAIRE'].find(key => template.code.endsWith(`_${key}`)) ?? this.member().specialty;
    return renderMessage(template.body, { pseudo: this.member().username, grade: RANK_LABELS[this.rank], pole: specialtyLabel(poleKey) ?? '' });
  }

  get announceHtml(): string {
    return discordPreviewHtml(this.announcePreview);
  }

  get announceMedia(): string | null {
    return this.promotionTemplates.find(entry => entry.code === this.announceCode)?.mediaUrl ?? null;
  }

  saveManual(): void {
    this.savingManual = true;
    this.manualMessage = null;
    this.api.updateFollowUp(this.member().userId, {
      state: this.manualState || null,
      until: this.manualState && this.manualUntil ? this.manualUntil : null,
      note: this.manualNote.trim() || null
    }).subscribe({
      next: () => {
        this.savingManual = false;
        this.manualMessage = 'Enregistré.';
        this.changed.emit();
      },
      error: err => {
        this.savingManual = false;
        this.manualMessage = err?.error?.message ?? 'Enregistrement refusé.';
      }
    });
  }

  announce(): void {
    const template = this.promotionTemplates.find(entry => entry.code === this.announceCode);
    if (!template || this.announcing) return;
    if (!confirm(`Envoyer « ${template.label} » en privé à ${this.member().username} par le bot ?`)) return;
    this.announcing = true;
    this.announceError = null;
    this.announceMessage = null;
    this.api.announce(this.member().userId, template.code).subscribe({
      next: () => {
        this.announcing = false;
        this.announceMessage = 'Confié au bot. Le résultat apparaît dans l’historique ci-dessous.';
        this.loadHistory();
        setTimeout(() => this.loadHistory(), 4000);
      },
      error: err => {
        this.announcing = false;
        this.announceError = err?.error?.message ?? 'Envoi impossible.';
      }
    });
  }

  statusLabel(status: string): string {
    return status === 'SENT' ? 'Envoyé' : status === 'FAILED' ? 'Échec' : 'En cours';
  }
}
