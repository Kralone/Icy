export interface Guide {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  status: string;
  published: boolean;
  gameVersion: string | null;
  updatedAt: string;
  createdAt: string;
}
