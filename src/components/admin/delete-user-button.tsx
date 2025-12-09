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

interface DeleteUserButtonProps {
    userId: string;
    userName: string;
    deleteLabel: string;
    lang: Locale;
    dict?: {
        confirmTitle?: string;
        confirmDescription?: string;
        cancel?: string;
        deleteButton?: string;
        deleting?: string;
        successMessage?: string;
        errorMessage?: string;
    };
}

export function DeleteUserButton({ userId, userName, deleteLabel, lang: _lang, dict }: DeleteUserButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await adminApi.delete(`/api/admin/users/${userId}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to delete user' }));
                throw new Error(error.error || error.message || 'Failed to delete user');
            }

            toast({
                title: 'Success',
                description: dict?.successMessage || 'User deleted successfully',
            });
            setOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : (dict?.errorMessage || 'Failed to delete user'),
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={(e) => {
                        e.preventDefault();
                        setOpen(true);
                    }}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleteLabel}
                </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{dict?.confirmTitle || 'Are you sure?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {dict?.confirmDescription || (
                            <>
                                This will permanently delete <strong>{userName}</strong> and all associated data including:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Profile information</li>
                                    <li>Avatar images</li>
                                    <li>Subscription data</li>
                                    <li>Wallet transactions</li>
                                    <li>Network earnings</li>
                                </ul>
                                This action cannot be undone.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                        {dict?.cancel || 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                        aria-label={`Delete user ${userName}`}
                    >
                        {isDeleting ? (dict?.deleting || 'Deleting...') : (dict?.deleteButton || 'Delete User')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
