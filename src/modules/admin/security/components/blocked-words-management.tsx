'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface BlockedWord {
  id: string;
  word: string;
  category: string;
  severity: string;
}

interface BlockedWordsManagementProps {
  copy: any;
}

export const BlockedWordsManagement = ({ copy }: BlockedWordsManagementProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<BlockedWord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    word: '',
    category: 'other',
    severity: 'medium',
  });

  const fetchBlockedWords = useCallback(async () => {
    try {
      setLoading(true);
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get('/api/admin/security/blocked-words');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWords(data);
    } catch (error) {
      console.error('Error fetching blocked words:', error);
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
    fetchBlockedWords();
  }, [fetchBlockedWords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const response = await adminApi.post('/api/admin/security/blocked-words', formData);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to add word' }));
        throw new Error(error.error || error.message || 'Failed to add word');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.wordAdded ?? 'Word added successfully',
      });

      setDialogOpen(false);
      setFormData({ word: '', category: 'other', severity: 'medium' });
      fetchBlockedWords();
    } catch (error) {
      console.error('Error adding word:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(copy.confirmRemove ?? 'Are you sure you want to remove this word?')) return;

    try {
      const response = await adminApi.delete(`/api/admin/security/blocked-words/${id}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to remove word' }));
        throw new Error(error.error || error.message || 'Failed to remove word');
      }

      toast({
        title: copy.toast?.successTitle ?? 'Success',
        description: copy.toast?.wordRemoved ?? 'Word removed successfully',
      });

      fetchBlockedWords();
    } catch (error) {
      console.error('Error removing word:', error);
      toast({
        title: copy.toast?.errorTitle ?? 'Error',
        description: error instanceof Error ? error.message : (copy.toast?.error ?? 'An error occurred'),
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
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
                    <Label htmlFor="word">{copy.form.word}</Label>
                    <Input
                      id="word"
                      value={formData.word}
                      onChange={(e) =>
                        setFormData({ ...formData, word: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">{copy.form.category}</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profanity">{copy.categories.profanity}</SelectItem>
                        <SelectItem value="spam">{copy.categories.spam}</SelectItem>
                        <SelectItem value="hate">{copy.categories.hate}</SelectItem>
                        <SelectItem value="other">{copy.categories.other}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">{copy.form.severity}</Label>
                    <Select
                      value={formData.severity}
                      onValueChange={(value) =>
                        setFormData({ ...formData, severity: value })
                      }
                    >
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{copy.severity.low}</SelectItem>
                        <SelectItem value="medium">{copy.severity.medium}</SelectItem>
                        <SelectItem value="high">{copy.severity.high}</SelectItem>
                        <SelectItem value="critical">{copy.severity.critical}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
        ) : words.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No blocked words found
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.table.word}</TableHead>
                <TableHead>{copy.table.category}</TableHead>
                <TableHead>{copy.table.severity}</TableHead>
                <TableHead>{copy.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {words.map((word) => (
                <TableRow key={word.id}>
                  <TableCell className="font-mono">{word.word}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {copy.categories[word.category as keyof typeof copy.categories]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityColor(word.severity) as any}>
                      {copy.severity[word.severity as keyof typeof copy.severity]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(word.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {copy.remove}
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
