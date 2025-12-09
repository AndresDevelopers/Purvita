'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, AlertTriangle, Shield, ShieldX, ShieldCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface FraudAlert {
  id: string;
  user_id: string;
  risk_score: number;
  risk_level: string;
  status: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  risk_factors?: any[];
  fraud_stats?: any;
}

interface FraudAlertsManagementProps {
  copy: any;
}

export const FraudAlertsManagement = ({ copy }: FraudAlertsManagementProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/security/fraud-alerts');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
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
    fetchAlerts();
  }, [fetchAlerts]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await adminApi.patch(`/api/admin/security/fraud-alerts/${id}`, { status });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update' }));
        throw new Error(error.error || error.message || 'Failed to update');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.alertUpdated ?? 'Alert updated successfully',
      });

      fetchAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      case 'minimal': return 'outline';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'reviewed': return 'secondary';
      case 'cleared': return 'outline';
      case 'confirmed_fraud': return 'destructive';
      default: return 'default';
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (riskFilter !== 'all' && alert.risk_level !== riskFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title ?? 'Fraud Detection Alerts'}</CardTitle>
        <CardDescription>{copy.description ?? 'Monitor and review suspicious activities'}</CardDescription>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={copy.filters?.status ?? 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(copy.status || {}).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <SelectValue placeholder={copy.filters?.riskLevel ?? 'Risk Level'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                {Object.entries(copy.riskLevel || {}).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No fraud alerts found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.table?.user ?? 'User'}</TableHead>
                  <TableHead>{copy.table?.riskScore ?? 'Risk Score'}</TableHead>
                  <TableHead>{copy.table?.riskLevel ?? 'Risk Level'}</TableHead>
                  <TableHead>{copy.table?.status ?? 'Status'}</TableHead>
                  <TableHead className="hidden md:table-cell">{copy.table?.createdAt ?? 'Detected At'}</TableHead>
                  <TableHead>{copy.table?.actions ?? 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => {
                  // Check if this is a threat intelligence alert
                  const isThreatIntelAlert = alert.risk_factors?.some(
                    (factor: any) => factor.type === 'malicious_ip'
                  );
                  const ipAddress = alert.fraud_stats?.ipAddress;
                  const detectedSources = alert.fraud_stats?.detectedSources;

                  return (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{alert.user_email || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">{alert.user_name || ''}</span>
                          {isThreatIntelAlert && ipAddress && (
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                <Shield className="h-3 w-3 mr-1" />
                                Malicious IP: {ipAddress}
                              </Badge>
                            </div>
                          )}
                          {detectedSources && detectedSources.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Detected by: {detectedSources.join(', ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{alert.risk_score.toFixed(2)}</span>
                          {alert.risk_score >= 0.8 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRiskLevelColor(alert.risk_level) as any}>
                          {copy.riskLevel?.[alert.risk_level] || alert.risk_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(alert.status) as any}>
                          {copy.status?.[alert.status] || alert.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(alert.created_at), 'PPp')}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-1">
                            {alert.status === 'pending' && (
                              <>
                                {/* Mark as Reviewed - Eye icon */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateStatus(alert.id, 'reviewed')}
                                    >
                                      <Eye className="h-4 w-4 text-blue-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copy.markReviewed ?? 'Mark as Reviewed'}</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Clear Alert (Not Fraud) - Green shield with check */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateStatus(alert.id, 'cleared')}
                                    >
                                      <ShieldCheck className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copy.markCleared ?? 'Not Fraud - Clear Alert'}</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Confirm Fraud - Red shield with X */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateStatus(alert.id, 'confirmed_fraud')}
                                    >
                                      <ShieldX className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copy.confirmFraud ?? 'Confirm as Fraud'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            {alert.status === 'reviewed' && (
                              <>
                                {/* Clear Alert (Not Fraud) */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateStatus(alert.id, 'cleared')}
                                    >
                                      <ShieldCheck className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copy.markCleared ?? 'Not Fraud - Clear Alert'}</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Confirm Fraud */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateStatus(alert.id, 'confirmed_fraud')}
                                    >
                                      <ShieldX className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copy.confirmFraud ?? 'Confirm as Fraud'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
