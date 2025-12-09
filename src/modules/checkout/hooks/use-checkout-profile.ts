'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CheckoutProfile, CheckoutProfileUpdateInput } from '../domain/models/checkout-profile';
import {
  getCheckoutEventBus,
  getCheckoutProfile,
  saveCheckoutProfile,
} from '../services/checkout-service';

interface UseCheckoutProfileState {
  profile: CheckoutProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<CheckoutProfile | null>;
  save: (input: CheckoutProfileUpdateInput) => Promise<CheckoutProfile>;
}

export const useCheckoutProfile = (): UseCheckoutProfileState => {
  const [profile, setProfile] = useState<CheckoutProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCheckoutProfile();
      setProfile(data);
      setError(null);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load checkout profile';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (input: CheckoutProfileUpdateInput) => {
    setIsSaving(true);
    try {
      const saved = await saveCheckoutProfile(input);
      setProfile(saved);
      setError(null);
      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save checkout profile';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    const eventBus = getCheckoutEventBus();
    const unsubscribe = eventBus.subscribe((event) => {
      if (event.type === 'profile_loaded') {
        setProfile(event.payload);
        setError(null);
        setIsLoading(false);
      }
      if (event.type === 'profile_save_started') {
        setIsSaving(true);
      }
      if (event.type === 'profile_saved') {
        setProfile(event.payload);
        setIsSaving(false);
        setError(null);
      }
      if (event.type === 'profile_save_failed') {
        setIsSaving(false);
        setError(event.error.message);
      }
      if (event.type === 'profile_load_failed') {
        setIsLoading(false);
        setError(event.error.message);
      }
    });

    fetchProfile().catch(() => {
      // Error state already handled
    });

    return () => {
      unsubscribe();
    };
  }, [fetchProfile]);

  return useMemo(
    () => ({
      profile,
      isLoading,
      isSaving,
      error,
      refresh: fetchProfile,
      save: saveProfile,
    }),
    [profile, isLoading, isSaving, error, fetchProfile, saveProfile],
  );
};
