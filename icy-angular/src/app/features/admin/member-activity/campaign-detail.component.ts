import { ChangeDetectionStrategy, Component, OnChanges, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MemberActivityService } from '../../../core/services/member/member-activity.service';
import { UserService } from '../../../core/services/user/user.service';
import {
  DECISIONS, MemberReminder, TODAY_LABELS, ReminderCampaign, ReminderDecision, ReminderUpdate, decisionLabel, deliveryReasonLabel, discordPreviewHtml
} from '../../../core/services/member/member-activity';

export type FicheFilter = 'TOUTES' | 'A_PREVENIR' | 'EN_ATTENTE' | 'DECIDEES';

/**
 * Fiches de rappel d'une campagne : qui a été prévenu, qui a répondu et ce qu'il a décidé.
 * En envoi manuel, chaque fiche donne le message personnalisé à copier et un lien vers le profil Discord.
 */
@Component({
  selector: 'app-campaign-detail',
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, FormsModule]
})
export class CampaignDetailComponent implements OnChanges {
  private readonly api = inject(MemberActivityService);
  private readonly users = inject(UserService);

  readonly campaignId = input.required<number>();
  readonly back = output<void>();
  readonly changed = output<void>();

  campaign: ReminderCampaign | null = null;
  loading = true;
  error: string | null = null;
  actionError: string | null = null;
  busyId: number | null = null;
  copiedId: number | null = null;
  filter: FicheFilter = 'TOUTES';
  notes: Record<number, string> = {};
  pauseDates: Record<number, string> = {};
  messageOpen = false;

  readonly decisions = DECISIONS;
  readonly decisionLabel = decisionLabel;
  readonly todayLabels = TODAY_LABELS;
  readonly reasonLabel = deliveryReasonLabel;
  readonly minPauseDate = new Date().toISOString().slice(0, 10);

  ngOnChanges(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.campaign(this.campaignId()).subscribe({
      next: campaign => {
        this.campaign = campaign;
        this.loading = false;
        for (const fiche of campaign.reminders ?? []) {
          this.notes[fiche.id] = fiche.note ?? '';
          this.pauseDates[fiche.id] = fiche.pauseUntil ?? this.defaultPauseDate();
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Campagne introuvable.';
      }
    });
  }

  private defaultPauseDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  }

  get fiches(): MemberReminder[] {
    const all = this.campaign?.reminders ?? [];
    switch (this.filter) {
      case 'A_PREVENIR': return all.filter(fiche => !fiche.contactedAt && !fiche.decision);
      case 'EN_ATTENTE': return all.filter(fiche => !!fiche.contactedAt && !fiche.decision);
      case 'DECIDEES': return all.filter(fiche => !!fiche.decision);
      default: return all;
    }
  }

  count(filter: FicheFilter): number {
    const previous = this.filter;
    this.filter = filter;
    const total = this.fiches.length;
    this.filter = previous;
    return total;
  }

  get bodyHtml(): string {
    return discordPreviewHtml(this.campaign?.body ?? '');
  }

  get isBot(): boolean {
    return this.campaign?.delivery === 'BOT';
  }

  get notSentYet(): boolean {
    return this.campaign?.status === 'BROUILLON' || this.campaign?.status === 'PROGRAMMEE';
  }

  get deletable(): boolean {
    return (this.campaign?.reminders ?? []).every(fiche => !fiche.contactedAt && !fiche.deliveryStatus);
  }

  /** Statut d'envoi d'une fiche, en clair. */
  contactState(fiche: MemberReminder): { tone: string; label: string } {
    if (fiche.deliveryStatus === 'PENDING') return { tone: 'PENDING', label: 'Envoi en cours' };
    if (fiche.deliveryStatus === 'FAILED' && !fiche.contactedAt) return { tone: 'FAILED', label: this.reasonLabel(fiche.deliveryReason) || 'Échec de l’envoi' };
    if (fiche.contactedAt) return { tone: 'SENT', label: this.isBot ? 'Envoyé par le bot' : 'Rappelé' };
    return { tone: 'TODO', label: this.notSentYet && this.isBot ? 'Pas encore envoyé' : 'À prévenir' };
  }

  discordUrl(fiche: MemberReminder): string | null {
    return fiche.discordId && /^\d{5,25}$/.test(fiche.discordId) ? `https://discord.com/users/${fiche.discordId}` : null;
  }

