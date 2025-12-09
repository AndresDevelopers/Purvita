import type {
  CreateUserProfile,
  UpdateUserProfile,
  UserProfile,
} from '@/lib/models/definitions';

export interface UserFilters {
  levels?: number[];
  subscriptionStatus?: string[];
}

export interface UserRepository {
  countProfiles(): Promise<number>;
  listProfiles(filters?: UserFilters): Promise<UserProfile[]>;
  getProfileById(id: string): Promise<UserProfile | null>;
  getCurrentProfile(): Promise<UserProfile | null>;
  createProfile(profile: CreateUserProfile): Promise<UserProfile>;
  updateProfile(id: string, updates: UpdateUserProfile): Promise<UserProfile>;
  listReferredProfiles(userId: string): Promise<UserProfile[]>;
  generateReferralCode(baseName: string): Promise<string>;
  updateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<UserProfile>;
  updateRole(id: string, role: 'member' | 'admin'): Promise<UserProfile>;
  listRecentProfiles(limit?: number): Promise<UserProfile[]>;
}
