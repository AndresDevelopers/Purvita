'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import type { Permission } from '@/lib/models/role';

export const useAdminSidebar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSessionAndPermissions = async () => {
      try {
        const { data: { session } } = await getSafeSession();
        if (!isMounted) {
          return;
        }

        const isAuthed = Boolean(session?.user);
        setIsAuthenticated(isAuthed);

        if (isAuthed) {
          try {
            const response = await fetch('/api/check-admin-access', {
              method: 'GET',
              credentials: 'include',
            });

            if (!isMounted) {
              return;
            }

            if (response.ok) {
              const data = await response.json();
              setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
            } else {
              setPermissions([]);
            }
          } catch (error) {
            console.error('Error loading admin permissions in admin sidebar:', error);
            if (isMounted) {
              setPermissions([]);
            }
          }
        } else {
          setPermissions(null);
        }
      } catch (error) {
        console.error('Error loading Supabase session in admin sidebar:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setPermissions(null);
        }
      }
    };

    loadSessionAndPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      const isAuthed = Boolean(session?.user);
      setIsAuthenticated(isAuthed);

      if (!isAuthed) {
        setPermissions(null);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      const button = document.getElementById('language-button');
      const menu = document.getElementById('language-menu');
      if (button && menu && !button.contains(event.target as Node) && !menu.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const toggleLanguageMenu = useCallback(() => {
    setLanguageMenuOpen((prev) => !prev);
  }, []);

  const closeLanguageMenu = useCallback(() => {
    setLanguageMenuOpen(false);
  }, []);

  return {
    isAuthenticated,
    languageMenuOpen,
    toggleLanguageMenu,
    closeLanguageMenu,
    permissions,
  };
};
