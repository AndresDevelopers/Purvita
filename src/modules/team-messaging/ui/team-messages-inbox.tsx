'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Trash2, ArrowLeft, Filter } from 'lucide-react';
import { useTeamMessagingState } from '../hooks/use-team-messaging-state';
import { useTeamMessagingHaptics } from '../hooks/use-team-messaging-haptics';
import type { TeamMessageThread } from '../domain/models/team-message';
import { getSafeSession } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type MessageFilter = 'all' | 'unread' | 'read';

export interface TeamMessagesCopy {
  title: string;
  description: string;
  loading: string;
  retry: string;
  errorTitle: string;
  errorDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  threadListLabel: string;
  conversationLabel: string;
  noSelectionTitle: string;
  noSelectionDescription: string;
  reply: {
    label: string;
    placeholder: string;
    send: string;
    sending: string;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
  };
  delete: {
    button: string;
    confirmTitle: string;
    confirmDescription: string;
    confirm: string;
    cancel: string;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
  };
  deleteThread: {
    button: string;
    confirmTitle: string;
    confirmDescription: string;
    confirm: string;
    cancel: string;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
  };
  filter: {
    label: string;
    all: string;
    unread: string;
    read: string;
  };
  helper: string;
  refresh: string;
  meta: {
    you: string;
    sentOn: string;
    receivedOn: string;
  };
  tabUnreadA11y: string;
}

interface TeamMessagesInboxProps {
  lang: Locale;
  copy: TeamMessagesCopy;
  onUnreadCountChange?: (count: number) => void;
}

