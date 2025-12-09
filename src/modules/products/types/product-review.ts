
export type ProductReviewDisplay = {
  id: string;
  author: string;
  avatarUrl?: string;
  timeAgo?: string;
  rating: number;
  comment: string;
  createdAt?: string | null;
  source?: 'admin' | 'member';
  userId?: string | null;
};
