export interface User {
  id: string;
  username: string;
  discordId: string;
  createdAt: string | null;
  /** Dernière activité enregistrée ; null si le membre n'a jamais été vu. */
  lastSeenAt?: string | null;
  active: boolean;
  roles: string[];
}
