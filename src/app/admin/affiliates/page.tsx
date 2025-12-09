'use client';

import { use, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { AffiliateSettingsForm } from './affiliate-settings-form';
import AdminGuard from '@/components/admin-guard';

interface AdminAffiliatesPageProps {
    searchParams: Promise<{ lang?: Locale }>;
}

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminAffiliatesPage({ searchParams }: AdminAffiliatesPageProps) {
    const params = use(searchParams);
    const lang = params.lang || 'en';

    return (
        <AdminGuard lang={lang} requiredPermission="manage_settings">
            <AdminAffiliatesPageContent lang={lang} />
        </AdminGuard>
    );
}

function AdminAffiliatesPageContent({ lang }: { lang: Locale }) {
    const { branding } = useSiteBranding();
    const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);

    // Use dictionary if available, otherwise fallback to defaults
    const dictCopy = (dictionary?.admin as any)?.affiliates || {};

    const copy = {
        title: dictCopy.title ?? 'Affiliate Settings',
        description: dictCopy.description ?? 'Configure dynamic profit percentages for store owners, sponsors, and the MLM network.',
        storeOwnerDiscount: dictCopy.storeOwnerDiscount ?? 'Store Owner Profit',
        storeOwnerDiscountDesc: dictCopy.storeOwnerDiscountDesc ?? 'The discount or profit margin the store owner gets when selling a product.',
        discountType: dictCopy.discountType ?? 'Profit Type',
        discountValue: dictCopy.discountValue ?? 'Profit Value',
        sponsorCommission: dictCopy.sponsorCommission ?? 'Direct Sponsor Commission',
        sponsorCommissionDesc: dictCopy.sponsorCommissionDesc ?? 'Percentage of the sale that goes to the direct sponsor.',
        networkCommission: dictCopy.networkCommission ?? 'Network Commission',
        networkCommissionDesc: dictCopy.networkCommissionDesc ?? 'Percentage of the sale that goes to the upline network.',
        save: dictCopy.save ?? 'Save Configuration',
        saving: dictCopy.saving ?? 'Saving...',
        success: dictCopy.success ?? 'Settings saved successfully.',
        error: dictCopy.error ?? 'Failed to save settings.',
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="font-headline text-3xl sm:text-4xl">{copy.title}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    {copy.description}
                </p>
            </div>
            <AffiliateSettingsForm copy={copy} />
        </div>
    );
}
