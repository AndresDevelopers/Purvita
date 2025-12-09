'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserProfile } from '@/lib/models/definitions';
import { getCurrentUserProfile } from '@/lib/services/user-service';

interface UserProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

interface UserProfileProviderProps {
  children: ReactNode;
  initialProfile?: UserProfile | null;
  autoLoad?: boolean;
}

/**
 * UserProfileProvider - Provides user profile data to all child components
 * 
 * This eliminates N+1 API calls by ensuring the user profile is fetched once
 * and shared across all components that need it (Header, UserMenu, Dashboard, etc.)
 * 
 * @param initialProfile - Optional initial profile data to avoid initial fetch
 * @param autoLoad - Whether to automatically load profile on mount (default: true)
 */
export function UserProfileProvider({ 
  children, 
  initialProfile = null,
  autoLoad = true 
}: UserProfileProviderProps) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedProfile = await getCurrentUserProfile();
      setProfile(fetchedProfile);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load user profile');
      setError(error);
      console.error('[UserProfileProvider] Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only auto-load if enabled and no initial profile provided
    if (autoLoad && !initialProfile) {
      refresh();
    }
  }, [autoLoad, initialProfile, refresh]);

  return (
    <UserProfileContext.Provider value={{ profile, isLoading, error, refresh, setProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

/**
 * useUserProfile - Hook to access user profile from context
 *
 * This hook should be used instead of calling getCurrentUserProfile() directly
 * to avoid duplicate API calls.
 *
 * @throws Error if used outside of UserProfileProvider
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

/**
 * useOptionalUserProfile - Hook to access user profile from context if available
 *
 * Returns undefined if used outside of UserProfileProvider.
 * This is useful for components that can work with or without the context.
 */
export function useOptionalUserProfile() {
  return useContext(UserProfileContext);
}

