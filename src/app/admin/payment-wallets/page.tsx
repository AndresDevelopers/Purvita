'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Save, Plus, Building2, Bitcoin, DollarSign, CreditCard, Trash2 } from 'lucide-react';
import type { PaymentWallet, PaymentProvider } from '@/modules/payment-wallets/domain/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

const PROVIDER_OPTIONS: { value: PaymentProvider; label: string; icon: React.ReactNode }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer / Transferencia Bancaria', icon: <Building2 className="h-4 w-4" /> },
  { value: 'usdt_trc20', label: 'USDT (TRC20)', icon: <Bitcoin className="h-4 w-4" /> },
  { value: 'usdt_erc20', label: 'USDT (ERC20)', icon: <Bitcoin className="h-4 w-4" /> },
  { value: 'bitcoin', label: 'Bitcoin (BTC)', icon: <Bitcoin className="h-4 w-4" /> },
  { value: 'ethereum', label: 'Ethereum (ETH)', icon: <Bitcoin className="h-4 w-4" /> },
  { value: 'zelle', label: 'Zelle', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'cash_app', label: 'Cash App', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'venmo', label: 'Venmo', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'western_union', label: 'Western Union', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'moneygram', label: 'MoneyGram', icon: <CreditCard className="h-4 w-4" /> },
];

