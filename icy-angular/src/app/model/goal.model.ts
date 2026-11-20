export interface GoalMember {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string;
  target: number;
  current: number;
  pinned: boolean;
  completed: boolean;
  createdAt: string;
  parentId: number | null;
  /** Pôle de rattachement d'un objectif principal (LOGISTIQUE, MILITAIRE, INDUSTRIE), s'il y en a un. */
  pole?: string | null;
  userId?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  /** Joueurs inscrits sur l'objectif. Absent sur une API antérieure à la fonctionnalité. */
  members?: GoalMember[];
  subGoals: Goal[];

  /** UI only */
  __expanded?: boolean;
  __allSubGoals?: Goal[];
}
