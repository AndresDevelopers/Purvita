'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/app/components/language-switcher';
import { ThemeSwitcher } from '@/app/components/theme-switcher';
import { supabase } from '@/lib/supabase';
import type { AdminSidebarMenuItem } from '../types/menu-types';
import type { Locale } from '@/i18n/config';

interface AdminSidebarCopy {
  title: string;
  subtitle: string;
  languageLabel: string;
}

interface AdminSidebarViewProps {
  menuItems: AdminSidebarMenuItem[];
  copy: AdminSidebarCopy;
  homeHref: string;
  lang: Locale;
}


const iconByMenuId: Record<AdminSidebarMenuItem['id'], React.JSX.Element> = {
  dashboard: (
    <svg className="text-primary" height="24" viewBox="0 0 256 256" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm0 160H40V56h176v144ZM176 88a48 48 0 0 1-96 0a8 8 0 0 1 16 0a32 32 0 0 0 64 0a8 8 0 0 1 16 0Z" fill="currentColor" />
    </svg>
  ),
  products: (
    <svg className="text-background-dark/80 dark:text-background-light/80" height="24" viewBox="0 0 256 256" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="m216 88-79.6 42.92a16.13 16.13 0 0 1-16.8 0L40 88V56l80 42.66L200 56l14.34 7.69a8 8 0 0 1 4.33 11Z" fill="currentColor" opacity=".2" />
      <path d="M224 48H32a8 8 0 0 0-8 8v136a8 8 0 0 0 8 8h192a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm-8 144H40V64l82.67 44.1a8 8 0 0 0 7.34 0L216 64ZM40 56h176l-85.34 45.5a16.13 16.13 0 0 1-16.8 0L40 56Z" fill="currentColor" />
    </svg>
  ),
  orders: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 7.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5v-13" />
      <path d="M7 3h10l4 4H3l4-4Z" />
      <path d="M7 12h4" />
      <path d="M7 16h7" />
    </svg>
  ),
  warehouse: (
    <svg
      className="text-background-dark/80 dark:text-background-light/80"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 7l9-5l9 5v11a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3H8v3a2 2 0 0 1-2 2H3V7Z" />
      <path d="M9 22v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
      <path d="M8 10h8" />
    </svg>
  ),
  videos: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect width="15" height="14" x="1" y="5" rx="2" ry="2"></rect>
    </svg>
  ),
  users: (
    <svg className="text-background-dark/80 dark:text-background-light/80" height="24" viewBox="0 0 256 256" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M117.25 157.92a60 60 0 1 0-66.5 0A95.83 95.83 0 0 0 3.53 195.63a8 8 0 1 0 13.4 8.74a80 80 0 0 1 134.14 0a8 8 0 0 0 13.4-8.74A95.83 95.83 0 0 0 117.25 157.92ZM40 108a44 44 0 1 1 44 44a44.05 44.05 0 0 1-44-44Zm210.14 98.7a8 8 0 0 1-11.07-2.33A79.83 79.83 0 0 0 172 168a8 8 0 0 1 0-16a44 44 0 1 0-16.34-84.87a8 8 0 1 1-5.94-14.85a60 60 0 0 1 55.53 105.64a95.83 95.83 0 0 1 47.22 37.71a8 8 0 0 1-1.33 11.07Z" fill="currentColor" />
    </svg>
  ),
  roles: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="M9 12l2 2 4-4"></path>
    </svg>
  ),
  pays: (
    <svg className="text-background-dark/80 dark:text-background-light/80" height="24" viewBox="0 0 256 256" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M232 56v152a8 8 0 0 1-11.58 7.15L192 200.94l-28.42 14.21a8 8 0 0 1-7.16 0L128 200.94l-28.42 14.21a8 8 0 0 1-7.16 0L64 200.94L35.58 215.15A8 8 0 0 1 24 208V56a16 16 0 0 1 16-16h176a16 16 0 0 1 16 16ZM216 56H40v139.06l20.42-10.21a8 8 0 0 1 7.16 0L96 199.06l28.42-14.21a8 8 0 0 1 7.16 0L160 199.06l28.42-14.21a8 8 0 0 1 7.16 0L216 195.06Z" fill="currentColor" />
    </svg>
  ),
  plans: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>
  ),
  paymentHistory: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <rect width="18" height="14" x="3" y="5" rx="2"></rect>
      <path d="M16 3v4"></path>
      <path d="M8 3v4"></path>
      <path d="M3 11h18"></path>
      <path d="M10 15h4"></path>
    </svg>
  ),
  salesHistory: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h18v18H3z"></path>
      <path d="M3 9h18"></path>
      <path d="M9 21V9"></path>
      <path d="M12 12h3"></path>
      <path d="M12 16h3"></path>
    </svg>
  ),
  broadcasts: (
    <svg
      className="text-background-dark/80 dark:text-background-light/80"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 5h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 4V7a2 2 0 0 1 2-2Z"></path>
      <path d="M12 9h8"></path>
      <path d="M12 13h5"></path>
      <path d="M6 9h.01"></path>
      <path d="M6 13h.01"></path>
    </svg>
  ),
  seo: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10,9 9,9 8,9"></polyline>
    </svg>
  ),
  pages: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="12" y1="11" x2="8" y2="11"></line>
      <line x1="16" y1="15" x2="8" y2="15"></line>
      <line x1="16" y1="19" x2="8" y2="19"></line>
    </svg>
  ),
  siteContent: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6h16M4 12h16M4 18h16"></path>
    </svg>
  ),
  appSettings: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.51.94V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
    </svg>
  ),
  siteStatus: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 6v6l4 2"></path>
      <circle cx="12" cy="12" r="10"></circle>
    </svg>
  ),
  contactSettings: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 12h-4"></path>
      <path d="M2 12h4"></path>
      <path d="M18 6V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"></path>
      <path d="M18 18v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2"></path>
      <rect height="8" width="12" x="6" y="8" rx="2"></rect>
      <path d="M10 12h4"></path>
    </svg>
  ),
  emailNotifications: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
      <path d="M12 13l-8 5"></path>
      <path d="M12 13l8 5"></path>
    </svg>
  ),
  tutorials: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
    </svg>
  ),
  marketing: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 2l-4 4"></path>
      <path d="M18 2l4 4"></path>
    </svg>
  ),
  advertisingScripts: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>
    </svg>
  ),
  security: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  ),
  uploadLimits: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  ),
  auditLogs: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  support: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  affiliates: (
    <svg className="text-background-dark/80 dark:text-background-light/80" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <line x1="20" y1="8" x2="20" y2="14"></line>
      <line x1="23" y1="11" x2="17" y2="11"></line>
    </svg>
  ),
};



