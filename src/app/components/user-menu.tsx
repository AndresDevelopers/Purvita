'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { User, Settings, LogOut, UserCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useOptionalUserProfile } from '@/contexts/user-profile-context';
import { getCurrentUserProfile } from '@/lib/services/user-service';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';
import type { LucideIcon } from 'lucide-react';

interface UserMenuCopy {
  dashboard: string;
  profile: string;
  settings: string;
  admin: string;
  logout: string;
}

interface ProfileSectionDictionary {
  title?: string;
  settings?: string;
  logout?: string;
}

interface SettingsSectionDictionary {
  menuLabel?: string;
  pageTitle?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveUserMenuCopy = (dict: AppDictionary): UserMenuCopy => {
  const dictRecord = dict as Record<string, unknown>;
  const navigationSection = isRecord(dictRecord.navigation)
    ? (dictRecord.navigation as Record<string, unknown>)
    : undefined;
  const profileSection = isRecord(dictRecord.profile)
    ? (dictRecord.profile as ProfileSectionDictionary)
    : undefined;
  const settingsSection = isRecord(dictRecord.settings)
    ? (dictRecord.settings as SettingsSectionDictionary)
    : undefined;

  return {
    dashboard:
      (navigationSection?.dashboard as string | undefined) ??
      'Dashboard',
    profile:
      (profileSection?.title as string | undefined) ??
      'Profile',
    settings:
      (profileSection?.settings as string | undefined) ??
      (settingsSection?.menuLabel as string | undefined) ??
      (settingsSection?.pageTitle as string | undefined) ??
      'Settings',
    admin: (navigationSection?.admin as string | undefined) ?? 'Admin',
    logout:
      (profileSection?.logout as string | undefined) ??
      'Log out',
  };
};

interface UserMenuProps {
  user: SupabaseUser | null;
  lang: Locale;
  dict: AppDictionary;
  onNavigate?: () => void;
}

export default function UserMenu({ user, lang, dict, onNavigate }: UserMenuProps) {
  const router = useRouter();

  // Try to use shared user profile from context to avoid duplicate API calls
  // If context is not available (e.g., not on dashboard), load profile independently
  const profileContext = useOptionalUserProfile();
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  // Use context profile if available, otherwise use local profile
  const userProfile = profileContext?.profile ?? localProfile;
  const _isLoadingProfile = profileContext?.isLoading ?? isLoadingLocal;

  useEffect(() => {
    // Only load profile locally if context is not available
    if (!profileContext && user) {
      const loadUserProfile = async () => {
        setIsLoadingLocal(true);
        try {
          const profile = await getCurrentUserProfile();
          setLocalProfile(profile);

          // Check if user has admin access (access_admin_panel permission required)
          if (profile) {
            const response = await fetch('/api/check-admin-access', {
              method: 'GET',
              credentials: 'include',
            });

            if (response.ok) {
              const data = await response.json();
              setHasAdminAccess(data.hasAccess === true);
            } else {
              setHasAdminAccess(false);
            }
          }
        } catch (error) {
          console.error('[UserMenu] Error loading user profile:', error);
          setLocalProfile(null);
          setHasAdminAccess(false);
        } finally {
          setIsLoadingLocal(false);
        }
      };

      loadUserProfile();
    } else if (!user) {
      setLocalProfile(null);
      setIsLoadingLocal(false);
      setHasAdminAccess(false);
    } else if (profileContext?.profile && user) {
      // If using context profile, check for access_admin_panel permission
      const checkPermissions = async () => {
        try {
          const response = await fetch('/api/check-admin-access', {
            method: 'GET',
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            setHasAdminAccess(data.hasAccess === true);
          } else {
            setHasAdminAccess(false);
          }
        } catch (error) {
          console.error('[UserMenu] Error checking permissions:', error);
          setHasAdminAccess(false);
        }
      };
      checkPermissions();
    }
  }, [user, profileContext]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.push(`/${lang}`);
  };

  const getUserInitials = () => {
    // Get the display name and return its first character
    const displayName = getUserDisplayName();
    return displayName.charAt(0).toUpperCase();
  };

  const getUserDisplayName = () => {
    // First try to get name from profile (database), then from user_metadata, then email
    return userProfile?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  const menuCopy = useMemo(() => resolveUserMenuCopy(dict), [dict]);

  const renderMenuLink = (href: string, label: string, Icon: LucideIcon) => (
    <DropdownMenuItem asChild>
      <Link href={href} className="flex items-center gap-2" onClick={onNavigate}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    </DropdownMenuItem>
  );

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full" suppressHydrationWarning>
          <Avatar className="h-8 w-8">
            <AvatarImage src={userProfile?.avatar_url || user.user_metadata?.avatar_url} alt={getUserDisplayName()} />
            <AvatarFallback>{getUserInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderMenuLink(`/${lang}/dashboard`, menuCopy.dashboard, UserCircle)}
        {hasAdminAccess &&
          renderMenuLink(`/admin/dashboard?lang=${lang}`, menuCopy.admin, Shield)}
        {renderMenuLink(`/${lang}/profile`, menuCopy.profile, User)}
        {renderMenuLink(`/${lang}/settings`, menuCopy.settings, Settings)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{menuCopy.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
