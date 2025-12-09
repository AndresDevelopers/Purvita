'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Trash2, Plus, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface TrustedAgent {
  id: string;
  name: string;
  description: string | null;
  user_agent_pattern: string | null;
  ip_address: string | null;
  api_key: string | null;
  bypass_captcha: boolean;
  bypass_rate_limiting: boolean;
  bypass_csrf: boolean;
  bypass_csp: boolean;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface TrustedAgentsManagementProps {
  copy: any;
}

export const TrustedAgentsManagement = ({ copy }: TrustedAgentsManagementProps) => {
  const { toast } = useToast();
  const [agents, setAgents] = useState<TrustedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    user_agent_pattern: '',
    ip_address: '',
    api_key: '',
    bypass_captcha: true,
    bypass_rate_limiting: true,
    bypass_csrf: true,
    bypass_csp: false,
    is_active: true,
  });

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/trusted-agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: copy.toast?.error ?? 'Failed to load trusted agents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [copy, toast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one detection method
    if (!formData.user_agent_pattern && !formData.ip_address && !formData.api_key) {
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: copy.validationError ?? 'At least one detection method (User-Agent, IP, or API Key) is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminApi.post('/api/admin/trusted-agents', {
        name: formData.name,
        description: formData.description || null,
        user_agent_pattern: formData.user_agent_pattern || null,
        ip_address: formData.ip_address || null,
        api_key: formData.api_key || null,
        bypass_captcha: formData.bypass_captcha,
        bypass_rate_limiting: formData.bypass_rate_limiting,
        bypass_csrf: formData.bypass_csrf,
        bypass_csp: formData.bypass_csp,
        is_active: formData.is_active,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create agent' }));
        throw new Error(error.error || error.message || 'Failed to create agent');
      }

      const data = await response.json();
      const newAgent = data.agent;

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.agentCreated ?? 'Trusted agent created successfully',
      });

      // Close dialog and reset form
      setDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        user_agent_pattern: '',
        ip_address: '',
        api_key: '',
        bypass_captcha: true,
        bypass_rate_limiting: true,
        bypass_csrf: true,
        bypass_csp: false,
        is_active: true,
      });

      // Add new agent to list
      if (newAgent?.id) {
        setAgents([newAgent, ...agents]);
      } else {
        // Fallback: refetch the list
        fetchAgents();
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'Failed to create agent'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    const agentName = agent?.name || 'this agent';

    if (!confirm(copy.confirmDelete ?? `Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) return;

    try {
      setDeletingId(id);
      const response = await adminApi.delete(`/api/admin/trusted-agents/${id}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete agent' }));
        throw new Error(error.error || error.message || 'Failed to delete agent');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.agentDeleted ?? 'Trusted agent deleted successfully',
      });

      // Optimistic update - remove from UI immediately
      setAgents(agents.filter(agent => agent.id !== id));
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'Failed to delete agent'),
        variant: 'destructive',
      });
      // Refresh on error to ensure consistency
      fetchAgents();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setTogglingId(id);

      // Optimistic update - update UI immediately
      setAgents(agents.map(agent =>
        agent.id === id ? { ...agent, is_active: !currentStatus } : agent
      ));

      const response = await adminApi.patch(`/api/admin/trusted-agents/${id}`, {
        is_active: !currentStatus,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update agent' }));
        throw new Error(error.error || error.message || 'Failed to update agent');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: !currentStatus
          ? (copy.toast?.agentActivated ?? 'Trusted agent activated successfully')
          : (copy.toast?.agentDeactivated ?? 'Trusted agent deactivated successfully'),
      });
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'Failed to update agent'),
        variant: 'destructive',
      });
      // Revert optimistic update on error
      fetchAgents();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {copy.title ?? 'Trusted Agents'}
            </CardTitle>
            <CardDescription>
              {copy.description ?? 'Manage agents that can bypass security protections (Manus, automation tools, etc.)'}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {copy.addButton ?? 'Add Agent'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{copy.dialogTitle ?? 'Add Trusted Agent'}</DialogTitle>
                <DialogDescription>
                  {copy.dialogDescription ?? 'Configure a new trusted agent. At least one detection method is required.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{copy.nameLabel ?? 'Name'} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={copy.namePlaceholder ?? 'e.g., Manus Agent'}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{copy.descriptionLabel ?? 'Description'}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={copy.descriptionPlaceholder ?? 'Optional description'}
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">{copy.detectionMethodsTitle ?? 'Detection Methods (at least one required)'}</h4>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="user_agent_pattern">{copy.userAgentLabel ?? 'User-Agent Pattern (Regex)'}</Label>
                      <Input
                        id="user_agent_pattern"
                        value={formData.user_agent_pattern}
                        onChange={(e) => setFormData({ ...formData, user_agent_pattern: e.target.value })}
                        placeholder={copy.userAgentPlaceholder ?? 'e.g., ^Manus/.*'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ip_address">{copy.ipLabel ?? 'IP Address'}</Label>
                      <Input
                        id="ip_address"
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder={copy.ipPlaceholder ?? 'e.g., 192.168.1.100'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_key">{copy.apiKeyLabel ?? 'API Key'}</Label>
                      <Input
                        id="api_key"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        placeholder={copy.apiKeyPlaceholder ?? 'Optional API key for authentication'}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">{copy.bypassPermissionsTitle ?? 'Bypass Permissions'}</h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bypass_captcha">{copy.bypassCaptchaLabel ?? 'Bypass CAPTCHA'}</Label>
                      <Switch
                        id="bypass_captcha"
                        checked={formData.bypass_captcha}
                        onCheckedChange={(checked) => setFormData({ ...formData, bypass_captcha: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="bypass_rate_limiting">{copy.bypassRateLimitLabel ?? 'Bypass Rate Limiting'}</Label>
                      <Switch
                        id="bypass_rate_limiting"
                        checked={formData.bypass_rate_limiting}
                        onCheckedChange={(checked) => setFormData({ ...formData, bypass_rate_limiting: checked })}
                      />
                    </div>


                    <div className="flex items-center justify-between">
                      <Label htmlFor="bypass_csrf">{copy.bypassCsrfLabel ?? 'Bypass CSRF'}</Label>
                      <Switch
                        id="bypass_csrf"
                        checked={formData.bypass_csrf}
                        onCheckedChange={(checked) => setFormData({ ...formData, bypass_csrf: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="bypass_csp">{copy.bypassCspLabel ?? 'Bypass CSP'}</Label>
                      <Switch
                        id="bypass_csp"
                        checked={formData.bypass_csp}
                        onCheckedChange={(checked) => setFormData({ ...formData, bypass_csp: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active">{copy.isActiveLabel ?? 'Active'}</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    {copy.cancelButton ?? 'Cancel'}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {submitting ? (copy.creatingButton ?? 'Creating...') : (copy.createButton ?? 'Create Agent')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p>{copy.loading ?? 'Loading trusted agents...'}</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {copy.noAgents ?? 'No trusted agents configured'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.tableHeaders?.name ?? 'Name'}</TableHead>
                <TableHead>{copy.tableHeaders?.detection ?? 'Detection'}</TableHead>
                <TableHead>{copy.tableHeaders?.bypass ?? 'Bypass'}</TableHead>
                <TableHead>{copy.tableHeaders?.status ?? 'Status'}</TableHead>
                <TableHead>{copy.tableHeaders?.lastUsed ?? 'Last Used'}</TableHead>
                <TableHead className="text-right">{copy.tableHeaders?.actions ?? 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.description && (
                        <div className="text-sm text-muted-foreground">{agent.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {agent.user_agent_pattern && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">UA</Badge>
                          <span className="text-muted-foreground truncate max-w-[200px]" title={agent.user_agent_pattern}>
                            {agent.user_agent_pattern}
                          </span>
                        </div>
                      )}
                      {agent.ip_address && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">IP</Badge>
                          <span className="text-muted-foreground">{agent.ip_address}</span>
                        </div>
                      )}
                      {agent.api_key && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">API</Badge>
                          <span className="text-muted-foreground">***</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {agent.bypass_captcha && <Badge variant="secondary" className="text-xs">CAPTCHA</Badge>}
                      {agent.bypass_rate_limiting && <Badge variant="secondary" className="text-xs">Rate Limit</Badge>}
                      {agent.bypass_csrf && <Badge variant="secondary" className="text-xs">CSRF</Badge>}
                      {agent.bypass_csp && <Badge variant="secondary" className="text-xs">CSP</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={agent.is_active}
                        onCheckedChange={() => toggleActive(agent.id, agent.is_active)}
                        disabled={togglingId === agent.id}
                      />
                      {togglingId === agent.id ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-sm text-muted-foreground">Updating...</span>
                        </div>
                      ) : (
                        <span className="text-sm">
                          {agent.is_active ? (copy.activeStatus ?? 'Active') : (copy.inactiveStatus ?? 'Inactive')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {agent.last_used_at ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(agent.last_used_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{copy.neverUsed ?? 'Never'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(agent.id)}
                      disabled={deletingId === agent.id}
                    >
                      {deletingId === agent.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

