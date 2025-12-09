'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';

interface BlockedAccount {
  id: string;
  user_id: string;
  reason: string;
  fraud_type: string;
  blocked_at: string;
  blocked_by: string;
  expires_at: string | null;
  notes: string | null;
  user_email?: string;
  user_name?: string;
}

interface BlockedAccountsManagementProps {
  copy: any;
}

export const BlockedAccountsManagement = ({ copy }: BlockedAccountsManagementProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [userLookupError, setUserLookupError] = useState('');
  
  const [formData, setFormData] = useState({
    user_id: '',
    user_email: '',
    user_name: '',
    reason: '',
    fraud_type: 'other',
    expires_at: '',
    permanent: true,
    notes: '',
  });

  const fetchBlockedAccounts = useCallback(async () => {
    try {
      setLoading(true);
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/security/blocked-accounts');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching blocked accounts:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: copy.toast?.error ?? 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [copy, toast]);

  useEffect(() => {
    fetchBlockedAccounts();
  }, [fetchBlockedAccounts]);

  const handleLookupUser = async () => {
    if (!userIdInput.trim()) return;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userIdInput.trim())) {
      setUserLookupError('Invalid User ID format. Must be a valid UUID.');
      return;
    }
    
    try {
      setLookingUpUser(true);
      setUserLookupError('');
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userIdInput.trim())}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setUserLookupError('User not found with this ID');
        } else {
          setUserLookupError('Failed to lookup user');
        }
        return;
      }
      
      const data = await response.json();
      const user = data.profile || data;
      setFormData({
        ...formData,
        user_id: user.id,
        user_email: user.email || '',
        user_name: user.name || user.full_name || '',
      });
      setUserLookupError('');
    } catch (error) {
      console.error('Error looking up user:', error);
      setUserLookupError('Failed to lookup user');
    } finally {
      setLookingUpUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await adminApi.post('/api/admin/security/blocked-accounts', {
        user_id: formData.user_id,
        reason: formData.reason,
        fraud_type: formData.fraud_type,
        expires_at: formData.permanent ? null : formData.expires_at || null,
        notes: formData.notes || null,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to block account' }));
        throw new Error(error.error || error.message || 'Failed to block account');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.accountBlocked ?? 'Account blocked successfully',
      });

      setDialogOpen(false);
      setFormData({
        user_id: '',
        user_email: '',
        user_name: '',
        reason: '',
        fraud_type: 'other',
        expires_at: '',
        permanent: true,
        notes: '',
      });
      setUserIdInput('');
      setUserLookupError('');
      fetchBlockedAccounts();
    } catch (error) {
      console.error('Error blocking account:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (id: string) => {
    if (!confirm(copy.confirmUnblock ?? 'Are you sure?')) return;

    try {
      const response = await adminApi.delete(`/api/admin/security/blocked-accounts/${id}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to unblock account' }));
        throw new Error(error.error || error.message || 'Failed to unblock account');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.accountUnblocked ?? 'Account unblocked successfully',
      });

      fetchBlockedAccounts();
    } catch (error) {
      console.error('Error unblocking account:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    }
  };

  const getFraudTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      payment_fraud: 'destructive',
      chargeback_abuse: 'destructive',
      account_takeover: 'destructive',
      velocity_abuse: 'default',
      multiple_accounts: 'default',
      synthetic_identity: 'secondary',
      other: 'secondary',
    };
    return colors[type] || 'default';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{copy.title ?? 'Blocked Accounts'}</CardTitle>
            <CardDescription>{copy.description ?? 'Manage blocked user accounts'}</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {copy.blockButton ?? 'Block Account'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{copy.form?.title ?? 'Block User Account'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* User ID Input */}
                  <div className="space-y-2">
                    <Label>{copy.form?.userId ?? 'User ID'}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={userIdInput}
                        onChange={(e) => {
                          setUserIdInput(e.target.value);
                          setUserLookupError('');
                        }}
                        placeholder="Enter user UUID..."
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupUser())}
                        className="font-mono text-sm"
                      />
                      <Button type="button" onClick={handleLookupUser} disabled={lookingUpUser}>
                        {lookingUpUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    {userLookupError && (
                      <p className="text-sm text-destructive">{userLookupError}</p>
                    )}
                    {formData.user_id && formData.user_email && (
                      <div className="text-sm p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="font-medium text-green-800 dark:text-green-200">User found:</p>
                        <p className="text-green-700 dark:text-green-300">{formData.user_email}</p>
                        {formData.user_name && (
                          <p className="text-green-600 dark:text-green-400">{formData.user_name}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">{copy.form?.reason ?? 'Reason'}</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fraud-type">{copy.form?.fraudType ?? 'Fraud Type'}</Label>
                    <Select value={formData.fraud_type} onValueChange={(value) => setFormData({ ...formData, fraud_type: value })}>
                      <SelectTrigger id="fraud-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(copy.fraudTypes || {}).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="permanent"
                      checked={formData.permanent}
                      onCheckedChange={(checked) => setFormData({ ...formData, permanent: checked })}
                    />
                    <Label htmlFor="permanent">{copy.form?.permanent ?? 'Permanent Block'}</Label>
                  </div>

                  {!formData.permanent && (
                    <div className="space-y-2">
                      <Label htmlFor="expires">{copy.form?.expiresAt ?? 'Expires At'}</Label>
                      <Input
                        id="expires"
                        type="datetime-local"
                        value={formData.expires_at}
                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {copy.form?.cancel ?? 'Cancel'}
                  </Button>
                  <Button type="submit" disabled={submitting || !formData.user_id}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {copy.form?.submit ?? 'Block Account'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No blocked accounts found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.table?.user ?? 'User'}</TableHead>
                  <TableHead>{copy.table?.reason ?? 'Reason'}</TableHead>
                  <TableHead>{copy.table?.fraudType ?? 'Fraud Type'}</TableHead>
                  <TableHead className="hidden md:table-cell">{copy.table?.blockedAt ?? 'Blocked At'}</TableHead>
                  <TableHead className="hidden lg:table-cell">{copy.table?.expiresAt ?? 'Expires At'}</TableHead>
                  <TableHead>{copy.table?.actions ?? 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.user_email || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{account.user_name || ''}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{account.reason}</TableCell>
                    <TableCell>
                      <Badge variant={getFraudTypeBadge(account.fraud_type) as any}>
                        {copy.fraudTypes?.[account.fraud_type] || account.fraud_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(account.blocked_at), 'PPp')}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {account.expires_at ? format(new Date(account.expires_at), 'PPp') : 'Permanent'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleUnblock(account.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{copy.unblock ?? 'Unblock'}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
