'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import type { Role, Permission, CreateRoleInput } from '@/lib/models/role';
import { PERMISSION_LABELS } from '@/lib/models/role';
import type { Locale } from '@/i18n/config';
import { Loader2 } from 'lucide-react';

interface RoleFormProps {
  role?: Role;
  lang: Locale;
  onSuccess?: () => void;
  copy: {
    form: {
      nameLabel: string;
      namePlaceholder: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      permissionsLabel: string;
      permissionsDescription: string;
      save: string;
      saving: string;
      cancel: string;
    };
    toast: {
      createSuccess: string;
      createError: string;
      updateSuccess: string;
      updateError: string;
    };
  };
}

export function RoleForm({ role, lang, onSuccess, copy }: RoleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateRoleInput>({
    name: role?.name || '',
    description: role?.description || '',
    permissions: role?.permissions || [],
  });

  const handlePermissionToggle = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;

      if (role) {
        // Update existing role
        response = await adminApi.put(`/api/admin/roles/${role.id}`, formData);
      } else {
        // Create new role
        response = await adminApi.post('/api/admin/roles', formData);
      }

      if (!response.ok) {
        throw new Error('Failed to save role');
      }

      toast({
        title: role ? copy.toast.updateSuccess : copy.toast.createSuccess,
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/admin/roles?lang=${lang}`);
        router.refresh();
      }
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        title: role ? copy.toast.updateError : copy.toast.createError,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allPermissions: Permission[] = [
    'view_dashboard',
    'manage_users',
    'manage_products',
    'manage_orders',
    'manage_payments',
    'manage_plans',
    'manage_content',
    'manage_settings',
    'view_reports',
    'manage_security',
    'manage_roles',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{copy.form.nameLabel}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={copy.form.namePlaceholder}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{copy.form.descriptionLabel}</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={copy.form.descriptionPlaceholder}
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label>{copy.form.permissionsLabel}</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {copy.form.permissionsDescription}
            </p>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {allPermissions.map((permission) => (
              <div key={permission} className="flex items-center space-x-2">
                <Checkbox
                  id={permission}
                  checked={formData.permissions.includes(permission)}
                  onCheckedChange={() => handlePermissionToggle(permission)}
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor={permission}
                  className="text-sm font-normal cursor-pointer"
                >
                  {PERMISSION_LABELS[permission][lang]}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || formData.permissions.length === 0}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? copy.form.saving : copy.form.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/admin/roles?lang=${lang}`)}
          disabled={isSubmitting}
        >
          {copy.form.cancel}
        </Button>
      </div>
    </form>
  );
}

