export interface GoalParticipation {
  id: string;
  goalId: number;
  userId: string;
  username?: string | null;
  avatarUrl?: string | null;
  delta: number;
  totalAfter: number;
  createdAt: string;
}