const formatDate = (value: string, lang: Locale) => {
  try {
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const findRecipient = (thread: TeamMessageThread, currentUserId: string | null) => {
  if (!currentUserId) {
    return null;
  }

  return thread.members.find((member) => member.id !== currentUserId) ?? null;
};

export const TeamMessagesInbox = ({ lang, copy, onUnreadCountChange }: TeamMessagesInboxProps) => {
  const { toast } = useToast();
  const { threads, loading, error, reload, service, eventBus } = useTeamMessagingState();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [_hasManuallyDeselected, setHasManuallyDeselected] = useState(false);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);

  useTeamMessagingHaptics(eventBus);

  useEffect(() => {
    const controller = new AbortController();

    const resolveSession = async () => {
      try {
        const {
          data: { session },
        } = await getSafeSession();
        if (controller.signal.aborted) {
          return;
        }
        setCurrentUserId(session?.user?.id ?? null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setCurrentUserId(null);
      }
    };

    void resolveSession();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!onUnreadCountChange) {
      return;
    }

    const totalUnread = threads.reduce((count, thread) => count + thread.unreadCount, 0);
    onUnreadCountChange(totalUnread);
  }, [threads, onUnreadCountChange]);

  useEffect(() => {
    return () => {
      onUnreadCountChange?.(0);
    };
  }, [onUnreadCountChange]);

  const filteredThreads = useMemo(() => {
    if (messageFilter === 'all') {
      return threads;
    }
    if (messageFilter === 'unread') {
      return threads.filter((thread) => thread.unreadCount > 0);
    }
    if (messageFilter === 'read') {
      return threads.filter((thread) => thread.unreadCount === 0);
    }
    return threads;
  }, [threads, messageFilter]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const handleSelectThread = useCallback(async (thread: TeamMessageThread) => {
    setSelectedThreadId(thread.threadId);
    setHasManuallyDeselected(false);

    const unread = thread.messages
      .filter((message) => message.recipientId === currentUserId && !message.readAt)
      .map((message) => message.id);

    if (unread.length > 0 && currentUserId) {
      try {
        await service.markMessagesAsRead(unread);
      } catch (markError) {
        const description =
          markError instanceof Error ? markError.message : copy.reply.errorDescription;
        toast({
          variant: 'destructive',
          title: copy.reply.errorTitle,
          description,
        });
      }
    }
  }, [currentUserId, service, copy, toast]);

  const handleBackToList = () => {
    setSelectedThreadId(null);
    setHasManuallyDeselected(true);
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete) {
      return;
    }

    const thread = threads.find((t) => t.threadId === threadToDelete);
    if (!thread) {
      return;
    }

    setDeletingThread(true);

    try {
      // Delete all messages in the thread that belong to the current user
      const messagesToDelete = thread.messages
        .filter((message) => message.senderId === currentUserId)
        .map((message) => message.id);

      // Delete messages one by one
      for (const messageId of messagesToDelete) {
        await service.deleteMessage(messageId);
      }

      toast({
        title: copy.deleteThread.successTitle,
        description: copy.deleteThread.successDescription,
      });

      setThreadToDelete(null);

      // If the deleted thread was selected, go back to list
      if (selectedThreadId === threadToDelete) {
        handleBackToList();
      }
    } catch (deleteError) {
      const description =
        deleteError instanceof Error ? deleteError.message : copy.deleteThread.errorDescription;
      toast({
        variant: 'destructive',
        title: copy.deleteThread.errorTitle,
        description,
      });
    } finally {
      setDeletingThread(false);
    }
  };

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedThread || !currentUserId) {
      return;
    }

    if (!replyBody.trim()) {
      toast({
        variant: 'destructive',
        title: copy.reply.errorTitle,
        description: copy.reply.errorDescription,
      });
      return;
    }

    const recipient = findRecipient(selectedThread, currentUserId);
    if (!recipient) {
      toast({
        variant: 'destructive',
        title: copy.reply.errorTitle,
        description: copy.reply.errorDescription,
      });
      return;
    }

    // Prevenir envío múltiple
    if (sending) {
      return;
    }

    setSending(true);

    try {
      await service.sendMessage({
        recipientId: recipient.id,
        body: replyBody,
        parentMessageId: selectedThread.threadId,
      });
      setReplyBody('');
      toast({
        title: copy.reply.successTitle,
        description: copy.reply.successDescription,
      });
    } catch (sendError) {
      const description =
        sendError instanceof Error ? sendError.message : copy.reply.errorDescription;
      toast({
        variant: 'destructive',
        title: copy.reply.errorTitle,
        description,
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) {
      return;
    }

    setDeleting(true);

    try {
      await service.deleteMessage(messageToDelete);
      toast({
        title: copy.delete.successTitle,
        description: copy.delete.successDescription,
      });
      setMessageToDelete(null);
    } catch (deleteError) {
      const description =
        deleteError instanceof Error ? deleteError.message : copy.delete.errorDescription;
      toast({
        variant: 'destructive',
        title: copy.delete.errorTitle,
        description,
      });
    } finally {
      setDeleting(false);
    }
  };

  const renderThreads = () => {
    if (loading) {
      return (
        <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {copy.loading}
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-slate-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
            <p className="font-semibold">{copy.errorTitle}</p>
            <p className="mt-1 text-sm">{copy.errorDescription}</p>
          </div>
          <Button onClick={reload} variant="outline">
            {copy.retry}
          </Button>
        </div>
      );
    }

    if (threads.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 text-center text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <p className="text-lg font-semibold">{copy.emptyTitle}</p>
          <p className="mt-1 text-sm">{copy.emptyDescription}</p>
          <Button className="mt-4" onClick={reload} variant="outline">
            {copy.refresh}
          </Button>
        </div>
      );
    }

    if (filteredThreads.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200/60 bg-white/60 p-6 text-center text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <p className="text-lg font-semibold">{copy.emptyTitle}</p>
          <p className="mt-1 text-sm">
            {messageFilter === 'unread'
              ? 'No unread messages'
              : messageFilter === 'read'
              ? 'No read messages'
              : copy.emptyDescription}
          </p>
        </div>
      );
    }

    return (
      <ScrollArea className="max-h-[420px] pr-2">
        <ul className="space-y-3">
          {filteredThreads.map((thread) => {
            const unread = thread.unreadCount > 0;
            const other = findRecipient(thread, currentUserId);
            const lastMessage = thread.messages[thread.messages.length - 1];
            const isLastMessageOwn = lastMessage.senderId === currentUserId;
            return (
              <li key={thread.threadId} className="group relative">
                <button
                  type="button"
                  onClick={() => handleSelectThread(thread)}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left transition-all',
                    'border-slate-200/70 bg-white/70 hover:border-emerald-400/80 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-400/50',
                    selectedThreadId === thread.threadId &&
                      'border-emerald-500/70 shadow-md dark:border-emerald-400/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {other?.name || other?.email || copy.meta.you}
                        </p>
                        {unread && (
                          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(thread.lastMessageAt, lang)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className={cn('font-medium', isLastMessageOwn && 'text-emerald-600 dark:text-emerald-400')}>
                      {isLastMessageOwn ? `${copy.meta.you}: ` : ''}
                    </span>
                    {lastMessage.body}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setThreadToDelete(thread.threadId);
                  }}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-red-400"
                  title={copy.deleteThread.button}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    );
  };

  const renderConversation = () => {
    if (!selectedThread) {
      return null;
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {copy.helper}
        </div>
        <ScrollArea className="max-h-[420px] rounded-2xl border border-slate-200/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="space-y-4">
            {selectedThread.messages.map((message) => {
              const isOwn = message.senderId === currentUserId;
              const timestamp = isOwn
                ? copy.meta.sentOn.replace('{{date}}', formatDate(message.createdAt, lang))
                : copy.meta.receivedOn.replace('{{date}}', formatDate(message.createdAt, lang));
              return (
                <div key={message.id} className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                  <div className="group relative">
                    <div
                      className={cn(
                        'max-w-full rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-lg',
                        isOwn
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-white',
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => setMessageToDelete(message.id)}
                        className="absolute -right-8 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-red-400"
                        title={copy.delete.button}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-1 text-xs text-slate-500 dark:text-slate-400',
                      isOwn ? 'mr-1' : 'ml-1',
                    )}
                  >
                    {timestamp}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <form onSubmit={handleReply} className="space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {copy.reply.label}
          </p>
          <Textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder={copy.reply.placeholder}
            rows={4}
            maxLength={2_000}
            className="text-base"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => reload()}>
              {copy.refresh}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? copy.reply.sending : copy.reply.send}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <>
      <Card>
        {!selectedThreadId || !selectedThread ? (
          <>
            <CardHeader>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {copy.threadListLabel}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        {copy.filter.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setMessageFilter('all')}>
                        {copy.filter.all}
                        {messageFilter === 'all' && ' ✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMessageFilter('unread')}>
                        {copy.filter.unread}
                        {messageFilter === 'unread' && ' ✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMessageFilter('read')}>
                        {copy.filter.read}
                        {messageFilter === 'read' && ' ✓'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {renderThreads()}
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToList}
                  className="flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-lg">
                    {findRecipient(selectedThread, currentUserId)?.name ||
                     findRecipient(selectedThread, currentUserId)?.email ||
                     copy.meta.you}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedThread.messages.length} {selectedThread.messages.length === 1 ? 'message' : 'messages'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {renderConversation()}
            </CardContent>
          </>
        )}
      </Card>

      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.delete.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.delete.confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{copy.delete.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? copy.reply.sending : copy.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!threadToDelete} onOpenChange={(open) => !open && setThreadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteThread.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.deleteThread.confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingThread}>{copy.deleteThread.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              disabled={deletingThread}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingThread ? copy.reply.sending : copy.deleteThread.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
