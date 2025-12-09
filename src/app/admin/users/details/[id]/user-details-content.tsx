'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { WalletManager } from '@/components/admin/wallet-manager';

interface User {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  role_name?: { name: string } | null;
  status: string;
  created_at: string;
}

interface UserDetailsContentProps {
  userId: string;
  lang: Locale;
  dict: any; // TODO: Create proper dictionary type
  initialUser: User;
}

export function UserDetailsContent({ userId, lang, dict, initialUser }: UserDetailsContentProps) {
  const [userData, setUserData] = useState({
    walletBalance: 0,
    networkEarnings: 0,
    directReferrals: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please log in as admin');
        } else if (response.status === 403) {
          throw new Error('Forbidden - Admin access required');
        } else if (response.status === 404) {
          throw new Error('User not found');
        } else {
          throw new Error(`Failed to fetch user data (${response.status})`);
        }
      }

      const data = await response.json();
      setUserData({
        walletBalance: data.wallet?.balance_cents || 0,
        networkEarnings: data.networkEarnings?.totalAvailableCents || 0,
        directReferrals: data.directReferrals || 0,
      });
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleBalanceUpdated = useCallback(() => {
    fetchUserData();
  }, [fetchUserData]);

  const formatCurrency = useCallback((cents: number) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }, [lang]);

  return (
    <div>
      <Button variant="ghost" asChild className="mb-4">
        <Link href={`/admin/users?lang=${lang}`}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {dict.admin.backToUsers}
        </Link>
      </Button>
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="font-headline text-2xl">{initialUser.name || initialUser.email || 'Unknown User'}</CardTitle>
            <CardDescription>{initialUser.email}</CardDescription>
          </div>
          <div className="flex gap-2">
            <WalletManager
              userId={userId}
              userName={initialUser.name || initialUser.email || 'Unknown User'}
              currentBalance={userData.walletBalance}
              onBalanceUpdated={handleBalanceUpdated}
            />
            <Button asChild variant="outline">
              <Link href={`/admin/users/edit/${initialUser.id}?lang=${lang}`}>
                <Edit className="mr-2 h-4 w-4" />
                {dict.admin.editUser}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={initialUser.avatar_url || undefined} />
              <AvatarFallback>{initialUser.name?.charAt(0) || initialUser.email?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <div className="text-sm font-medium flex items-center gap-2">
                <span>{dict.admin.role}:</span>
                <Badge variant={initialUser.role_name ? 'default' : 'secondary'}>
                  {initialUser.role_name?.name || 'No Role'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {dict.admin.joinDate}: {new Date(initialUser.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">{dict.admin.status}</p>
              <div className="text-lg font-bold">
                <Badge
                  variant={initialUser.status === 'active' ? 'default' : 'outline'}
                  className={
                    initialUser.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      : ''
                  }
                >
                  {initialUser.status === 'active' ? dict.team.statusActive : dict.team.statusInactive}
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">{dict.dashboard.directReferrals}</p>
              <p className="text-lg font-bold">
                {isLoading ? '...' : userData.directReferrals}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">{dict.dashboard.monthlyEarnings}</p>
              <p className="text-lg font-bold">
                {isLoading ? '...' : formatCurrency(userData.networkEarnings)}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Wallet Balance</p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {isLoading ? '...' : formatCurrency(userData.walletBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
