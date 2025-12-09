'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription as _DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Shield, Eye, AlertTriangle, Globe, Bot, Clock, Info } from 'lucide-react';
import { format } from 'date-fns';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ThreatSource {
  name: string;
  isThreat: boolean;
  threatType?: string;
  confidence?: number;
}

interface ThreatInfo {
  autoBlocked: boolean;
  threatSummary?: string;
  confidence?: string | number;
  sources?: ThreatSource[];
  metadata?: {
    requestPath?: string;
    requestMethod?: string;
    userAgent?: string;
    userId?: string;
  };
  blockedAt?: string;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string | null;
  notes: string | null;
  blocked_by: string | null;
}

interface BlockedIPsManagementProps {
  copy: any;
}

// Helper function to parse threat info from notes
const parseThreatInfo = (notes: string | null): ThreatInfo | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed.autoBlocked) {
      return parsed as ThreatInfo;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper to get source icon/color
const getSourceBadgeStyle = (sourceName: string) => {
  const name = sourceName.toLowerCase();
  if (name.includes('virustotal')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
  if (name.includes('abuse') || name.includes('urlhaus') || name.includes('threatfox')) {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }
  if (name.includes('google') || name.includes('safe')) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
};

// Helper to get confidence badge style
const getConfidenceBadgeStyle = (confidence: string | number) => {
  const score = typeof confidence === 'string' ? 
    (confidence === 'high' ? 90 : confidence === 'medium' ? 60 : 30) : 
    confidence;
  
  if (score >= 80) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (score >= 60) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
};

export const BlockedIPsManagement = ({ copy }: BlockedIPsManagementProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ips, setIps] = useState<BlockedIP[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedIP, setSelectedIP] = useState<BlockedIP | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    ip_address: '',
    reason: '',
    expires_at: '',
    permanent: true,
    notes: '',
  });

  const fetchBlockedIPs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/security/blocked-ips');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setIps(data);
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
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
    fetchBlockedIPs();
  }, [fetchBlockedIPs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // Convert datetime-local format to ISO 8601 format
      let expiresAt: string | null = null;
      if (!formData.permanent && formData.expires_at) {
        expiresAt = new Date(formData.expires_at).toISOString();
      }
      
      const response = await adminApi.post('/api/admin/security/blocked-ips', {
        ip_address: formData.ip_address,
        reason: formData.reason,
        expires_at: expiresAt,
        notes: formData.notes || null,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to block IP' }));
        // Handle Zod validation errors
        if (errorData.details && Array.isArray(errorData.details)) {
          const validationErrors = errorData.details.map((d: any) => d.message).join(', ');
          throw new Error(validationErrors || errorData.error || 'Invalid data');
        }
        throw new Error(errorData.error || errorData.message || 'Failed to block IP');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.ipBlocked ?? 'IP blocked successfully',
      });

      setDialogOpen(false);
      setFormData({
        ip_address: '',
        reason: '',
        expires_at: '',
        permanent: true,
        notes: '',
      });
      fetchBlockedIPs();
    } catch (error) {
      console.error('Error blocking IP:', error);
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
    if (!confirm(copy.confirmUnblock ?? 'Are you sure you want to unblock this IP?')) return;

    try {
      const response = await adminApi.delete(`/api/admin/security/blocked-ips/${id}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to unblock IP' }));
        throw new Error(error.error || error.message || 'Failed to unblock IP');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.ipUnblocked ?? 'IP unblocked successfully',
      });

      fetchBlockedIPs();
    } catch (error) {
      console.error('Error unblocking IP:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (ip: BlockedIP) => {
    setSelectedIP(ip);
    setDetailsDialogOpen(true);
  };

  // Render threat details dialog
  const renderDetailsDialog = () => {
    if (!selectedIP) return null;
    const threatInfo = parseThreatInfo(selectedIP.notes);

    return (
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {copy.details?.title || 'IP Block Details'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {copy.details?.basicInfo || 'Basic Information'}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{copy.table?.ip || 'IP Address'}:</span>
                    <p className="font-mono font-medium">{selectedIP.ip_address}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{copy.details?.type || 'Type'}:</span>
                    <div className="mt-1">
                      {threatInfo?.autoBlocked ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <Bot className="h-3 w-3 mr-1" />
                          {copy.details?.autoBlocked || 'Auto-blocked'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{copy.details?.manual || 'Manual'}</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{copy.table?.blockedAt || 'Blocked At'}:</span>
                    <p>{format(new Date(selectedIP.blocked_at), 'PPpp')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{copy.table?.expiresAt || 'Expires At'}:</span>
                    <p>{selectedIP.expires_at ? format(new Date(selectedIP.expires_at), 'PPpp') : (copy.details?.permanent || 'Permanent')}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">{copy.table?.reason || 'Reason'}:</span>
                  <p className="text-sm mt-1">{selectedIP.reason}</p>
                </div>
              </div>

              {threatInfo && (
                <>
                  <Separator />
                  
                  {/* Threat Summary */}
                  {threatInfo.threatSummary && (
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        {copy.details?.threatSummary || 'Threat Summary'}
                      </h4>
                      <p className="text-sm bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        {threatInfo.threatSummary}
                      </p>
                    </div>
                  )}

                  {/* Confidence */}
                  {threatInfo.confidence && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">{copy.details?.confidence || 'Confidence Level'}</h4>
                      <Badge className={getConfidenceBadgeStyle(threatInfo.confidence)}>
                        {typeof threatInfo.confidence === 'number' 
                          ? `${threatInfo.confidence}%` 
                          : threatInfo.confidence.charAt(0).toUpperCase() + threatInfo.confidence.slice(1)}
                      </Badge>
                    </div>
                  )}

                  {/* Detection Sources */}
                  {threatInfo.sources && threatInfo.sources.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {copy.details?.detectionSources || 'Detection Sources'}
                      </h4>
                      <div className="space-y-2">
                        {threatInfo.sources.map((source, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-lg border ${
                              source.isThreat 
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                                : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={getSourceBadgeStyle(source.name)}>
                                  {source.name}
                                </Badge>
                                {source.isThreat ? (
                                  <Badge variant="destructive" className="text-xs">
                                    {copy.details?.threatDetected || 'Threat Detected'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-green-700 dark:text-green-300">
                                    {copy.details?.clean || 'Clean'}
                                  </Badge>
                                )}
                              </div>
                              {source.confidence !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {copy.details?.confidence || 'Confidence'}: {source.confidence}%
                                </span>
                              )}
                            </div>
                            {source.threatType && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {copy.details?.threatType || 'Type'}: {source.threatType}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Metadata */}
                  {threatInfo.metadata && Object.keys(threatInfo.metadata).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        {copy.details?.requestMetadata || 'Request Metadata'}
                      </h4>
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
                        {threatInfo.metadata.requestPath && (
                          <div>
                            <span className="text-muted-foreground">{copy.details?.path || 'Path'}:</span>
                            <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">
                              {threatInfo.metadata.requestPath}
                            </code>
                          </div>
                        )}
                        {threatInfo.metadata.requestMethod && (
                          <div>
                            <span className="text-muted-foreground">{copy.details?.method || 'Method'}:</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {threatInfo.metadata.requestMethod}
                            </Badge>
                          </div>
                        )}
                        {threatInfo.metadata.userAgent && (
                          <div>
                            <span className="text-muted-foreground">{copy.details?.userAgent || 'User Agent'}:</span>
                            <p className="text-xs text-muted-foreground mt-1 break-all">
                              {threatInfo.metadata.userAgent}
                            </p>
                          </div>
                        )}
                        {threatInfo.metadata.userId && (
                          <div>
                            <span className="text-muted-foreground">{copy.details?.userId || 'User ID'}:</span>
                            <code className="ml-2 text-xs bg-muted px-1 py-0.5 rounded">
                              {threatInfo.metadata.userId}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Block Timestamp */}
                  {threatInfo.blockedAt && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {copy.details?.blockedTimestamp || 'Blocked at'}: {format(new Date(threatInfo.blockedAt), 'PPpp')}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              {copy.form?.cancel || 'Close'}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setDetailsDialogOpen(false);
                handleUnblock(selectedIP.id);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {copy.unblock || 'Unblock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {copy.addButton}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{copy.form.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip">{copy.form.ipAddress}</Label>
                    <Input
                      id="ip"
                      value={formData.ip_address}
                      onChange={(e) =>
                        setFormData({ ...formData, ip_address: e.target.value })
                      }
                      placeholder="192.168.1.1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">{copy.form.reason}</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) =>
                        setFormData({ ...formData, reason: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="permanent"
                      checked={formData.permanent}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, permanent: checked })
                      }
                    />
                    <Label htmlFor="permanent">{copy.form.permanent}</Label>
                  </div>
                  {!formData.permanent && (
                    <div className="space-y-2">
                      <Label htmlFor="expires">{copy.form.expiresAt}</Label>
                      <Input
                        id="expires"
                        type="datetime-local"
                        value={formData.expires_at}
                        onChange={(e) =>
                          setFormData({ ...formData, expires_at: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    {copy.form.cancel}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {copy.form.submit}
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
        ) : ips.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {copy.noBlockedIps || 'No blocked IPs found'}
          </p>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.table?.ip || 'IP Address'}</TableHead>
                  <TableHead>{copy.table?.reason || 'Reason'}</TableHead>
                  <TableHead>{copy.table?.type || 'Type'}</TableHead>
                  <TableHead>{copy.table?.sources || 'Sources'}</TableHead>
                  <TableHead>{copy.table?.blockedAt || 'Blocked At'}</TableHead>
                  <TableHead>{copy.table?.expiresAt || 'Expires At'}</TableHead>
                  <TableHead>{copy.table?.actions || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ips.map((ip) => {
                  const threatInfo = parseThreatInfo(ip.notes);
                  const isAutoBlock = threatInfo?.autoBlocked === true;
                  const detectedSources = threatInfo?.sources?.filter(s => s.isThreat) || [];

                  return (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate cursor-help">{ip.reason}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px]">
                              <p className="text-sm">{ip.reason}</p>
                            </TooltipContent>
                          </Tooltip>
                          {threatInfo?.confidence && (
                            <Badge className={`text-xs w-fit ${getConfidenceBadgeStyle(threatInfo.confidence)}`}>
                              {typeof threatInfo.confidence === 'number' 
                                ? `${threatInfo.confidence}% ${copy.details?.confidence || 'confidence'}` 
                                : `${threatInfo.confidence} ${copy.details?.confidence || 'confidence'}`}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAutoBlock ? (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            <Bot className="h-3 w-3 mr-1" />
                            {copy.details?.auto || 'Auto'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{copy.details?.manual || 'Manual'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {detectedSources.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {detectedSources.slice(0, 2).map((source, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs cursor-help ${getSourceBadgeStyle(source.name)}`}
                                  >
                                    {source.name.replace('Abuse.ch ', '').replace(' API', '')}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {source.threatType || (copy.details?.threatDetected || 'Threat detected')}
                                    {source.confidence !== undefined && ` (${source.confidence}%)`}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {detectedSources.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{detectedSources.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(ip.blocked_at), 'PP')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ip.blocked_at), 'p')}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ip.expires_at ? (
                          <>
                            {format(new Date(ip.expires_at), 'PP')}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(ip.expires_at), 'p')}
                            </span>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {copy.details?.permanent || 'Permanent'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDetails(ip)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copy.viewDetails || 'View Details'}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUnblock(ip.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copy.unblock || 'Unblock'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>

      {/* Details Dialog */}
      {renderDetailsDialog()}
    </Card>
  );
};
