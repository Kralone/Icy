export interface GoalTemplate {
  id: number;
  name: string;
  description: string;
  target: number;
  createdAt: string;
  parentId: number | null;
  userId?: string | null;
  username?: string | null;
  subTemplates: GoalTemplate[];
}
