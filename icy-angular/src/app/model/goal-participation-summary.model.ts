export interface GoalParticipationSummary {
  userId: string;
  username?: string | null;
  avatarUrl?: string | null;
  totalDelta: number;
  percentOfCurrent: number;
}