export const AdminSidebarView = ({
  menuItems,
  copy,
  homeHref,
  lang
}: AdminSidebarViewProps) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.push(`/${lang}`);
  };

  return (
    <Sidebar
      collapsible="icon"
      className="flex w-64 flex-col border-r border-primary/20 bg-background-light dark:border-primary/30 dark:bg-background-dark"
      data-testid="admin-sidebar"
      aria-label="Admin navigation sidebar"
    >
      <SidebarHeader className="p-6">
        <Link href={homeHref} className="flex items-center gap-2" data-testid="admin-home-link">
          <h1 className="text-xl font-bold text-background-dark dark:text-background-light">{copy.title}</h1>
        </Link>
        <p className="text-sm text-background-dark/60 dark:text-background-light/60">{copy.subtitle}</p>
      </SidebarHeader>
      <SidebarContent className="flex-1 space-y-2 px-4" role="navigation" aria-label="Admin menu">
        {menuItems.map((item) => {
          const isExternal = item.href.startsWith('http');
          const Component = isExternal ? 'a' : Link;
          const props = isExternal
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: item.href };

          return (
            <Component
              key={item.id}
              {...props}
              className={`flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-colors ${item.active
                  ? 'bg-primary/20 text-background-dark dark:text-background-light'
                  : 'text-background-dark/80 hover:bg-primary/10 dark:text-background-light/80 dark:hover:bg-primary/20'
                }`}
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              data-testid={`admin-menu-${item.id}`}
              aria-label={`Navigate to ${item.label}`}
              aria-current={item.active ? 'page' : undefined}
            >
              {iconByMenuId[item.id]}
              <span>{item.label}</span>
            </Component>
          );
        })}
      </SidebarContent>
      <div className="mt-auto p-4 flex gap-2" data-testid="admin-sidebar-footer">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-background-dark/80 hover:bg-primary/10 dark:text-background-light/80 dark:hover:bg-primary/20"
          aria-label="Cerrar sesión"
          data-testid="admin-logout-button"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </Sidebar>
  );
};
