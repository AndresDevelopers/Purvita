'use client';

import { useState, use } from 'react';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';

interface PasswordPageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

export default function PasswordPage({ params }: PasswordPageProps) {
  const { lang } = use(params);
  const _dict = useAppDictionary();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ SECURITY: Rate limiting for password changes (3 attempts per minute)
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ SECURITY: Check rate limiting (3 attempts per minute)
    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (now - lastAttemptTime > oneMinute) {
      // Reset counter if more than 1 minute has passed
      setAttemptCount(0);
      setLastAttemptTime(now);
    }

    if (attemptCount >= 3) {
      const timeLeft = Math.ceil((oneMinute - (now - lastAttemptTime)) / 1000);
      toast({
        title: 'Error',
        description: `Too many attempts. Please wait ${timeLeft} seconds before trying again.`,
        variant: 'destructive'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters long' });
      return;
    }

    setAttemptCount(prev => prev + 1);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // ✅ SECURITY: Reset attempt counter on success
      setAttemptCount(0);
      setLastAttemptTime(0);

      toast({ title: 'Success', description: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">Change Password</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">Update your password for better security.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="current-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Enter current password"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Enter new password"
                required
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Must be at least 8 characters long, contain a number, and a special character.</p>
            </div>
            <div>
              <Label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border-black/20 dark:border-white/20 bg-white dark:bg-background-dark focus:ring-primary focus:border-primary transition-colors"
                placeholder="Confirm new password"
                required
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} className="w-full md:w-auto px-6 py-3 bg-primary text-background-dark font-bold rounded-lg hover:opacity-90 transition-opacity">
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}