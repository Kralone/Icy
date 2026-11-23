import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MemberActivityService } from '../../../core/services/member/member-activity.service';
import { ActivityMember, CampaignDelivery, MessageTemplate, ReminderCampaign, discordPreviewHtml, renderMessage } from '../../../core/services/member/member-activity';
import { DateTimeFieldComponent } from '../../../shared/date-time-field/date-time-field.component';
import { MediaPickerComponent } from './media-picker.component';

export type SendMode = 'MANUEL' | 'BOT_NOW' | 'BOT_LATER';

const pad = (value: number) => String(value).padStart(2, '0');

/** Prépare une campagne de rappel pour les membres cochés : le message, le GIF et la façon de l'envoyer. */
@Component({
  selector: 'app-campaign-composer',
  templateUrl: './campaign-composer.component.html',
  styleUrl: './campaign-composer.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, DateTimeFieldComponent, MediaPickerComponent]
})
export class CampaignComposerComponent implements OnInit {
  private readonly api = inject(MemberActivityService);

  readonly members = input.required<ActivityMember[]>();
  readonly templates = input<MessageTemplate[]>([]);
  readonly closed = output<void>();
  readonly created = output<ReminderCampaign>();

  title = '';
  body = '';
  mediaFile: string | null = null;
  /** Par défaut l'officier envoie lui-même : il voit qui répond. */
  mode: SendMode = 'MANUEL';
  scheduledAt = '';
  saving = false;
  error: string | null = null;
  previewIndex = 0;

  readonly modes: { key: SendMode; label: string; help: string }[] = [
    { key: 'MANUEL', label: 'Je l’envoie moi-même', help: 'Chaque fiche donne le message personnalisé à copier dans Discord. Vous cochez « rappelé » au fur et à mesure.' },
    { key: 'BOT_NOW', label: 'Par le bot, maintenant', help: 'Le bot envoie le message et le GIF en privé à chacun. Les fiches se cochent seules quand Discord confirme.' },
    { key: 'BOT_LATER', label: 'Par le bot, programmé', help: 'Le bot enverra à l’heure choisie. Jusque-là, la campagne reste modifiable ou annulable.' }
  ];

  ngOnInit(): void {
    const today = new Date();
    this.title = `Rappel du ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    const template = this.templates().find(entry => entry.code === 'RAPPEL_INACTIVITE') ?? this.templates().find(entry => entry.category === 'RAPPEL');
    this.body = template?.body ?? '';
    this.mediaFile = template?.mediaFile ?? null;
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    this.scheduledAt = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T19:00`;
  }

  get previewMember(): ActivityMember | null {
    const list = this.members();
    return list.length ? list[Math.min(this.previewIndex, list.length - 1)] : null;
  }

  get preview(): string {
    return renderMessage(this.body, { pseudo: this.previewMember?.username ?? 'Pseudo' });
  }

  get previewHtml(): string {
    return discordPreviewHtml(this.preview);
  }

  get tooLong(): boolean {
    return this.body.length > 1900;
  }

  nextPreview(): void {
    this.previewIndex = (this.previewIndex + 1) % Math.max(1, this.members().length);
  }

  get modeHelp(): string {
    return this.modes.find(mode => mode.key === this.mode)?.help ?? '';
  }

  get submitLabel(): string {
    const count = this.members().length;
    const plural = count > 1 ? 's' : '';
    switch (this.mode) {
      case 'BOT_NOW': return `Envoyer à ${count} membre${plural}`;
      case 'BOT_LATER': return 'Programmer l’envoi';
      default: return `Créer ${count} fiche${plural} de rappel`;
    }
  }

  submit(): void {
    if (this.saving || !this.body.trim() || this.tooLong || !this.title.trim()) return;
    if (this.mode === 'BOT_LATER' && !this.scheduledAt) {
      this.error = 'Choisissez le jour et l’heure de l’envoi.';
      return;
    }
    if (this.mode === 'BOT_NOW' && !confirm(`Le bot va envoyer ce message en privé à ${this.members().length} membre(s). Continuer ?`)) return;
    this.saving = true;
    this.error = null;
    const delivery: CampaignDelivery = this.mode === 'MANUEL' ? 'MANUEL' : 'BOT';
    this.api.createCampaign({
      title: this.title.trim(),
      body: this.body,
      mediaFile: this.mediaFile,
      delivery,
      userIds: this.members().map(member => member.userId),
      scheduledAt: this.mode === 'BOT_LATER' ? `${this.scheduledAt}:00` : null,
      sendNow: this.mode === 'BOT_NOW'
    }).subscribe({
      next: campaign => {
        this.saving = false;
        this.created.emit(campaign);
      },
      error: err => {
        this.saving = false;
        this.error = err?.error?.message ?? 'La campagne n’a pas pu être créée.';
      }
    });
  }
}
