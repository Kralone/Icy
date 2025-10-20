import { NewsType } from './news-type.model';

export interface News {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  author: string;
  createdAt: string;
  type?: NewsType | null;
}
