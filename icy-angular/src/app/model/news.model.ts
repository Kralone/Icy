import { NewsType } from './news-type.model';

export interface News {
  id: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  author: string;
  createdAt: string;
  type?: NewsType | null;
}
