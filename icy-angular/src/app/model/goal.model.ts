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
  userId?: string | null;
  username?: string | null;
  subGoals: Goal[];

  /** UI only */
  __expanded?: boolean;
}
