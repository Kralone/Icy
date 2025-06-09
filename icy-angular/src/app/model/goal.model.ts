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
  subGoals: Goal[];
}
