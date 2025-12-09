'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Check, X, ExternalLink } from 'lucide-react';
import type { PaymentRequestWithWallet } from '@/modules/payment-wallets/domain/types';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function PaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequestWithWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequestWithWallet | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/payment-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setProcessing(true);

    try {
      const response = await fetch(`/api/admin/payment-requests/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminNotes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve request');
      }

      toast({
        title: 'Success',
        description: 'Payment request approved and balance credited',
      });

      setSelectedRequest(null);
      setActionType(null);
      setAdminNotes('');
      loadRequests();
    } catch (error) {
      console.error('Failed to approve request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !adminNotes.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/admin/payment-requests/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: adminNotes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject request');
      }

      toast({
        title: 'Success',
        description: 'Payment request rejected',
      });

      setSelectedRequest(null);
      setActionType(null);
      setAdminNotes('');
      loadRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      rejected: 'destructive',
      expired: 'outline',
    };

    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'processing');
  const completedRequests = requests.filter((r) => r.status === 'completed' || r.status === 'rejected');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Payment Requests</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Review and approve user balance recharge requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests ({pendingRequests.length})</CardTitle>
          <CardDescription>Requests waiting for review</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="grid gap-4 md:hidden">
            {pendingRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No pending requests
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="rounded-lg border bg-card px-4 py-5 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{request.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground break-all">{request.user?.email}</p>
                      </div>
                      <span className="text-lg font-bold text-primary">{formatCurrency(request.amount_cents)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1">{request.wallet.wallet_name || request.wallet.provider}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(request.created_at)}</p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[80px]"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType('approve');
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[80px]"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType('reject');
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      {request.payment_proof_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(request.payment_proof_url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No pending requests
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.user?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{request.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(request.amount_cents)}</TableCell>
                      <TableCell>{request.wallet.wallet_name || request.wallet.provider}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm">{formatDate(request.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType('approve');
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType('reject');
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          {request.payment_proof_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(request.payment_proof_url!, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent History</CardTitle>
          <CardDescription>Completed and rejected requests</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="grid gap-4 md:hidden">
            {completedRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No history yet
              </div>
            ) : (
              completedRequests.slice(0, 10).map((request) => (
                <div key={request.id} className="rounded-lg border bg-card px-4 py-4 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{request.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground break-all">{request.user?.email}</p>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(request.amount_cents)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1">{request.wallet.wallet_name || request.wallet.provider}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {request.processed_at ? formatDate(request.processed_at) : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedRequests.slice(0, 10).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.user?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{request.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(request.amount_cents)}</TableCell>
                    <TableCell>{request.wallet.wallet_name || request.wallet.provider}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-sm">
                      {request.processed_at ? formatDate(request.processed_at) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setAdminNotes('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Payment Request' : 'Reject Payment Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  User: {selectedRequest.user?.name || selectedRequest.user?.email}
                  <br />
                  Amount: {formatCurrency(selectedRequest.amount_cents)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest?.payment_proof_url && (
            <div className="space-y-2">
              <Label>Payment Proof</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(selectedRequest.payment_proof_url!, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Payment Proof
              </Button>
            </div>
          )}

          {selectedRequest?.transaction_hash && (
            <div className="space-y-2">
              <Label>Transaction Hash</Label>
              <p className="text-sm font-mono bg-muted p-2 rounded">{selectedRequest.transaction_hash}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-notes">
              {actionType === 'approve' ? 'Notes (Optional)' : 'Rejection Reason (Required)'}
            </Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={
                actionType === 'approve'
                  ? 'Add any notes about this approval...'
                  : 'Explain why this request is being rejected...'
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setAdminNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={actionType === 'approve' ? handleApprove : handleReject}
              disabled={processing || (actionType === 'reject' && !adminNotes.trim())}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {processing ? 'Processing...' : actionType === 'approve' ? 'Approve & Credit' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
