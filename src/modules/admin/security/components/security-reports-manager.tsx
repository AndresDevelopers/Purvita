'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Mail, Calendar, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface Schedule {
  id: string;
  frequency: string;
  recipients: string[];
  format: string;
  is_active: boolean;
  next_run_at: string | null;
  created_at: string;
}

export const SecurityReportsManager = () => {
  const { toast } = useToast();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [existingSchedules, setExistingSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  // Fetch existing schedules on mount
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const response = await adminApi.get('/api/admin/security/reports/schedules');
      if (response.ok) {
        const data = await response.json();
        setExistingSchedules(data.schedules || []);
        
        // Pre-fill form with existing schedule if any
        if (data.schedules && data.schedules.length > 0) {
          const firstSchedule = data.schedules[0];
          setScheduleFrequency(firstSchedule.frequency);
          setScheduleRecipients(firstSchedule.recipients.join(', '));
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await adminApi.delete(`/api/admin/security/reports/schedules/${scheduleId}`);

      if (!response.ok) {
        throw new Error('Failed to delete schedule');
      }

      toast({
        title: 'Schedule Deleted',
        description: 'The report schedule has been removed',
      });

      // Refresh schedules and clear form
      setScheduleRecipients('');
      await fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch(
        `/api/admin/security/reports?period=${period}&format=${format}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      if (format === 'csv') {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Report Generated',
          description: 'CSV report downloaded successfully',
        });
      } else {
        // Download JSON file
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${period}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Report Generated',
          description: 'JSON report downloaded successfully',
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate security report',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleReport = async () => {
    try {
      setIsScheduling(true);

      const recipients = scheduleRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (recipients.length === 0) {
        toast({
          title: 'Error',
          description: 'Please enter at least one email address',
          variant: 'destructive',
        });
        return;
      }

      const response = await adminApi.post('/api/admin/security/reports', {
        frequency: scheduleFrequency,
        recipients,
        format: 'email',
      });

      if (!response.ok) {
        throw new Error('Failed to schedule report');
      }

      toast({
        title: 'Report Scheduled',
        description: `${scheduleFrequency} reports will be sent to ${recipients.length} recipient(s)`,
      });

      // Refresh schedules to show the saved configuration
      await fetchSchedules();
    } catch (error) {
      console.error('Error scheduling report:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule security report',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <CardTitle>Generate Security Report</CardTitle>
          </div>
          <CardDescription>
            Generate a comprehensive security report for a specific time period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-period">Report Period</Label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger id="report-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (Last 24 hours)</SelectItem>
                  <SelectItem value="weekly">Weekly (Last 7 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (Last 30 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-format">Format</Label>
              <Select value={format} onValueChange={(value: any) => setFormat(value)}>
                <SelectTrigger id="report-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate & Download Report'}
          </Button>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Report Includes:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Total security events and critical event count</li>
              <li>Suspicious activities with severity levels</li>
              <li>Top threats and affected users</li>
              <li>Blocked IPs and fraud alerts</li>
              <li>Automated recommendations based on activity</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Automatic Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <CardTitle>Schedule Automatic Reports</CardTitle>
          </div>
          <CardDescription>
            Receive security reports automatically via email on a regular schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-frequency">Frequency</Label>
            <Select
              value={scheduleFrequency}
              onValueChange={(value: any) => setScheduleFrequency(value)}
            >
              <SelectTrigger id="schedule-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-recipients">Email Recipients</Label>
            <Input
              id="schedule-recipients"
              type="text"
              placeholder="admin@example.com, security@example.com"
              value={scheduleRecipients}
              onChange={(e) => setScheduleRecipients(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter email addresses separated by commas
            </p>
          </div>

          <Button onClick={handleScheduleReport} disabled={isScheduling} className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            {isScheduling ? 'Scheduling...' : 'Save Schedule'}
          </Button>

          {/* Active Schedules */}
          {loadingSchedules ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : existingSchedules.length > 0 ? (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-200">Active Schedules</span>
              </div>
              <div className="space-y-3">
                {existingSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-start justify-between gap-2">
                    <div className="text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          {schedule.frequency}
                        </Badge>
                        <span>→</span>
                        <span>{schedule.recipients.join(', ')}</span>
                      </div>
                      {schedule.next_run_at && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Next run: {new Date(schedule.next_run_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Email sending functionality requires proper email service configuration.
              Reports are currently logged to the console. Configure your email provider (SendGrid, AWS SES, etc.)
              to enable email delivery.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