  copy(fiche: MemberReminder): void {
    if (!fiche.message) return;
    navigator.clipboard?.writeText(fiche.message).then(() => {
      this.copiedId = fiche.id;
      setTimeout(() => { if (this.copiedId === fiche.id) this.copiedId = null; }, 2000);
    }).catch(() => (this.actionError = 'Copie impossible : sélectionnez le texte à la main.'));
  }

  update(fiche: MemberReminder, change: ReminderUpdate): void {
    this.busyId = fiche.id;
    this.actionError = null;
    this.api.updateReminder(fiche.id, change).subscribe({
      next: updated => {
        this.busyId = null;
        this.replace(updated);
        this.changed.emit();
      },
      error: err => {
        this.busyId = null;
        this.actionError = err?.error?.message ?? 'Modification refusée.';
      }
    });
  }

  setDecision(fiche: MemberReminder, decision: ReminderDecision): void {
    if (fiche.decision === decision) {
      this.update(fiche, { decision: '' });
      return;
    }
    this.update(fiche, { decision, pauseUntil: decision === 'PAUSE' ? this.pauseDates[fiche.id] : null });
  }

  savePause(fiche: MemberReminder): void {
    if (fiche.decision === 'PAUSE' && this.pauseDates[fiche.id] && this.pauseDates[fiche.id] !== fiche.pauseUntil) {
      this.update(fiche, { decision: 'PAUSE', pauseUntil: this.pauseDates[fiche.id] });
    }
  }

  saveNote(fiche: MemberReminder): void {
    if ((this.notes[fiche.id] ?? '') !== (fiche.note ?? '')) this.update(fiche, { note: this.notes[fiche.id] ?? '' });
  }

  resend(fiche: MemberReminder): void {
    this.busyId = fiche.id;
    this.actionError = null;
    this.api.resendReminder(fiche.id).subscribe({
      next: updated => { this.busyId = null; this.replace(updated); },
      error: err => { this.busyId = null; this.actionError = err?.error?.message ?? 'Renvoi impossible.'; }
    });
  }

  /** Un membre qui quitte la corpo : son compte peut être désactivé d'ici, après confirmation. */
  deactivate(fiche: MemberReminder): void {
    if (!confirm(`Désactiver le compte de ${fiche.username} ? Il pourra être réactivé depuis la liste des membres.`)) return;
    this.users.deleteUser(fiche.userId).subscribe({
      next: () => { this.changed.emit(); this.load(); },
      error: () => (this.actionError = 'Désactivation impossible.')
    });
  }

  sendNow(): void {
    if (!this.campaign || !confirm(`Le bot va envoyer le rappel en privé à ${this.campaign.counts.members} membre(s). Continuer ?`)) return;
    this.api.sendCampaign(this.campaign.id).subscribe({
      next: result => {
        if (result.skipped?.length) this.actionError = `Non envoyé : ${result.skipped.join(', ')}.`;
        this.load();
        this.changed.emit();
      },
      error: err => (this.actionError = err?.error?.message ?? 'Envoi impossible.')
    });
  }

  cancel(): void {
    if (!this.campaign || !confirm('Annuler cette campagne ? Aucun message ne partira.')) return;
    this.api.cancelCampaign(this.campaign.id).subscribe({
      next: () => { this.load(); this.changed.emit(); },
      error: err => (this.actionError = err?.error?.message ?? 'Annulation impossible.')
    });
  }

  remove(): void {
    if (!this.campaign || !confirm('Supprimer cette campagne et ses fiches ?')) return;
    this.api.deleteCampaign(this.campaign.id).subscribe({
      next: () => { this.changed.emit(); this.back.emit(); },
      error: err => (this.actionError = err?.error?.message ?? 'Suppression impossible.')
    });
  }

  private replace(updated: MemberReminder): void {
    if (!this.campaign?.reminders) return;
    this.campaign.reminders = this.campaign.reminders.map(fiche => fiche.id === updated.id ? updated : fiche);
    this.notes[updated.id] = updated.note ?? '';
    if (updated.pauseUntil) this.pauseDates[updated.id] = updated.pauseUntil;
    const fiches = this.campaign.reminders;
    const decisions: Partial<Record<ReminderDecision, number>> = {};
    for (const fiche of fiches) if (fiche.decision) decisions[fiche.decision] = (decisions[fiche.decision] ?? 0) + 1;
    this.campaign.counts = {
      ...this.campaign.counts,
      contacted: fiches.filter(fiche => fiche.contactedAt).length,
      answered: fiches.filter(fiche => fiche.answeredAt).length,
      decisions
    };
  }
}
