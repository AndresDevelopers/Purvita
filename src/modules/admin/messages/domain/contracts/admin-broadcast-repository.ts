import type {
  AdminBroadcastAudience,
  AdminBroadcastRecordInput,
  AdminBroadcastSnapshot,
  BroadcastRecipient,
} from '../models/admin-broadcast';

export interface AdminBroadcastRepository {
  getSnapshot(): Promise<AdminBroadcastSnapshot>;
  getRecipients(audience: AdminBroadcastAudience): Promise<BroadcastRecipient[]>;
  saveBroadcast(record: AdminBroadcastRecordInput, result: {
    intendedCount: number;
    deliveredCount: number;
    failedCount: number;
    failures: Array<{ email: string; reason: string }>;
  }): Promise<string>;
  listProducts(): Promise<Array<{ id: string; name: string }>>;
  searchUsers(query: string, limit?: number): Promise<BroadcastRecipient[]>;
}

