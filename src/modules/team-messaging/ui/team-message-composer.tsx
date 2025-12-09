'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { TeamMessagingClientModuleFactory } from '../factories/team-messaging-client-module';

export interface TeamMessageComposerCopy {
  action: string;
  actionAria: string;
  dialog: {
    title: string;
    bodyLabel: string;
    placeholder: string;
    cancel: string;
    send: string;
    sending: string;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
    validationError: string;
  };
}

interface TeamMessageComposerProps {
  recipient: { id: string; email: string };
  copy: TeamMessageComposerCopy;
}

export const TeamMessageComposer = ({ recipient, copy }: TeamMessageComposerProps) => {
  const { toast } = useToast();
  const messagingModule = useMemo(() => TeamMessagingClientModuleFactory.create(), []);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBody('');
    }
    setOpen(next);
  };

  const resolveTitle = () => {
    return copy.dialog.title.replace('{{email}}', recipient.email);
  };

  const resolveActionLabel = () => {
    return copy.action.replace('{{email}}', recipient.email);
  };

  const resolveActionAria = () => {
    return copy.actionAria.replace('{{email}}', recipient.email);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!body.trim()) {
      toast({
        variant: 'destructive',
        title: copy.dialog.errorTitle,
        description: copy.dialog.validationError,
      });
      return;
    }

    setSending(true);
    try {
      await messagingModule.service.sendMessage({ recipientId: recipient.id, body });
      toast({
        title: copy.dialog.successTitle,
        description: copy.dialog.successDescription,
      });
      setBody('');
      setOpen(false);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : copy.dialog.errorDescription;
      toast({
        variant: 'destructive',
        title: copy.dialog.errorTitle,
        description,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        className="min-h-[44px] min-w-[44px]"
        aria-label={resolveActionAria()}
      >
        {resolveActionLabel()}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resolveTitle()}</DialogTitle>
          <DialogDescription>{copy.dialog.bodyLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={copy.dialog.placeholder}
            minLength={1}
            maxLength={2_000}
            rows={6}
            className="text-base"
          />
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
              {copy.dialog.cancel}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? copy.dialog.sending : copy.dialog.send}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
