import type {
  CreateUserProfile,
  UpdateUserProfile,
  UserProfile,
} from '@/lib/models/definitions';
import type { UserRepository } from '@/modules/users/domain/contracts/user-repository';
import {
  createUserModule,
  type UserModule,
} from '@/modules/users/factories/user-module';

let userModule: UserModule | null = null;

const getUserRepository = (): UserRepository => {
  if (userModule) {
    return userModule.repository;
  }

  return createUserModule().repository;
};

export const setUserModule = (module: UserModule | null) => {
  userModule = module;
};

export const getUsersCount = async (): Promise<number> => {
  return getUserRepository().countProfiles();
};

import type { UserFilters } from '@/modules/users/domain/contracts/user-repository';

export const getUsers = async (filters?: UserFilters): Promise<UserProfile[]> => {
  return getUserRepository().listProfiles(filters);
};

export const getUserById = async (id: string): Promise<UserProfile | null> => {
  return getUserRepository().getProfileById(id);
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  return getUserRepository().getCurrentProfile();
};

export const createUserProfile = async (profile: CreateUserProfile): Promise<UserProfile> => {
  return getUserRepository().createProfile(profile);
};

export const updateUserProfile = async (
  id: string,
  updates: UpdateUserProfile,
): Promise<UserProfile> => {
  return getUserRepository().updateProfile(id, updates);
};

export const getReferredUsers = async (userId: string): Promise<UserProfile[]> => {
  return getUserRepository().listReferredProfiles(userId);
};

export const generateReferralCode = async (baseName: string): Promise<string> => {
  return getUserRepository().generateReferralCode(baseName);
};

export const updateUserStatus = async (
  userId: string,
  status: 'active' | 'inactive' | 'suspended',
): Promise<UserProfile> => {
  return getUserRepository().updateStatus(userId, status);
};

export const updateUserRole = async (
  userId: string,
  role: 'member' | 'admin',
): Promise<UserProfile> => {
  return getUserRepository().updateRole(userId, role);
};

export const getRecentUsers = async (limit: number = 5): Promise<UserProfile[]> => {
  return getUserRepository().listRecentProfiles(limit);
};
