'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Plus, Minus } from 'lucide-react';

interface WalletManagerProps {
  userId: string;
  userName: string;
  currentBalance?: number;
  onBalanceUpdated?: () => void;
}

type TransactionType = 'add' | 'deduct';
type TransactionReason = 'admin_adjustment' | 'phase_bonus' | 'withdrawal' | 'sale_commission';

export function WalletManager({ userId, userName, currentBalance = 0, onBalanceUpdated }: WalletManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<TransactionReason>('admin_adjustment');
  const [note, setNote] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid positive amount.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const amountCents = Math.round(amountValue * 100) * (transactionType === 'add' ? 1 : -1);

      const response = await fetch('/api/admin/wallet/add-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          amountCents,
          reason,
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update wallet');
      }

      toast({
        title: 'Success',
        description: data.message || 'Wallet updated successfully',
      });

      // Reset form
      setAmount('');
      setNote('');
      setReason('admin_adjustment');
      setTransactionType('add');
      setOpen(false);

      // Notify parent component
      if (onBalanceUpdated) {
        onBalanceUpdated();
      }
    } catch (error) {
      console.error('Failed to update wallet:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update wallet',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wallet className="mr-2 h-4 w-4" />
          Manage Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Wallet Balance</DialogTitle>
          <DialogDescription>
            Add or deduct funds from {userName}&apos;s wallet. Current balance: {formatCurrency(currentBalance)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="transaction-type">Transaction Type</Label>
              <Select
                value={transactionType}
                onValueChange={(value) => setTransactionType(value as TransactionType)}
              >
                <SelectTrigger id="transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4 text-green-600" />
                      Add Funds
                    </div>
                  </SelectItem>
                  <SelectItem value="deduct">
                    <div className="flex items-center">
                      <Minus className="mr-2 h-4 w-4 text-red-600" />
                      Deduct Funds
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Select value={reason} onValueChange={(value) => setReason(value as TransactionReason)}>
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_adjustment">Admin Adjustment</SelectItem>
                  <SelectItem value="phase_bonus">Phase Bonus</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="sale_commission">Sale Commission</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">Note (Optional)</Label>
              <Textarea
                id="note"
                placeholder="Add a note about this transaction..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing...' : transactionType === 'add' ? 'Add Funds' : 'Deduct Funds'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
