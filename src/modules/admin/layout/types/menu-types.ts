export type MenuId =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'warehouse'
  | 'videos'
  | 'users'
  | 'roles'
  | 'pays'
  | 'plans'
  | 'paymentHistory'
  | 'salesHistory'
  | 'broadcasts'
  | 'seo'
  | 'pages'
  | 'siteContent'
  | 'appSettings'
  | 'siteStatus'
  | 'contactSettings'
  | 'emailNotifications'
  | 'tutorials'
  | 'marketing'
  | 'advertisingScripts'
  | 'security'
  | 'uploadLimits'
  | 'auditLogs'
  | 'affiliates'
  | 'support';

export interface AdminSidebarMenuItem {
  id: MenuId;
  label: string;
  href: string;
  active: boolean;
}

export interface AdminDictionary {
  appName: string;
  admin?: {
    [key: string]: unknown;
  };
}
