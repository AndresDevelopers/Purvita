'use client';

import { useCallback, useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { Locale } from '@/i18n/config';
import { createBrowserClient } from '@supabase/ssr';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

type ImpersonationCopy = {
  actionLabel: string;
  busyLabel: string;
  errorTitle: string;
  errorDescription: string;
};

interface ImpersonateUserButtonProps {
  userId: string;
  lang: Locale;
  copy: ImpersonationCopy;
  isUserBlocked?: boolean;
  blockReason?: string | null;
}

export function ImpersonateUserButton({ userId, lang, copy, isUserBlocked = false, blockReason }: ImpersonateUserButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const isDisabled = isLoading || isUserBlocked;
  
  // Build tooltip message for blocked users
  const blockedTooltip = isUserBlocked 
    ? blockReason 
      ? `Blocked: ${blockReason}` 
      : 'User is blocked or inactive'
    : undefined;

  const handleClick = useCallback(async () => {
    setIsLoading(true);

    try {
      // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
      const response = await adminApi.post(`/api/admin/users/${userId}/impersonate?lang=${lang}`);

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage = typeof payload?.error === 'string' ? payload.error : copy.errorDescription;
        throw new Error(errorMessage);
      }

      const payload: { url?: string | null } = await response.json();

      if (!payload?.url) {
        throw new Error(copy.errorDescription);
      }

      // Sign out the current admin user before impersonating
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      console.log('[ImpersonateUserButton] Signing out current admin user...');
      await supabase.auth.signOut({ scope: 'local' });

      // Small delay to ensure sign out is processed
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[ImpersonateUserButton] Redirecting to magic link:', payload.url);

      // Use window.location.replace for immediate navigation
      // This replaces the current history entry so user can't go back to admin page
      window.location.replace(payload.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.errorDescription;
      toast({
        title: copy.errorTitle,
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [copy.errorDescription, copy.errorTitle, lang, toast, userId]);

  const buttonContent = (
    <Button 
      onClick={handleClick} 
      disabled={isDisabled} 
      className="w-full sm:w-auto" 
      variant="secondary"
    >
      {isLoading ? (
        <span className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.busyLabel}
        </span>
      ) : (
        <span className="flex items-center gap-2 text-sm font-medium">
          <LogIn className="h-4 w-4" />
          {copy.actionLabel}
        </span>
      )}
    </Button>
  );

  // Wrap in tooltip only when blocked (tooltip doesn't work well on disabled buttons without wrapper)
  if (isUserBlocked && blockedTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              {buttonContent}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{blockedTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}
