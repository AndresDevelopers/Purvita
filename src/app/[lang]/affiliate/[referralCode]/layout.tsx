import { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { getAdminSecurityConfig } from '@/lib/security/admin-security-config';
import { AffiliateSecurityWrapper } from './affiliate-security-wrapper';

interface AffiliateLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: Locale; referralCode: string }>;
}

/**
 * Layout for affiliate pages
 * Applies admin security configurations including session timeout
 */
export default async function AffiliateLayout({ children, params }: AffiliateLayoutProps) {
  const { lang } = await params;

  // Get security configuration from admin panel
  const securityConfig = await getAdminSecurityConfig();

  return (
    <AffiliateSecurityWrapper
      timeoutMinutes={securityConfig.sessionTimeoutMinutes}
      warningMinutes={securityConfig.sessionWarningMinutes}
      lang={lang}
    >
      {children}
    </AffiliateSecurityWrapper>
  );
}

