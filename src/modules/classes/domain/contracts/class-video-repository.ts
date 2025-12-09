import type { ClassVideo } from '@/lib/models/definitions';

export interface ClassVideoRepository {
  listPublished(): Promise<ClassVideo[]>;
  listPublishedForUser(userId: string, hasActiveSubscription: boolean, hasPurchasedProducts: boolean): Promise<ClassVideo[]>;
  getById(id: string): Promise<ClassVideo | null>;
  create(video: Omit<ClassVideo, 'id' | 'created_at' | 'updated_at'>): Promise<ClassVideo>;
  update(id: string, updates: Partial<Omit<ClassVideo, 'id' | 'created_at'>>): Promise<ClassVideo>;
  delete(id: string): Promise<void>;
  reorder(videos: { id: string; order_index: number }[]): Promise<void>;
}