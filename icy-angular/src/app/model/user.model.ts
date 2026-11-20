export interface User {
  id: string;
  username: string;
  discordId: string;
  createdAt: string | null;
  /** Dernière activité enregistrée ; null si le membre n'a jamais été vu. */
  lastSeenAt?: string | null;
  active: boolean;
  roles: string[];
  /** Pôle du membre quand son grade est Spécialiste (LOGISTIQUE, MILITAIRE, INDUSTRIE) ; null sinon. */
  specialty?: string | null;
}