export default function PaymentWalletsPage() {
  const [wallets, setWallets] = useState<PaymentWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<PaymentWallet | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('bank_transfer');
  const { toast } = useToast();

  const loadWallets = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/payment-wallets');
      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets || []);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment wallets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const handleUpdate = async (wallet: PaymentWallet) => {
    setSaving(wallet.id);

    try {
      // ✅ SECURITY: Use adminApi.patch() to automatically include CSRF token
      const { adminApi } = await import('@/lib/utils/admin-csrf-helpers');
      const response = await adminApi.patch(`/api/admin/payment-wallets/${wallet.id}`, wallet);

      if (!response.ok) {
        throw new Error('Failed to update wallet');
      }

      toast({
        title: 'Success',
        description: 'Payment wallet updated successfully',
      });

      loadWallets();
    } catch (error) {
      console.error('Failed to update wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payment wallet',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const updateWallet = (id: string, field: keyof PaymentWallet, value: any) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  const handleCreate = async () => {
    setCreating(true);

    try {
      const providerOption = PROVIDER_OPTIONS.find(p => p.value === selectedProvider);
      const newWallet = {
        provider: selectedProvider,
        wallet_name: providerOption?.label || selectedProvider,
        wallet_address: null,
        is_active: false,
        min_amount_cents: 1000,
        max_amount_cents: 1000000,
        instructions: {},
        metadata: {},
      };

      const response = await fetch('/api/admin/payment-wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWallet),
      });

      if (!response.ok) {
        throw new Error('Failed to create wallet');
      }

      toast({
        title: 'Success',
        description: 'Payment method created successfully',
      });

      setShowCreateDialog(false);
      loadWallets();
    } catch (error) {
      console.error('Failed to create wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to create payment method',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!walletToDelete) return;

    setDeleting(walletToDelete.id);

    try {
      // ✅ SECURITY: Use adminApi.delete() to automatically include CSRF token
      const response = await adminApi.delete(`/api/admin/payment-wallets/${walletToDelete.id}`);

      if (!response.ok) {
        throw new Error('Failed to delete wallet');
      }

      toast({
        title: 'Success',
        description: 'Payment method deleted successfully',
      });

      setShowDeleteDialog(false);
      setWalletToDelete(null);
      loadWallets();
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete payment method',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const confirmDelete = (wallet: PaymentWallet) => {
    setWalletToDelete(wallet);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Wallets Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Configure payment methods for user balance recharges
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Payment Method</DialogTitle>
              <DialogDescription>
                Select the type of payment method you want to add
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Payment Method Type</Label>
                <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as PaymentProvider)}>
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {wallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Payment Methods Configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Click &quot;Add Payment Method&quot; to create your first payment method
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {wallets.map((wallet) => (
          <Card key={wallet.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="h-6 w-6" />
                  <div>
                    <CardTitle>{wallet.wallet_name || wallet.provider}</CardTitle>
                    <CardDescription>{wallet.provider}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${wallet.id}`}>Active</Label>
                    <Switch
                      id={`active-${wallet.id}`}
                      checked={wallet.is_active}
                      onCheckedChange={(checked) => updateWallet(wallet.id, 'is_active', checked)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmDelete(wallet)}
                    disabled={deleting === wallet.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`name-${wallet.id}`}>Display Name</Label>
                  <Input
                    id={`name-${wallet.id}`}
                    value={wallet.wallet_name || ''}
                    onChange={(e) => updateWallet(wallet.id, 'wallet_name', e.target.value)}
                    placeholder="e.g., USDT (TRC20) or Bank of America"
                  />
                </div>

                {wallet.provider === 'bank_transfer' ? (
                  <div className="space-y-2">
                    <Label htmlFor={`account-holder-${wallet.id}`}>Account Holder Name</Label>
                    <Input
                      id={`account-holder-${wallet.id}`}
                      value={(wallet.metadata as any)?.account_holder || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        account_holder: e.target.value
                      })}
                      placeholder="Full name on account"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor={`address-${wallet.id}`}>
                      {wallet.provider.includes('usdt') || wallet.provider === 'bitcoin' || wallet.provider === 'ethereum'
                        ? 'Wallet Address'
                        : 'Account/Username'}
                    </Label>
                    <Input
                      id={`address-${wallet.id}`}
                      value={wallet.wallet_address || ''}
                      onChange={(e) => updateWallet(wallet.id, 'wallet_address', e.target.value)}
                      placeholder={
                        wallet.provider.includes('usdt') || wallet.provider === 'bitcoin' || wallet.provider === 'ethereum'
                          ? 'Enter wallet address'
                          : 'Enter account or username'
                      }
                      className="font-mono text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Bank Transfer Specific Fields */}
              {wallet.provider === 'bank_transfer' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`bank-name-${wallet.id}`}>Bank Name</Label>
                    <Input
                      id={`bank-name-${wallet.id}`}
                      value={(wallet.metadata as any)?.bank_name || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        bank_name: e.target.value
                      })}
                      placeholder="e.g., Bank of America"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`account-number-${wallet.id}`}>Account Number</Label>
                    <Input
                      id={`account-number-${wallet.id}`}
                      value={(wallet.metadata as any)?.account_number || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        account_number: e.target.value
                      })}
                      placeholder="Account number"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`routing-${wallet.id}`}>Routing Number (US) / Sort Code (UK)</Label>
                    <Input
                      id={`routing-${wallet.id}`}
                      value={(wallet.metadata as any)?.routing_number || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        routing_number: e.target.value
                      })}
                      placeholder="9-digit routing number"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`swift-${wallet.id}`}>SWIFT/BIC Code (International)</Label>
                    <Input
                      id={`swift-${wallet.id}`}
                      value={(wallet.metadata as any)?.swift || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        swift: e.target.value
                      })}
                      placeholder="e.g., BOFAUS3N"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`iban-${wallet.id}`}>IBAN (International)</Label>
                    <Input
                      id={`iban-${wallet.id}`}
                      value={(wallet.metadata as any)?.iban || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        iban: e.target.value
                      })}
                      placeholder="e.g., GB29 NWBK 6016 1331 9268 19"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Crypto Specific Fields */}
              {(wallet.provider.includes('usdt') || wallet.provider === 'bitcoin' || wallet.provider === 'ethereum') && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`network-${wallet.id}`}>Network</Label>
                    <Input
                      id={`network-${wallet.id}`}
                      value={(wallet.metadata as any)?.network || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        network: e.target.value
                      })}
                      placeholder="e.g., TRC20, ERC20, Bitcoin"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`qr-${wallet.id}`}>QR Code URL (optional)</Label>
                    <Input
                      id={`qr-${wallet.id}`}
                      value={(wallet.metadata as any)?.qr_code_url || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        qr_code_url: e.target.value
                      })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              {/* Other Payment Methods (Zelle, Cash App, etc.) */}
              {(wallet.provider === 'zelle' || wallet.provider === 'cash_app' || wallet.provider === 'venmo') && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`phone-${wallet.id}`}>Phone Number</Label>
                    <Input
                      id={`phone-${wallet.id}`}
                      value={(wallet.metadata as any)?.phone || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        phone: e.target.value
                      })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`email-${wallet.id}`}>Email</Label>
                    <Input
                      id={`email-${wallet.id}`}
                      type="email"
                      value={(wallet.metadata as any)?.email || ''}
                      onChange={(e) => updateWallet(wallet.id, 'metadata', {
                        ...wallet.metadata,
                        email: e.target.value
                      })}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`min-${wallet.id}`}>Minimum Amount (USD)</Label>
                  <Input
                    id={`min-${wallet.id}`}
                    type="number"
                    step="0.01"
                    value={wallet.min_amount_cents / 100}
                    onChange={(e) =>
                      updateWallet(wallet.id, 'min_amount_cents', Math.round(parseFloat(e.target.value) * 100))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`max-${wallet.id}`}>Maximum Amount (USD)</Label>
                  <Input
                    id={`max-${wallet.id}`}
                    type="number"
                    step="0.01"
                    value={wallet.max_amount_cents / 100}
                    onChange={(e) =>
                      updateWallet(wallet.id, 'max_amount_cents', Math.round(parseFloat(e.target.value) * 100))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`instructions-en-${wallet.id}`}>Instructions (English)</Label>
                <Textarea
                  id={`instructions-en-${wallet.id}`}
                  value={wallet.instructions?.en || ''}
                  onChange={(e) =>
                    updateWallet(wallet.id, 'instructions', {
                      ...wallet.instructions,
                      en: e.target.value,
                    })
                  }
                  placeholder="Instructions for users in English"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`instructions-es-${wallet.id}`}>Instructions (Spanish)</Label>
                <Textarea
                  id={`instructions-es-${wallet.id}`}
                  value={wallet.instructions?.es || ''}
                  onChange={(e) =>
                    updateWallet(wallet.id, 'instructions', {
                      ...wallet.instructions,
                      es: e.target.value,
                    })
                  }
                  placeholder="Instrucciones para usuarios en español"
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleUpdate(wallet)}
                  disabled={saving === wallet.id}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving === wallet.id ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{walletToDelete?.wallet_name || walletToDelete?.provider}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setWalletToDelete(null);
              }}
              disabled={deleting !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting !== null}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
