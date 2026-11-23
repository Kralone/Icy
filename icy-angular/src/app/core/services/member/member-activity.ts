/** Suivi de l'activité des membres, rappels et messages privés du bot (/api/member-activity). */

/** ACTIF, A_SURVEILLER, INACTIF sont calculés ; EN_PAUSE vient d'une correction ou d'une réponse à un rappel. */
export type ActivityState = 'ACTIF' | 'A_SURVEILLER' | 'INACTIF' | 'EN_PAUSE';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';
export type ReminderDecision = 'REVIENT' | 'PAUSE' | 'QUITTE' | 'SANS_REPONSE';
export type CampaignStatus = 'BROUILLON' | 'PROGRAMMEE' | 'EN_COURS' | 'ANNULEE';
export type CampaignDelivery = 'BOT' | 'MANUEL';

export interface ActivitySettings { watchDays: number; inactiveDays: number; }

export interface ManualFollowUp {
  state: 'ACTIF' | 'EN_PAUSE' | null;
  until: string | null;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ReminderSummary {
  id: number;
  campaignId: number;
  campaignTitle: string | null;
  contactedAt: string | null;
  answeredAt: string | null;
  decision: ReminderDecision | null;
  pauseUntil: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveryReason: string | null;
}

export interface ActivityMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  discordId: string;
  roles: string[];
  specialty: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  lastOperationAt: string | null;
  lastActivityAt: string | null;
  daysInactive: number;
  computedState: ActivityState;
  state: ActivityState;
  manual: ManualFollowUp | null;
  reminder: ReminderSummary | null;
}

export interface ActivityOverview { settings: ActivitySettings; members: ActivityMember[]; }

export interface MessageTemplate {
  code: string;
  category: 'RAPPEL' | 'PROMOTION';
  label: string;
  body: string;
  mediaFile: string | null;
  mediaUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MemberReminder {
  id: number;
  campaignId: number;
  campaignTitle: string;
  delivery: CampaignDelivery;
  userId: string;
  username: string;
  avatarUrl: string | null;
  discordId: string | null;
  daysInactive: number | null;
  contactedAt: string | null;
  answeredAt: string | null;
  decision: ReminderDecision | null;
  pauseUntil: string | null;
  note: string | null;
  deliveryStatus: DeliveryStatus | null;
  deliveryReason: string | null;
  /** Texte personnalisé, prêt à copier. */
  message: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Où en est le membre aujourd'hui. */
  today: ReminderToday | null;
}

/** PARTI : compte désactivé. */
export type TodayState = ActivityState | 'PARTI';

export interface ReminderToday {
  state: TodayState;
  lastActivityAt: string | null;
  /** Revenu sur le site ou en opération après le rappel ; null s'il n'a pas encore été rappelé. */
  cameBack: boolean | null;
}

export interface CampaignCounts {
  members: number;
  contacted: number;
  pending: number;
  failed: number;
  answered: number;
  decisions: Partial<Record<ReminderDecision, number>>;
  /** Rappelés revenus depuis. */
  cameBack: number;
  /** État actuel des membres de la campagne. */
  states: Partial<Record<TodayState, number>>;
}

export interface ReminderCampaign {
  id: number;
  title: string;
  body: string;
  mediaFile: string | null;
  mediaUrl: string | null;
  delivery: CampaignDelivery;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string;
  createdAt: string;
  counts: CampaignCounts;
  /** Présentes seulement sur le détail d'une campagne. */
  reminders: MemberReminder[] | null;
}

export interface DirectMessageEntry {
  id: string;
  origin: string;
  reference: string | null;
  label: string;
  status: DeliveryStatus;
  reason: string | null;
  requestedAt: string;
  completedAt: string | null;
  requestedBy: string | null;
}

export interface MemberHistory { userId: string; username: string; reminders: MemberReminder[]; messages: DirectMessageEntry[]; }

export interface CampaignCreate {
  title: string;
  body: string;
  mediaFile: string | null;
  delivery: CampaignDelivery;
  userIds: string[];
  scheduledAt: string | null;
  sendNow: boolean;
}

export interface ReminderUpdate {
  contacted?: boolean | null;
  answered?: boolean | null;
  /** '' efface la décision. */
  decision?: ReminderDecision | '' | null;
  pauseUntil?: string | null;
  note?: string | null;
}

export const STATE_LABELS: Record<ActivityState, string> = {
  ACTIF: 'Actif',
  A_SURVEILLER: 'À surveiller',
  INACTIF: 'Inactif',
  EN_PAUSE: 'En pause'
};

/** État du jour d'un membre rappelé, compte désactivé compris. */
export const TODAY_LABELS: Record<TodayState, string> = { ...STATE_LABELS, PARTI: 'Parti' };

export const DECISIONS: ReadonlyArray<{ key: ReminderDecision; label: string }> = [
  { key: 'REVIENT', label: 'Revient' },
  { key: 'PAUSE', label: 'En pause' },
  { key: 'QUITTE', label: 'Quitte la corpo' },
  { key: 'SANS_REPONSE', label: 'Sans réponse' }
];

export function decisionLabel(decision: ReminderDecision | null | undefined): string {
  return DECISIONS.find(entry => entry.key === decision)?.label ?? '';
}

/** Raison d'un échec ou d'une réserve du bot, en clair. */
export function deliveryReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case 'dm_closed': return 'Messages privés fermés';
    case 'user_not_found': return 'Compte Discord introuvable';
    case 'invalid_discord_id': return 'Identifiant Discord invalide';
    case 'no_answer': return 'Le bot n’a pas répondu';
    case 'media_missing': return 'Envoyé sans le GIF (fichier introuvable)';
    case 'media_too_large': return 'Envoyé sans le GIF (fichier trop lourd)';
    case 'discord_rejected':
    case 'forbidden': return 'Refusé par Discord';
    case 'empty_message': return 'Message vide';
    default: return reason ?? '';
  }
}

/** Remplace {pseudo}, {grade} et {pôle}, comme le serveur. */
export function renderMessage(body: string, values: { pseudo: string; grade?: string; pole?: string }): string {
  return (body ?? '')
    .replaceAll('{pseudo}', values.pseudo)
    .replaceAll('{grade}', values.grade ?? '')
    .replaceAll('{pôle}', values.pole ?? '')
    .replaceAll('{pole}', values.pole ?? '');
}

/** Aperçu proche de Discord : texte échappé, **gras** et *italique* mis en forme. À afficher avec [innerHTML]. */
export function discordPreviewHtml(text: string): string {
  const escaped = (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}
