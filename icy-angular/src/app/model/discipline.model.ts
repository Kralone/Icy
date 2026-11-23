/** Avertissements disciplinaires : voir MemberWarningService côté serveur. */

export type WarningCategory = 'COMPORTEMENT' | 'REGLEMENT' | 'ABSENCE' | 'OPERATION' | 'AUTRE';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';
export type SanctionDecision = 'EXCLUDE' | 'KEEP';

/** Avertissements en cours d'un membre actif. pendingDecision : seuil atteint, un Directeur doit trancher. */
export interface DisciplineStanding {
  userId: string;
  activeWarnings: number;
  lastWarningAt: string | null;
  pendingDecision: boolean;
}

/** Exclusion décidée dont le ban Discord reste à faire à la main. */
export interface DiscordBanTask {
  sanctionId: number;
  userId: string;
  username: string;
  discordId: string;
  decidedByName: string;
  decidedAt: string;
}

export interface DisciplineSummary {
  threshold: number;
  members: DisciplineStanding[];
  discordBansToDo: DiscordBanTask[];
}

export interface MemberWarning {
  id: number;
  category: WarningCategory;
  reason: string;
  rank: number;
  issuedByName: string;
  createdAt: string;
  active: boolean;
  revokedAt: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
  dmStatus: DeliveryStatus;
  /** Raison d'un refus de Discord : dm_closed, user_not_found… */
  dmFailure: string | null;
}

export interface MemberSanction {
  id: number;
  decision: SanctionDecision;
  note: string | null;
  decidedByName: string;
  createdAt: string;
  discordBanDoneAt: string | null;
  discordBanDoneBy: string | null;
  /** null quand le membre n'a pas été prévenu. */
  dmStatus: DeliveryStatus | null;
  dmFailure: string | null;
}

/** Dossier disciplinaire d'un membre. canWarn : avertir et lever ; canDecide : trancher au seuil (Directeur). */
export interface DisciplineRecord {
  userId: string;
  username: string;
  discordId: string;
  active: boolean;
  threshold: number;
  activeWarnings: number;
  pendingDecision: boolean;
  canWarn: boolean;
  canDecide: boolean;
  warnings: MemberWarning[];
  sanctions: MemberSanction[];
}
