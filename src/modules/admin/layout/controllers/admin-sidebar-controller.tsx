'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { useAdminSidebar } from '../hooks/use-admin-sidebar';
import { AdminSidebarView } from '../views/admin-sidebar-view';
import type { MenuId, AdminSidebarMenuItem, AdminDictionary } from '../types/menu-types';
import type { Permission } from '@/lib/models/role';

interface AdminSidebarControllerProps {
  lang: Locale;
}

const getMenuLabel = (dict: AdminDictionary, menuId: MenuId): string => {
  const entry = dict?.admin?.[menuId];

  if (typeof entry === 'string') {
    return entry;
  }

  if (entry && typeof entry === 'object') {
    return (entry as any).menuLabel ?? (entry as any).title ?? menuId;
  }

  return menuId;
};

// Map each menu id to the permissions required to see it in the sidebar.
// If a menu id is not present here, any admin with access_admin_panel can see it.
const MENU_PERMISSIONS: Partial<Record<MenuId, Permission[]>> = {
  products: ['manage_products'],
  orders: ['manage_orders'],
  warehouse: ['manage_orders'],
  videos: ['manage_content'],
  users: ['manage_users'],
  roles: ['manage_roles'],
  pays: ['manage_payments'],
  plans: ['manage_plans'],
  paymentHistory: ['manage_payments', 'view_reports'],
  salesHistory: ['view_reports'],
  broadcasts: ['manage_content'],
  seo: ['manage_content'],
  pages: ['manage_content'],
  siteContent: ['manage_content'],
  appSettings: ['manage_settings'],
  siteStatus: ['manage_settings'],
  contactSettings: ['manage_settings'],
  emailNotifications: ['manage_settings'],
  tutorials: ['manage_content'],
  marketing: ['manage_content'],
  advertisingScripts: ['manage_content'],
  security: ['manage_security'],
  uploadLimits: ['manage_settings'],
  auditLogs: ['view_audit_logs'],
  affiliates: ['manage_settings'],
};

const hasMenuAccess = (
  menuId: MenuId,
  permissions: Permission[] | null | undefined
): boolean => {
  const required = MENU_PERMISSIONS[menuId];

  // If no specific permissions are configured, any admin can see it.
  if (!required || required.length === 0) {
    return true;
  }

  // While permissions are still loading, keep current behaviour (show items);
  // page-level guards and API checks will still enforce security.
  if (!permissions) {
    return true;
  }

  return required.some((permission) => permissions.includes(permission));
};

const getMenuItems = (
  dict: AdminDictionary,
  lang: Locale,
  pathname: string,
  permissions: Permission[] | null | undefined
): AdminSidebarMenuItem[] => {
  const baseItems: Array<{ id: MenuId; baseHref: string }> = [
    { id: 'dashboard', baseHref: '/admin/dashboard' },
    { id: 'products', baseHref: '/admin/products' },
    { id: 'orders', baseHref: '/admin/orders' },
    { id: 'warehouse', baseHref: '/admin/bodega' },
    { id: 'videos', baseHref: '/admin/videos' },
    { id: 'users', baseHref: '/admin/users' },
    { id: 'roles', baseHref: '/admin/roles' },
    { id: 'pays', baseHref: '/admin/pays' },
    { id: 'plans', baseHref: '/admin/plans' },
    { id: 'paymentHistory', baseHref: '/admin/payments/history' },
    { id: 'salesHistory', baseHref: '/admin/sales-history' },
    { id: 'broadcasts', baseHref: '/admin/messages' },
    { id: 'seo', baseHref: '/admin/seo' },
    { id: 'pages', baseHref: '/admin/pages' },
    { id: 'siteContent', baseHref: '/admin/site-content' },
    { id: 'appSettings', baseHref: '/admin/app-settings' },
    { id: 'affiliates', baseHref: '/admin/affiliates' },
    { id: 'contactSettings', baseHref: '/admin/contact-settings' },
    { id: 'emailNotifications', baseHref: '/admin/email-notifications' },
    { id: 'siteStatus', baseHref: '/admin/site-status' },
    { id: 'tutorials', baseHref: '/admin/tutorials' },
    { id: 'marketing', baseHref: '/admin/marketing' },
    { id: 'advertisingScripts', baseHref: '/admin/advertising-scripts' },
    { id: 'security', baseHref: '/admin/security' },
    { id: 'uploadLimits', baseHref: '/admin/upload-limits' },
    { id: 'auditLogs', baseHref: '/admin/audit-logs' },
    { id: 'support', baseHref: 'https://tawk.to/chat/68e8fef849de86194fcd0a31/1j778hs4o' },
  ];

  return baseItems
    .filter((item) => hasMenuAccess(item.id, permissions))
    .map((item) => ({
      id: item.id,
      label: getMenuLabel(dict, item.id),
      href: `${item.baseHref}?lang=${lang}`,
      active: pathname === item.baseHref,
    }));
};

export const AdminSidebarController = ({ lang }: AdminSidebarControllerProps) => {
  const pathname = usePathname();
  const { branding } = useSiteBranding();
  const dict = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const { isAuthenticated, permissions } = useAdminSidebar();

  const menuItems = useMemo(
    () => getMenuItems(dict, lang, pathname, permissions),
    [dict, lang, pathname, permissions]
  );
  const homeHref = isAuthenticated ? `/${lang}/dashboard` : `/${lang}`;

  const copy = {
    title: dict?.appName ?? 'PurVita Admin',
    subtitle: dict?.admin?.dashboard ?? 'Dashboard',
    languageLabel: lang === 'es' ? 'Idioma' : 'Language',
  };

  return (
    <AdminSidebarView
      menuItems={menuItems}
      copy={copy}
      homeHref={homeHref}
      lang={lang}
    />
  );
};
