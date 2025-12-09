'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { User, Settings, LogOut, UserCircle } from 'lucide-react';
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
import { getCurrentUserProfile } from '@/lib/services/user-service';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/models/definitions';
import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';
import type { LucideIcon } from 'lucide-react';

interface UserMenuCopy {
  profile: string;
  settings: string;
  logout: string;
  store: string;
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
  const _navigationSection = isRecord(dictRecord.navigation)
    ? (dictRecord.navigation as Record<string, unknown>)
    : undefined;
  const profileSection = isRecord(dictRecord.profile)
    ? (dictRecord.profile as ProfileSectionDictionary)
    : undefined;
  const settingsSection = isRecord(dictRecord.settings)
    ? (dictRecord.settings as SettingsSectionDictionary)
    : undefined;

  return {
    profile:
      (profileSection?.title as string | undefined) ??
      'Profile',
    settings:
      (profileSection?.settings as string | undefined) ??
      (settingsSection?.menuLabel as string | undefined) ??
      (settingsSection?.pageTitle as string | undefined) ??
      'Settings',
    logout:
      (profileSection?.logout as string | undefined) ??
      'Log out',
    store: 'My Store',
  };
};

interface AffiliateUserMenuProps {
  user: SupabaseUser | null;
  lang: Locale;
  dict: AppDictionary;
  affiliateCode: string;
  onNavigate?: () => void;
}

export default function AffiliateUserMenu({ user, lang, dict, affiliateCode, onNavigate }: AffiliateUserMenuProps) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [_isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        setIsLoadingProfile(true);
        try {
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.push(`/${lang}/affiliate/${affiliateCode}`);
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
        {renderMenuLink(`/${lang}/affiliate/${affiliateCode}`, menuCopy.store, UserCircle)}
        {renderMenuLink(`/${lang}/affiliate/${affiliateCode}/profile`, menuCopy.profile, User)}
        {renderMenuLink(`/${lang}/affiliate/${affiliateCode}/settings`, menuCopy.settings, Settings)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{menuCopy.logout}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
