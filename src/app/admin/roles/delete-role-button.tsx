'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { Locale } from '@/i18n/config';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface DeleteRoleButtonProps {
  roleId: string;
  roleName: string;
  lang: Locale;
  copy: {
    deleteLabel: string;
    dialogTitle: string;
    dialogDescription: string;
    confirmLabel: string;
    cancelLabel: string;
    successMessage: string;
    errorMessage: string;
  };
}

export function DeleteRoleButton({ roleId, roleName, lang: _lang, copy }: DeleteRoleButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await adminApi.delete(`/api/admin/roles/${roleId}`);

      if (!response.ok) {
        throw new Error('Failed to delete role');
      }

      toast({
        title: copy.successMessage,
      });

      router.refresh();
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: copy.errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setIsOpen(true);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {copy.deleteLabel}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.dialogDescription}
            <br />
            <strong className="mt-2 block">{roleName}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {copy.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? '...' : copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

