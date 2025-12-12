'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { i18n, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { useSiteBranding } from '@/contexts/site-branding-context';
import {
  LandingContentSchema,
  type LandingContent,
  type LandingFaq,
  type LandingOpportunityPhase,
  type LandingStep,
  type LandingTestimonial,
  type LandingHeaderLink,
  type LandingFooterLink,
  type LandingFooterSocial,
} from '@/modules/site-content/domain/models/landing-content';
import {
  type TeamMember,
} from '@/modules/site-content/domain/models/team-page';
import {
  SiteBrandingSchema,
  type SiteBranding,
} from '@/modules/site-content/domain/models/site-branding';
import type { LandingContentUpdateInput } from '@/modules/site-content/services/site-content-service';
import { supabase, PAGE_BUCKET } from '@/lib/supabase';
import { Loader2, PlusCircle, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import { LinkVisibilityConfig } from './components/link-visibility-config';
import type { LinkVisibilityRules } from '@/modules/site-content/domain/models/landing-content';
import { defaultVisibilityRules } from '@/modules/site-content/domain/models/landing-content';
import {
  type AffiliatePageConfig,
  defaultAffiliatePageConfig,
} from '@/modules/site-content/domain/models/affiliate-page-config';

type BrandingFormState = {
  appName: string;
  logoUrl: string;
  faviconUrl: string;
  description: string;
  showLogo: boolean;
  logoPosition: 'beside' | 'above' | 'below';
  showAppName: boolean;
};

type LandingFormState = LandingContentUpdateInput;

type AffiliateFormState = AffiliatePageConfig;

type HeaderLinkCollection = 'landingLinks' | 'authenticatedLinks';
type FooterLinkCollection = 'navigationLinks' | 'legalLinks';

type FooterBrandingCopy = {
  showLogo?: string;
  showLogoDescription?: string;
  showAppName?: string;
  showAppNameDescription?: string;
  appNameLabel?: string;
  appNamePlaceholder?: string;
  showDescription?: string;
  showDescriptionDescription?: string;
  orientation?: string;
};

const createBrandingState = (branding: SiteBranding): BrandingFormState => ({
  appName: branding.appName,
  logoUrl: branding.logoUrl ?? '',
  faviconUrl: branding.faviconUrl ?? '',
  description: branding.description ?? '',
  showLogo: branding.showLogo,
  logoPosition: branding.logoPosition,
  showAppName: branding.showAppName,
});

const mapStep = (step: LandingStep, index: number): LandingStep => ({
  id: step.id,
  title: step.title,
  description: step.description,
  imageUrl: step.imageUrl ?? '',
  order: index,
});

const mapFaq = (faq: LandingFaq, index: number): LandingFaq => ({
  id: faq.id,
  question: faq.question,
  answer: faq.answer,
  imageUrl: faq.imageUrl ?? '',
  order: index,
});

const mapHeaderLink = (link: LandingHeaderLink, index: number): LandingHeaderLink => ({
  id: link.id,
  label: link.label,
  href: link.href,
  requiresAuth: link.requiresAuth ?? false,
  order: index,
  visibility: link.visibility,
  icon: link.icon ?? null,
  openInNewTab: link.openInNewTab ?? false,
});

const mapFooterLink = (link: LandingFooterLink, index: number): LandingFooterLink => ({
  id: link.id,
  label: link.label,
  href: link.href,
  order: index,
  visibility: link.visibility,
  openInNewTab: link.openInNewTab ?? false,
});

const mapFooterSocial = (
  link: LandingFooterSocial,
  index: number,
): LandingFooterSocial => ({
  id: link.id,
  platform: link.platform,
  label: link.label,
  href: link.href,
  order: index,
});

const mapOpportunityPhase = (
  phase: LandingOpportunityPhase,
  index: number,
): LandingOpportunityPhase => ({
  id: phase.id,
  title: phase.title,
  visibilityTag: phase.visibilityTag ?? '',
  descriptor: phase.descriptor,
  requirement: phase.requirement,
  monthlyInvestment: phase.monthlyInvestment,
  rewards: phase.rewards,
  accountBalanceHighlight: phase.accountBalanceHighlight ?? '',
  commissionHighlight: phase.commissionHighlight,
  order: index,
});

const mapTestimonial = (
  testimonial: LandingTestimonial,
  index: number,
): LandingTestimonial => ({
  id: testimonial.id,
  name: testimonial.name,
  quote: testimonial.quote,
  role: testimonial.role ?? '',
  imageUrl: testimonial.imageUrl ?? '',
  order: index,
});

const createLandingState = (landing: LandingContent): LandingFormState => ({
  hero: {
    title: landing.hero.title,
    subtitle: landing.hero.subtitle,
    style: landing.hero.style ?? 'default',
    backgroundImageUrl: landing.hero.backgroundImageUrl ?? '',
  },
  about: {
    title: landing.about.title,
    description: landing.about.description,
    secondaryDescription: landing.about.secondaryDescription ?? '',
    imageUrl: landing.about.imageUrl ?? '',
  },
  howItWorks: {
    title: landing.howItWorks.title,
    subtitle: landing.howItWorks.subtitle,
    steps: landing.howItWorks.steps.map(mapStep),
  },
  opportunity: {
    title: landing.opportunity.title,
    subtitle: landing.opportunity.subtitle,
    duplicationNote: landing.opportunity.duplicationNote,
    monthlyFee: {
      label: landing.opportunity.monthlyFee.label,
      amount: landing.opportunity.monthlyFee.amount,
      description: landing.opportunity.monthlyFee.description,
    },
    networkCap: landing.opportunity.networkCap,
    phases: landing.opportunity.phases.map(mapOpportunityPhase),
    summary: landing.opportunity.summary ?? null,
  },
  testimonials: {
    title: landing.testimonials.title,
    testimonials: landing.testimonials.testimonials.map(mapTestimonial),
  },
  featuredProducts: {
    title: landing.featuredProducts.title,
    subtitle: landing.featuredProducts.subtitle,
    emptyState: landing.featuredProducts.emptyState,
  },
  contact: {
    title: landing.contact.title,
    description: landing.contact.description,
    contactInfo: {
      phone: landing.contact.contactInfo.phone,
      email: landing.contact.contactInfo.email,
      address: landing.contact.contactInfo.address,
    },
    form: {
      namePlaceholder: landing.contact.form.namePlaceholder,
      emailPlaceholder: landing.contact.form.emailPlaceholder,
      messagePlaceholder: landing.contact.form.messagePlaceholder,
      sendButton: landing.contact.form.sendButton,
    },
    recipientEmail: landing.contact.recipientEmail,
  },
  header: {
    landingLinks: landing.header.landingLinks.map(mapHeaderLink),
    authenticatedLinks: landing.header.authenticatedLinks.map(mapHeaderLink),
    primaryAction: {
      label: landing.header.primaryAction.label,
      href: landing.header.primaryAction.href,
    },
    secondaryAction: {
      label: landing.header.secondaryAction.label,
      href: landing.header.secondaryAction.href,
    },
    showCart: landing.header.showCart,
  },
  footer: {
    tagline: landing.footer.tagline,
    navigationLinks: landing.footer.navigationLinks.map(mapFooterLink),
    legalLinks: landing.footer.legalLinks.map(mapFooterLink),
    socialLinks: landing.footer.socialLinks.map(mapFooterSocial),
    brandingAppName: landing.footer.brandingAppName ?? '',
    showBrandingLogo: landing.footer.showBrandingLogo,
    showBrandingAppName: landing.footer.showBrandingAppName,
    showBrandingDescription: landing.footer.showBrandingDescription,
    brandingOrientation: landing.footer.brandingOrientation,
    showLanguageSwitcher: landing.footer.showLanguageSwitcher,
    showThemeSwitcher: landing.footer.showThemeSwitcher,
  },
  faqs: landing.faqs.map(mapFaq),
  team: landing.team ? {
    title: landing.team.title,
    subtitle: landing.team.subtitle,
    featuredMemberIds: landing.team.featuredMemberIds ?? [],
  } : undefined,
});

const createEmptyLandingFormState = (): LandingFormState => ({
  hero: {
    title: '',
    subtitle: '',
    style: 'default',
    backgroundImageUrl: '',
  },
  about: {
    title: '',
    description: '',
    secondaryDescription: '',
    imageUrl: '',
  },
  howItWorks: {
    title: '',
    subtitle: '',
    steps: [
      {
        id: `step-${Date.now()}`,
        title: '',
        description: '',
        imageUrl: '',
        order: 0,
      },
    ],
  },
  opportunity: {
    title: '',
    subtitle: '',
    duplicationNote: '',
    monthlyFee: {
      label: '',
      amount: '',
      description: '',
    },
    networkCap: '',
    phases: [
      {
        id: `phase-${Date.now()}`,
        title: '',
        visibilityTag: '',
        descriptor: '',
        requirement: '',
        monthlyInvestment: '',
        rewards: [''],
        accountBalanceHighlight: '',
        commissionHighlight: '',
        order: 0,
      },
    ],
    summary: null,
  },
  testimonials: {
    title: '',
    testimonials: [
      {
        id: `testimonial-${Date.now()}`,
        name: '',
        quote: '',
        role: '',
        imageUrl: '',
        order: 0,
      },
    ],
  },
  featuredProducts: {
    title: '',
    subtitle: '',
    emptyState: '',
  },
  contact: {
    title: '',
    description: '',
    contactInfo: {
      phone: '',
      email: '',
      address: '',
    },
    form: {
      namePlaceholder: '',
      emailPlaceholder: '',
      messagePlaceholder: '',
      sendButton: '',
    },
    recipientEmail: '',
  },
  header: {
    landingLinks: [
      {
        id: `landing-link-${Date.now()}`,
        label: '',
        href: '#',
        requiresAuth: false,
        order: 0,
        visibility: undefined,
        openInNewTab: false,
        icon: null,
      },
    ],
    authenticatedLinks: [
      {
        id: `auth-link-${Date.now()}`,
        label: '',
        href: '/',
        requiresAuth: true,
        order: 0,
        visibility: undefined,
        openInNewTab: false,
        icon: null,
      },
    ],
    primaryAction: {
      label: '',
      href: '',
    },
    secondaryAction: {
      label: '',
      href: '',
    },
    showCart: true,
  },
  footer: {
    tagline: '',
    navigationLinks: [
      {
        id: `footer-nav-${Date.now()}`,
        label: '',
        href: '#',
        order: 0,
        visibility: undefined,
        openInNewTab: false,
      },
    ],
    legalLinks: [
      {
        id: `footer-legal-${Date.now()}`,
        label: '',
        href: '#',
        order: 0,
        visibility: undefined,
        openInNewTab: false,
      },
    ],
    socialLinks: [],
    brandingAppName: '',
    showBrandingLogo: true,
    showBrandingAppName: true,
    showBrandingDescription: true,
    brandingOrientation: 'beside',
    showLanguageSwitcher: true,
    showThemeSwitcher: true,
  },
  faqs: [],
  team: {
    title: '',
    subtitle: '',
    featuredMemberIds: [],
  },
});

const toRequestPayload = (
  locale: Locale,
  branding: BrandingFormState,
  landing: LandingFormState,
  affiliatePageConfig: AffiliateFormState,
) => ({
  locale,
  affiliatePageConfig,
  branding: {
    appName: branding.appName.trim(),
    logoUrl: branding.logoUrl.trim() ? branding.logoUrl.trim() : null,
    faviconUrl: branding.faviconUrl.trim() ? branding.faviconUrl.trim() : null,
    description: branding.description.trim() ? branding.description.trim() : null,
    showLogo: branding.showLogo,
    logoPosition: branding.logoPosition,
    showAppName: branding.showAppName,
  },
  landing: {
    hero: {
      title: landing.hero.title,
      subtitle: landing.hero.subtitle,
      backgroundImageUrl: landing.hero.backgroundImageUrl?.trim()
        ? landing.hero.backgroundImageUrl.trim()
        : null,
    },
    about: {
      title: landing.about.title,
      description: landing.about.description,
      secondaryDescription: landing.about.secondaryDescription?.trim() ?? '',
      imageUrl: landing.about.imageUrl?.trim() ? landing.about.imageUrl.trim() : null,
    },
    howItWorks: {
      title: landing.howItWorks.title,
      subtitle: landing.howItWorks.subtitle,
      steps: landing.howItWorks.steps.map((step, index) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        imageUrl: step.imageUrl?.trim() ? step.imageUrl.trim() : null,
        order: index,
      })),
    },
    opportunity: {
      title: landing.opportunity.title,
      subtitle: landing.opportunity.subtitle,
      duplicationNote: landing.opportunity.duplicationNote,
      monthlyFee: {
        label: landing.opportunity.monthlyFee.label,
        amount: landing.opportunity.monthlyFee.amount,
        description: landing.opportunity.monthlyFee.description,
      },
      networkCap: landing.opportunity.networkCap,
      phases: landing.opportunity.phases.map((phase, index) => ({
        id: phase.id,
        title: phase.title,
        visibilityTag: phase.visibilityTag?.trim() ? phase.visibilityTag.trim() : null,
        descriptor: phase.descriptor,
        requirement: phase.requirement,
        monthlyInvestment: phase.monthlyInvestment,
        rewards: phase.rewards
          .map((reward) => reward?.trim())
          .filter((reward): reward is string => Boolean(reward && reward.length > 0)),
        accountBalanceHighlight: phase.accountBalanceHighlight?.trim()
          ? phase.accountBalanceHighlight.trim()
          : null,
        commissionHighlight: phase.commissionHighlight,
        order: index,
      })),
      summary:
        landing.opportunity.summary &&
          landing.opportunity.summary.title.trim().length > 0 &&
          landing.opportunity.summary.description.trim().length > 0
          ? {
            title: landing.opportunity.summary.title,
            description: landing.opportunity.summary.description,
          }
          : null,
    },
    testimonials: {
      title: landing.testimonials.title,
      testimonials: landing.testimonials.testimonials.map((testimonial, index) => ({
        id: testimonial.id,
        name: testimonial.name,
        quote: testimonial.quote,
        role: testimonial.role?.trim() ? testimonial.role.trim() : null,
        imageUrl: testimonial.imageUrl?.trim() ? testimonial.imageUrl.trim() : null,
        order: index,
      })),
    },
    featuredProducts: {
      title: landing.featuredProducts.title,
      subtitle: landing.featuredProducts.subtitle,
      emptyState: landing.featuredProducts.emptyState,
    },
    contact: {
      title: landing.contact.title,
      description: landing.contact.description,
      contactInfo: {
        phone: landing.contact.contactInfo.phone,
        email: landing.contact.contactInfo.email.trim(),
        address: landing.contact.contactInfo.address,
      },
      form: {
        namePlaceholder: landing.contact.form.namePlaceholder,
        emailPlaceholder: landing.contact.form.emailPlaceholder,
        messagePlaceholder: landing.contact.form.messagePlaceholder,
        sendButton: landing.contact.form.sendButton,
      },
      recipientEmail: landing.contact.recipientEmail.trim(),
    },
    header: {
      landingLinks: landing.header.landingLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        requiresAuth: link.requiresAuth ?? false,
        order: index,
        visibility: link.visibility ?? defaultVisibilityRules,
        openInNewTab: link.openInNewTab ?? false,
        icon: link.icon ?? null,
      })),
      authenticatedLinks: landing.header.authenticatedLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        requiresAuth: link.requiresAuth ?? true,
        order: index,
        visibility: link.visibility ?? defaultVisibilityRules,
        openInNewTab: link.openInNewTab ?? false,
        icon: link.icon ?? null,
      })),
      primaryAction: {
        label: landing.header.primaryAction.label,
        href: landing.header.primaryAction.href,
      },
      secondaryAction: {
        label: landing.header.secondaryAction.label,
        href: landing.header.secondaryAction.href,
      },
      showCart: landing.header.showCart,
    },
    footer: {
      tagline: landing.footer.tagline,
      navigationLinks: landing.footer.navigationLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        order: index,
        visibility: link.visibility ?? defaultVisibilityRules,
        openInNewTab: link.openInNewTab ?? false,
      })),
      legalLinks: landing.footer.legalLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        order: index,
        visibility: link.visibility ?? defaultVisibilityRules,
        openInNewTab: link.openInNewTab ?? false,
      })),
      socialLinks: landing.footer.socialLinks.map((link, index) => ({
        id: link.id,
        platform: link.platform,
        label: link.label,
        href: link.href,
        order: index,
      })),
      brandingAppName: landing.footer.brandingAppName?.trim() ?? '',
      showBrandingLogo: landing.footer.showBrandingLogo,
      showBrandingAppName: landing.footer.showBrandingAppName,
      showBrandingDescription: landing.footer.showBrandingDescription,
      brandingOrientation: landing.footer.brandingOrientation,
      showLanguageSwitcher: landing.footer.showLanguageSwitcher,
      showThemeSwitcher: landing.footer.showThemeSwitcher,
    },
    faqs: landing.faqs.map((faq, index) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      imageUrl: faq.imageUrl?.trim() ? faq.imageUrl.trim() : null,
      order: index,
    })),
    team: landing.team ? {
      title: landing.team.title,
      subtitle: landing.team.subtitle,
      featuredMemberIds: landing.team.featuredMemberIds,
    } : undefined,
  },
});

const ensureLocale = (value: string | undefined, fallback: Locale): Locale => {
  if (!value) {
    return fallback;
  }

  return (i18n.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : fallback;
};

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminSiteContentPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: Locale; locale?: Locale }>;
}) {
  const params = use(searchParams);
  const lang = ensureLocale(params.lang, i18n.defaultLocale);
  const initialLocale = ensureLocale(params.locale, lang);
  const router = useRouter();
  const pathname = usePathname();
  const { branding: globalBranding, refreshBranding } = useSiteBranding();
  const dict = useMemo(
    () => getDictionary(lang, globalBranding.appName),
    [lang, globalBranding.appName],
  );
  const copy = dict.admin?.siteContent;
  const footerBrandingCopy = ((copy as any)?.footer as { branding?: FooterBrandingCopy } | undefined)?.branding;
  const { toast } = useToast();

  const [selectedLocale, setSelectedLocale] = useState<Locale>(initialLocale);
  const [brandingForm, setBrandingForm] = useState<BrandingFormState>(() =>
    createBrandingState(globalBranding),
  );
  const [landingForm, setLandingForm] = useState<LandingFormState | null>(null);
  const [affiliateForm, setAffiliateForm] = useState<AffiliateFormState>(defaultAffiliatePageConfig);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingSteps, setUploadingSteps] = useState<Record<number, boolean>>({});
  const [uploadingFaqs, setUploadingFaqs] = useState<Record<number, boolean>>({});
  const [uploadingTestimonials, setUploadingTestimonials] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'header' | 'footer' | 'affiliate'>('header');

  const loadConfiguration = useCallback(
    async (locale: Locale) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/site-content?locale=${locale}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message = body?.error || 'Failed to load site content configuration.';
          throw new Error(message);
        }

        const payload = await response.json();
        const branding = SiteBrandingSchema.parse(payload.branding);
        const landing = LandingContentSchema.parse(payload.landing);
        // Use default config if not present in payload (backward compatibility)
        const affiliateConfig = payload.affiliatePageConfig
          ? payload.affiliatePageConfig
          : defaultAffiliatePageConfig;

        setBrandingForm(createBrandingState(branding));
        setLandingForm(createLandingState(landing));
        setAffiliateForm(affiliateConfig);
      } catch (_err) {
        console.error('Failed to load site content configuration', _err);
        setError(copy?.errorLoading ?? 'No pudimos cargar la configuración actual.');
        setLandingForm((prev) => prev ?? createEmptyLandingFormState());
        toast({
          title: copy?.toast?.loadError?.title ?? 'Error al cargar',
          description: copy?.toast?.loadError?.description ??
            'No se pudo obtener la configuración. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [copy?.errorLoading, copy?.toast?.loadError?.description, copy?.toast?.loadError?.title, toast],
  );

  const loadAvailableTeamMembers = useCallback(
    async (locale: Locale) => {
      setLoadingTeamMembers(true);
      try {
        const response = await fetch(`/api/admin/team-page?locale=${locale}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('Failed to load team members');
          return;
        }

        const payload = await response.json();
        setAvailableTeamMembers(payload.members ?? []);
      } catch (_err) {
        console.error('Failed to load team members', _err);
        setAvailableTeamMembers([]);
      } finally {
        setLoadingTeamMembers(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadConfiguration(selectedLocale);
    loadAvailableTeamMembers(selectedLocale);
  }, [selectedLocale, loadConfiguration, loadAvailableTeamMembers]);

  const handleLocaleChange = useCallback(
    (value: string) => {
      const locale = ensureLocale(value, selectedLocale);
      setSelectedLocale(locale);
      router.replace(`${pathname}?lang=${lang}&locale=${locale}`);
    },
    [lang, pathname, router, selectedLocale],
  );

  const handleBrandingChange = useCallback(
    (field: keyof BrandingFormState, value: string | boolean) => {
      setBrandingForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleAffiliateChange = useCallback(
    (section: keyof AffiliateFormState, field: string, value: any) => {
      setAffiliateForm((prev) => {
        if (section === 'settings') {
          return {
            ...prev,
            settings: {
              ...prev.settings,
              [field]: value,
            },
          };
        }
        if (section === 'header') {
          return {
            ...prev,
            header: {
              ...prev.header,
              [field]: value,
            },
          };
        }
        if (section === 'footer') {
          return {
            ...prev,
            footer: {
              ...prev.footer,
              [field]: value,
            },
          };
        }
        return prev;
      });
    },
    [],
  );

  const uploadFileToPageBucket = useCallback(async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${prefix}-${Date.now()}.${fileExt}`;
    const { data: _data, error } = await supabase.storage
      .from(PAGE_BUCKET)
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(PAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  }, []);

  const handleLogoFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingLogo(true);
      try {
        const publicUrl = await uploadFileToPageBucket(file, 'logo');
        handleBrandingChange('logoUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading logo', _err);
        toast({
          title: 'Error al subir logo',
          description: 'No se pudo subir el logo. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingLogo(false);
      }
    },
    [handleBrandingChange, toast, uploadFileToPageBucket],
  );

  const handleFaviconFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingFavicon(true);
      try {
        const publicUrl = await uploadFileToPageBucket(file, 'favicon');
        handleBrandingChange('faviconUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading favicon', _err);
        toast({
          title: 'Error al subir favicon',
          description: 'No se pudo subir el favicon. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingFavicon(false);
      }
    },
    [handleBrandingChange, toast, uploadFileToPageBucket],
  );

  const handleHeroChange = useCallback(
    (field: keyof LandingFormState['hero'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            hero: {
              ...prev.hero,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleHeroFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingHero(true);
      try {
        const publicUrl = await uploadFileToPageBucket(file, 'hero-bg');
        handleHeroChange('backgroundImageUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading hero image', _err);
        toast({
          title: 'Error al subir imagen de hero',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingHero(false);
      }
    },
    [handleHeroChange, toast, uploadFileToPageBucket],
  );

  const handleAboutChange = useCallback(
    (field: keyof LandingFormState['about'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            about: {
              ...prev.about,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleAboutFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingAbout(true);
      try {
        const publicUrl = await uploadFileToPageBucket(file, 'about');
        handleAboutChange('imageUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading about image', _err);
        toast({
          title: 'Error al subir imagen de about',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingAbout(false);
      }
    },
    [handleAboutChange, toast, uploadFileToPageBucket],
  );

  const handleHowItWorksFieldChange = useCallback(
    (field: keyof LandingFormState['howItWorks'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            howItWorks: {
              ...prev.howItWorks,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const updateStep = useCallback((index: number, field: keyof LandingStep, value: string) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextSteps = prev.howItWorks.steps.map((step, idx) =>
        idx === index
          ? {
            ...step,
            [field]: value,
          }
          : step,
      );

      return {
        ...prev,
        howItWorks: {
          ...prev.howItWorks,
          steps: nextSteps.map((step, idx) => ({ ...step, order: idx })),
        },
      };
    });
  }, []);

  const handleStepFileChange = useCallback(
    async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingSteps((prev) => ({ ...prev, [index]: true }));
      try {
        const publicUrl = await uploadFileToPageBucket(file, `step-${index}`);
        updateStep(index, 'imageUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading step image', _err);
        toast({
          title: 'Error al subir imagen del paso',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingSteps((prev) => ({ ...prev, [index]: false }));
      }
    },
    [updateStep, toast, uploadFileToPageBucket],
  );

  const removeStep = useCallback((index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.howItWorks.steps.length <= 1) {
        return prev;
      }

      const steps = prev.howItWorks.steps.filter((_, idx) => idx !== index);

      return {
        ...prev,
        howItWorks: {
          ...prev.howItWorks,
          steps: steps.map((step, idx) => ({ ...step, order: idx })),
        },
      };
    });
  }, []);

  const addStep = useCallback(() => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextSteps = [
        ...prev.howItWorks.steps,
        {
          id: `step-${Date.now()}`,
          title: '',
          description: '',
          imageUrl: '',
          order: prev.howItWorks.steps.length,
        },
      ];

      return {
        ...prev,
        howItWorks: {
          ...prev.howItWorks,
          steps: nextSteps.map((step, idx) => ({ ...step, order: idx })),
        },
      };
    });
  }, []);

  const handleOpportunityFieldChange = useCallback(
    (field: keyof LandingFormState['opportunity'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            opportunity: {
              ...prev.opportunity,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const _handleOpportunityMonthlyFeeChange = useCallback(
    (field: keyof LandingFormState['opportunity']['monthlyFee'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            opportunity: {
              ...prev.opportunity,
              monthlyFee: {
                ...prev.opportunity.monthlyFee,
                [field]: value,
              },
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleOpportunitySummaryChange = useCallback(
    (field: 'title' | 'description', value: string) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const summary = prev.opportunity.summary ?? { title: '', description: '' };

        const nextSummary = {
          ...summary,
          [field]: value,
        };

        if (!nextSummary.title && !nextSummary.description) {
          return {
            ...prev,
            opportunity: {
              ...prev.opportunity,
              summary: null,
            },
          };
        }

        return {
          ...prev,
          opportunity: {
            ...prev.opportunity,
            summary: nextSummary,
          },
        };
      });
    },
    [],
  );

  const updateOpportunityPhase = useCallback(
    (index: number, updater: (phase: LandingOpportunityPhase) => LandingOpportunityPhase) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const nextPhases = prev.opportunity.phases.map((phase, idx) =>
          idx === index ? updater(phase) : phase,
        );

        return {
          ...prev,
          opportunity: {
            ...prev.opportunity,
            phases: nextPhases.map((phase, idx) => ({ ...phase, order: idx })),
          },
        };
      });
    },
    [],
  );

  const _handleOpportunityPhaseFieldChange = useCallback(
    (
      index: number,
      field: Exclude<keyof LandingOpportunityPhase, 'id' | 'order' | 'rewards'>,
      value: string,
    ) => {
      updateOpportunityPhase(index, (phase) => ({
        ...phase,
        [field]: value,
      }));
    },
    [updateOpportunityPhase],
  );

  const _handleOpportunityPhaseRewardsChange = useCallback(
    (index: number, value: string) => {
      const rewards = value
        .split('\n')
        .map((reward) => reward.trim())
        .filter((reward) => reward.length > 0);

      updateOpportunityPhase(index, (phase) => ({
        ...phase,
        rewards: rewards.length > 0 ? rewards : [''],
      }));
    },
    [updateOpportunityPhase],
  );

  const _addOpportunityPhase = useCallback(() => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextPhases = [
        ...prev.opportunity.phases,
        {
          id: `phase-${Date.now()}`,
          title: '',
          visibilityTag: '',
          descriptor: '',
          requirement: '',
          monthlyInvestment: '',
          rewards: [''],
          accountBalanceHighlight: '',
          commissionHighlight: '',
          order: prev.opportunity.phases.length,
        },
      ];

      return {
        ...prev,
        opportunity: {
          ...prev.opportunity,
          phases: nextPhases.map((phase, idx) => ({ ...phase, order: idx })),
        },
      };
    });
  }, []);

  const _removeOpportunityPhase = useCallback((index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.opportunity.phases.length <= 1) {
        return prev;
      }

      const phases = prev.opportunity.phases.filter((_, idx) => idx !== index);

      return {
        ...prev,
        opportunity: {
          ...prev.opportunity,
          phases: phases.map((phase, idx) => ({ ...phase, order: idx })),
        },
      };
    });
  }, []);

  const handleTestimonialsTitleChange = useCallback((value: string) => {
    setLandingForm((prev) =>
      prev
        ? {
          ...prev,
          testimonials: {
            ...prev.testimonials,
            title: value,
          },
        }
        : prev,
    );
  }, []);

  const updateTestimonial = useCallback(
    (index: number, updater: (testimonial: LandingTestimonial) => LandingTestimonial) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const testimonials = prev.testimonials.testimonials.map((testimonial, idx) =>
          idx === index ? updater(testimonial) : testimonial,
        );

        return {
          ...prev,
          testimonials: {
            ...prev.testimonials,
            testimonials: testimonials.map((testimonial, idx) => ({ ...testimonial, order: idx })),
          },
        };
      });
    },
    [],
  );

  const handleTestimonialFieldChange = useCallback(
    (
      index: number,
      field: Exclude<keyof LandingTestimonial, 'id' | 'order'>,
      value: string,
    ) => {
      updateTestimonial(index, (testimonial) => ({
        ...testimonial,
        [field]: value,
      }));
    },
    [updateTestimonial],
  );

  const addTestimonial = useCallback(() => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextTestimonials = [
        ...prev.testimonials.testimonials,
        {
          id: `testimonial-${Date.now()}`,
          name: '',
          quote: '',
          role: '',
          imageUrl: '',
          order: prev.testimonials.testimonials.length,
        },
      ];

      return {
        ...prev,
        testimonials: {
          ...prev.testimonials,
          testimonials: nextTestimonials.map((testimonial, idx) => ({ ...testimonial, order: idx })),
        },
      };
    });
  }, []);

  const removeTestimonial = useCallback((index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.testimonials.testimonials.length <= 1) {
        return prev;
      }

      const testimonials = prev.testimonials.testimonials.filter((_, idx) => idx !== index);

      return {
        ...prev,
        testimonials: {
          ...prev.testimonials,
          testimonials: testimonials.map((testimonial, idx) => ({ ...testimonial, order: idx })),
        },
      };
    });
  }, []);

  // Team handlers
  const handleTeamTitleChange = useCallback((value: string) => {
    setLandingForm((prev) =>
      prev && prev.team
        ? {
          ...prev,
          team: {
            ...prev.team,
            title: value,
          },
        }
        : prev,
    );
  }, []);

  const handleTeamSubtitleChange = useCallback((value: string) => {
    setLandingForm((prev) =>
      prev && prev.team
        ? {
          ...prev,
          team: {
            ...prev.team,
            subtitle: value,
          },
        }
        : prev,
    );
  }, []);

  const toggleFeaturedMember = useCallback((memberId: string) => {
    setLandingForm((prev) => {
      if (!prev || !prev.team) {
        return prev;
      }

      const isFeatured = prev.team.featuredMemberIds.includes(memberId);
      const featuredMemberIds = isFeatured
        ? prev.team.featuredMemberIds.filter(id => id !== memberId)
        : prev.team.featuredMemberIds.length < 4
          ? [...prev.team.featuredMemberIds, memberId]
          : prev.team.featuredMemberIds;

      return {
        ...prev,
        team: {
          ...prev.team,
          featuredMemberIds,
        },
      };
    });
  }, []);

  const handleFeaturedProductsFieldChange = useCallback(
    (field: keyof LandingFormState['featuredProducts'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            featuredProducts: {
              ...prev.featuredProducts,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleContactFieldChange = useCallback(
    (field: keyof LandingFormState['contact'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            contact: {
              ...prev.contact,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleContactInfoFieldChange = useCallback(
    (field: keyof LandingFormState['contact']['contactInfo'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            contact: {
              ...prev.contact,
              contactInfo: {
                ...prev.contact.contactInfo,
                [field]: value,
              },
            },
          }
          : prev,
      );
    },
    [],
  );

  const handleContactFormFieldChange = useCallback(
    (field: keyof LandingFormState['contact']['form'], value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            contact: {
              ...prev.contact,
              form: {
                ...prev.contact.form,
                [field]: value,
              },
            },
          }
          : prev,
      );
    },
    [],
  );

  const updateFaq = useCallback((index: number, field: keyof LandingFaq, value: string) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextFaqs = prev.faqs.map((faq, idx) =>
        idx === index
          ? {
            ...faq,
            [field]: value,
          }
          : faq,
      );

      return {
        ...prev,
        faqs: nextFaqs.map((faq, idx) => ({ ...faq, order: idx })),
      };
    });
  }, []);

  const handleFaqFileChange = useCallback(
    async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingFaqs((prev) => ({ ...prev, [index]: true }));
      try {
        const publicUrl = await uploadFileToPageBucket(file, `faq-${index}`);
        updateFaq(index, 'imageUrl', publicUrl);
      } catch (_err) {
        console.error('Error uploading faq image', _err);
        toast({
          title: 'Error al subir imagen de FAQ',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingFaqs((prev) => ({ ...prev, [index]: false }));
      }
    },
    [updateFaq, toast, uploadFileToPageBucket],
  );

  const handleTestimonialFileChange = useCallback(
    async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingTestimonials((prev) => ({ ...prev, [index]: true }));
      try {
        const publicUrl = await uploadFileToPageBucket(file, `testimonial-${index}`);
        updateTestimonial(index, (testimonial) => ({
          ...testimonial,
          imageUrl: publicUrl,
        }));
      } catch (_err) {
        console.error('Error uploading testimonial image', _err);
        toast({
          title: 'Error al subir imagen de testimonio',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingTestimonials((prev) => ({ ...prev, [index]: false }));
      }
    },
    [updateTestimonial, toast, uploadFileToPageBucket],
  );

  const removeFaq = useCallback((index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextFaqs = prev.faqs.filter((_, idx) => idx !== index);

      return {
        ...prev,
        faqs: nextFaqs.map((faq, idx) => ({ ...faq, order: idx })),
      };
    });
  }, []);

  const addFaq = useCallback(() => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextFaqs = [
        ...prev.faqs,
        {
          id: `faq-${Date.now()}`,
          question: '',
          answer: '',
          imageUrl: '',
          order: prev.faqs.length,
        },
      ];

      return {
        ...prev,
        faqs: nextFaqs.map((faq, idx) => ({ ...faq, order: idx })),
      };
    });
  }, []);

  const handleHeaderActionChange = useCallback(
    (action: 'primaryAction' | 'secondaryAction', field: 'label' | 'href', value: string) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            header: {
              ...prev.header,
              [action]: {
                ...prev.header[action],
                [field]: value,
              },
            },
          }
          : prev,
      );
    },
    [],
  );

  const updateHeaderLink = useCallback(
    (
      collection: HeaderLinkCollection,
      index: number,
      updater: (link: LandingHeaderLink) => LandingHeaderLink,
    ) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const updated = prev.header[collection].map((link, idx) =>
          idx === index ? updater(link) : link,
        );

        return {
          ...prev,
          header: {
            ...prev.header,
            [collection]: updated.map((link, idx) => ({ ...link, order: idx })),
          },
        };
      });
    },
    [],
  );

  const handleHeaderLinkFieldChange = useCallback(
    (
      collection: HeaderLinkCollection,
      index: number,
      field: Exclude<keyof LandingHeaderLink, 'id' | 'order'>,
      value: string | boolean | LinkVisibilityRules,
    ) => {
      updateHeaderLink(collection, index, (link) => ({
        ...link,
        [field]: field === 'requiresAuth' || field === 'openInNewTab'
          ? Boolean(value)
          : field === 'visibility'
            ? (value as LinkVisibilityRules)
            : (value as string),
      }));
    },
    [updateHeaderLink],
  );

  const addHeaderLink = useCallback((collection: HeaderLinkCollection) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const timestamp = Date.now();
      const defaults =
        collection === 'landingLinks'
          ? { href: '#', requiresAuth: false }
          : { href: '/', requiresAuth: true };

      const nextLinks = [
        ...prev.header[collection],
        {
          id: `${collection === 'landingLinks' ? 'landing' : 'auth'}-link-${timestamp}`,
          label: '',
          href: defaults.href,
          requiresAuth: defaults.requiresAuth,
          order: prev.header[collection].length,
          visibility: undefined,
          openInNewTab: false,
          icon: null,
        },
      ];

      return {
        ...prev,
        header: {
          ...prev.header,
          [collection]: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const removeHeaderLink = useCallback((collection: HeaderLinkCollection, index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.header[collection].length <= 1) {
        return prev;
      }

      const nextLinks = prev.header[collection].filter((_, idx) => idx !== index);

      return {
        ...prev,
        header: {
          ...prev.header,
          [collection]: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const toggleHeaderShowCart = useCallback((value: boolean) => {
    setLandingForm((prev) =>
      prev
        ? {
          ...prev,
          header: {
            ...prev.header,
            showCart: value,
          },
        }
        : prev,
    );
  }, []);

  const handleFooterFieldChange = useCallback(
    (
      field:
        | 'tagline'
        | 'brandingAppName'
        | 'showLanguageSwitcher'
        | 'showThemeSwitcher'
        | 'showBrandingLogo'
        | 'showBrandingAppName'
        | 'showBrandingDescription'
        | 'brandingOrientation',
      value: string | boolean,
    ) => {
      setLandingForm((prev) =>
        prev
          ? {
            ...prev,
            footer: {
              ...prev.footer,
              [field]: value,
            },
          }
          : prev,
      );
    },
    [],
  );

  const updateFooterLink = useCallback(
    (
      collection: FooterLinkCollection,
      index: number,
      updater: (link: LandingFooterLink) => LandingFooterLink,
    ) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const updated = prev.footer[collection].map((link, idx) =>
          idx === index ? updater(link) : link,
        );

        return {
          ...prev,
          footer: {
            ...prev.footer,
            [collection]: updated.map((link, idx) => ({ ...link, order: idx })),
          },
        };
      });
    },
    [],
  );

  const handleFooterLinkFieldChange = useCallback(
    (
      collection: FooterLinkCollection,
      index: number,
      field: Exclude<keyof LandingFooterLink, 'id' | 'order'>,
      value: string | boolean | LinkVisibilityRules,
    ) => {
      updateFooterLink(collection, index, (link) => ({
        ...link,
        [field]: field === 'openInNewTab'
          ? Boolean(value)
          : field === 'visibility'
            ? (value as LinkVisibilityRules)
            : (value as string),
      }));
    },
    [updateFooterLink],
  );

  const addFooterLink = useCallback((collection: FooterLinkCollection) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const timestamp = Date.now();
      const nextLinks = [
        ...prev.footer[collection],
        {
          id: `${collection === 'navigationLinks' ? 'footer-nav' : 'footer-legal'}-${timestamp}`,
          label: '',
          href: '#',
          order: prev.footer[collection].length,
          visibility: undefined,
          openInNewTab: false,
        },
      ];

      return {
        ...prev,
        footer: {
          ...prev.footer,
          [collection]: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const removeFooterLink = useCallback((collection: FooterLinkCollection, index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.footer[collection].length <= 1) {
        return prev;
      }

      const nextLinks = prev.footer[collection].filter((_, idx) => idx !== index);

      return {
        ...prev,
        footer: {
          ...prev.footer,
          [collection]: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const updateFooterSocial = useCallback(
    (index: number, updater: (link: LandingFooterSocial) => LandingFooterSocial) => {
      setLandingForm((prev) => {
        if (!prev) {
          return prev;
        }

        const updated = prev.footer.socialLinks.map((link, idx) =>
          idx === index ? updater(link) : link,
        );

        return {
          ...prev,
          footer: {
            ...prev.footer,
            socialLinks: updated.map((link, idx) => ({ ...link, order: idx })),
          },
        };
      });
    },
    [],
  );

  const handleFooterSocialFieldChange = useCallback(
    (
      index: number,
      field: Exclude<keyof LandingFooterSocial, 'id' | 'order'>,
      value: string,
    ) => {
      updateFooterSocial(index, (link) => ({
        ...link,
        [field]: field === 'platform' ? (value as LandingFooterSocial['platform']) : value,
      }));
    },
    [updateFooterSocial],
  );

  const addFooterSocial = useCallback(() => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextLinks = [
        ...prev.footer.socialLinks,
        {
          id: `footer-social-${Date.now()}`,
          platform: 'custom' as LandingFooterSocial['platform'],
          label: '',
          href: '#',
          order: prev.footer.socialLinks.length,
        },
      ];

      return {
        ...prev,
        footer: {
          ...prev.footer,
          socialLinks: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const removeFooterSocial = useCallback((index: number) => {
    setLandingForm((prev) => {
      if (!prev) {
        return prev;
      }

      const nextLinks = prev.footer.socialLinks.filter((_, idx) => idx !== index);

      return {
        ...prev,
        footer: {
          ...prev.footer,
          socialLinks: nextLinks.map((link, idx) => ({ ...link, order: idx })),
        },
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!landingForm) {
        return;
      }

      setSaving(true);

      try {
        const payload = toRequestPayload(selectedLocale, brandingForm, landingForm, affiliateForm);
        // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
        const response = await adminApi.put('/api/admin/site-content', payload);

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message = body?.error || 'Failed to save configuration.';
          throw new Error(message);
        }

        const data = await response.json();
        const branding = SiteBrandingSchema.parse(data.branding);
        const landing = LandingContentSchema.parse(data.landing);
        const affiliateConfig = data.affiliatePageConfig
          ? data.affiliatePageConfig
          : defaultAffiliatePageConfig;

        // Update state without causing scroll reset - only update if data changed
        const newBrandingState = createBrandingState(branding);
        const newLandingState = createLandingState(landing);

        // Use functional updates to preserve scroll position
        setBrandingForm(prev => prev ? { ...prev, ...newBrandingState } : newBrandingState);
        setLandingForm(prev => prev ? { ...prev, ...newLandingState } : newLandingState);
        setAffiliateForm(affiliateConfig);

        // Refresh global branding context
        await refreshBranding();

        toast({
          title: copy?.toast?.success?.title ?? 'Configuración actualizada',
          description:
            copy?.toast?.success?.description ?? 'Los cambios se guardaron correctamente.',
        });
      } catch (_err) {
        console.error('Failed to save site content configuration', _err);
        toast({
          title: copy?.toast?.error?.title ?? 'No se pudo guardar',
          description: copy?.toast?.error?.description ??
            'Revisa los campos obligatorios e inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [affiliateForm, brandingForm, copy?.toast?.error?.description, copy?.toast?.error?.title, copy?.toast?.success?.description, copy?.toast?.success?.title, landingForm, refreshBranding, selectedLocale, toast],
  );

  const isRemovingStepsDisabled = landingForm?.howItWorks.steps.length === 1;
  const _isRemovingPhasesDisabled = landingForm?.opportunity.phases.length === 1;
  const isRemovingTestimonialsDisabled =
    landingForm?.testimonials.testimonials.length === 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">
            {copy?.title ?? 'Branding y contenido'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy?.description ??
              'Actualiza el nombre, logo y los textos públicos del landing page.'}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="locale-selector">{copy?.localeLabel ?? 'Idioma del contenido'}</Label>
          <Select value={selectedLocale} onValueChange={handleLocaleChange}>
            <SelectTrigger id="locale-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {i18n.locales.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {locale.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <AlertTitle>{copy?.errorTitle ?? 'No se pudo cargar la información'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadConfiguration(selectedLocale)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {copy?.retry ?? 'Reintentar'}
          </Button>
        </Alert>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'header' | 'footer' | 'affiliate')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="header">{copy?.tabs?.header ?? 'Header'}</TabsTrigger>
            <TabsTrigger value="footer">{copy?.tabs?.footer ?? 'Footer'}</TabsTrigger>
            <TabsTrigger value="affiliate">{copy?.tabs?.affiliate ?? 'Páginas de Afiliados'}</TabsTrigger>
          </TabsList>
          <TabsContent value="header" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy?.branding?.title ?? 'Identidad de la marca'}</CardTitle>
                <CardDescription>
                  {copy?.branding?.description ??
                    'Esta información se usa en el encabezado, pie de página, metadatos y apps conectadas.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="appName">{copy?.branding?.fields?.appName ?? 'Nombre de la aplicación'}</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      id="appName"
                      name="appName"
                      value={brandingForm.appName}
                      onChange={(event) => handleBrandingChange('appName', event.target.value)}
                      required
                      minLength={1}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">{copy?.branding?.fields?.logoUrl ?? 'Logo'}</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="logoUrl"
                        name="logoUrl"
                        type="url"
                        placeholder="https:// o sube un archivo"
                        value={brandingForm.logoUrl}
                        onChange={(event) => handleBrandingChange('logoUrl', event.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          disabled={uploadingLogo}
                          className="hidden"
                          id="logoFile"
                        />
                        <Label htmlFor="logoFile" className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                            <span>
                              {uploadingLogo ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              {uploadingLogo ? 'Subiendo...' : 'Subir archivo'}
                            </span>
                          </Button>
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">{copy?.branding?.fields?.faviconUrl ?? 'Favicon'}</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="faviconUrl"
                        name="faviconUrl"
                        type="url"
                        placeholder="https:// o sube un archivo (.ico, .png, .svg)"
                        value={brandingForm.faviconUrl}
                        onChange={(event) => handleBrandingChange('faviconUrl', event.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFaviconFileChange}
                          disabled={uploadingFavicon}
                          className="hidden"
                          id="faviconFile"
                        />
                        <Label htmlFor="faviconFile" className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" disabled={uploadingFavicon} asChild>
                            <span>
                              {uploadingFavicon ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              {uploadingFavicon ? 'Subiendo...' : 'Subir archivo'}
                            </span>
                          </Button>
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    {copy?.branding?.fields?.description ?? 'Descripción corta'}
                  </Label>
                  {loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <Textarea
                      id="description"
                      name="description"
                      rows={4}
                      value={brandingForm.description}
                      onChange={(event) => handleBrandingChange('description', event.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="showLogo">Mostrar logo en el header</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={brandingForm.showLogo ? 'true' : 'false'}
                      onValueChange={(value) => handleBrandingChange('showLogo', value === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sí</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoPosition">Posición del logo</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={brandingForm.logoPosition}
                      onValueChange={(value: 'beside' | 'above' | 'below') => handleBrandingChange('logoPosition', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beside">Al lado del título</SelectItem>
                        <SelectItem value="above">Arriba del título</SelectItem>
                        <SelectItem value="below">Abajo del título</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="showAppName">Mostrar nombre de la aplicación</Label>
                  {loading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={brandingForm.showAppName ? 'true' : 'false'}
                      onValueChange={(value) => handleBrandingChange('showAppName', value === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sí</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{(copy as any)?.header?.title ?? 'Navegación y acciones del header'}</CardTitle>
                <CardDescription>
                  {(copy as any)?.header?.description ??
                    'Administra los enlaces públicos, las opciones autenticadas y los llamados a la acción que aparecen en el encabezado.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">
                      {(copy as any)?.header?.actions?.title ?? 'Botones de acción'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {(copy as any)?.header?.actions?.description ?? 'Define las acciones principales que aparecerán en el encabezado.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
                    ) : (
                      <>
                        <Input
                          placeholder={(copy as any)?.header?.actions?.primaryLabel ?? 'Etiqueta de la acción principal'}
                          value={landingForm?.header.primaryAction.label ?? ''}
                          onChange={(event) => handleHeaderActionChange('primaryAction', 'label', event.target.value)}
                          required
                          minLength={1}
                        />
                        <Input
                          placeholder={(copy as any)?.header?.actions?.primaryHref ?? 'Enlace de la acción principal'}
                          value={landingForm?.header.primaryAction.href ?? ''}
                          onChange={(event) => handleHeaderActionChange('primaryAction', 'href', event.target.value)}
                          required
                          minLength={1}
                        />
                        <Input
                          placeholder={(copy as any)?.header?.actions?.secondaryLabel ?? 'Etiqueta de la acción secundaria'}
                          value={landingForm?.header.secondaryAction.label ?? ''}
                          onChange={(event) => handleHeaderActionChange('secondaryAction', 'label', event.target.value)}
                          required
                          minLength={1}
                        />
                        <Input
                          placeholder={(copy as any)?.header?.actions?.secondaryHref ?? 'Enlace de la acción secundaria'}
                          value={landingForm?.header.secondaryAction.href ?? ''}
                          onChange={(event) => handleHeaderActionChange('secondaryAction', 'href', event.target.value)}
                          required
                          minLength={1}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {(copy as any)?.header?.actions?.showCart ?? 'Mostrar acceso directo al carrito al autenticarse'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(copy as any)?.header?.actions?.showCartDescription ?? 'Permite que los usuarios accedan al carrito con un solo clic después de iniciar sesión.'}
                      </p>
                    </div>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <Switch checked={landingForm?.header.showCart ?? false} onCheckedChange={toggleHeaderShowCart} />
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        {(copy as any)?.header?.landingLinks?.title ?? 'Navegación de la landing'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {(copy as any)?.header?.landingLinks?.description ?? 'Enlaces visibles en la página pública.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => addHeaderLink('landingLinks')} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {(copy as any)?.header?.landingLinks?.add ?? 'Agregar enlace'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      landingForm.header.landingLinks.map((link, index) => (
                        <Card key={link.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {((copy as any)?.header?.landingLinks?.label ?? 'Enlace {{index}}').replace('{{index}}', String(index + 1))}
                            </CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeHeaderLink('landingLinks', index)} disabled={landingForm.header.landingLinks.length <= 1}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {(copy as any)?.header?.landingLinks?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={(copy as any)?.header?.landingLinks?.label ?? 'Etiqueta'}
                              value={link.label}
                              onChange={(event) => handleHeaderLinkFieldChange('landingLinks', index, 'label', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={(copy as any)?.header?.landingLinks?.href ?? 'URL o ancla'}
                              value={link.href}
                              onChange={(event) => handleHeaderLinkFieldChange('landingLinks', index, 'href', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                              <span className="text-sm font-medium">Abrir en nueva pestaña</span>
                              <Switch
                                checked={link.openInNewTab ?? false}
                                onCheckedChange={(checked) => handleHeaderLinkFieldChange('landingLinks', index, 'openInNewTab', checked)}
                              />
                            </div>
                            <LinkVisibilityConfig
                              visibility={link.visibility}
                              onChange={(visibility) => handleHeaderLinkFieldChange('landingLinks', index, 'visibility', visibility)}
                              disabled={loading}
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        {(copy as any)?.header?.authenticatedLinks?.title ?? 'Navegación autenticada'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {(copy as any)?.header?.authenticatedLinks?.description ?? 'Enlaces disponibles después de iniciar sesión.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => addHeaderLink('authenticatedLinks')} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {(copy as any)?.header?.authenticatedLinks?.add ?? 'Agregar enlace'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      landingForm.header.authenticatedLinks.map((link, index) => (
                        <Card key={link.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {((copy as any)?.header?.authenticatedLinks?.label ?? 'Enlace {{index}}').replace('{{index}}', String(index + 1))}
                            </CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeHeaderLink('authenticatedLinks', index)} disabled={landingForm.header.authenticatedLinks.length <= 1}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {(copy as any)?.header?.authenticatedLinks?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={(copy as any)?.header?.landingLinks?.label ?? 'Etiqueta'}
                              value={link.label}
                              onChange={(event) => handleHeaderLinkFieldChange('authenticatedLinks', index, 'label', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={(copy as any)?.header?.landingLinks?.href ?? 'URL o ancla'}
                              value={link.href}
                              onChange={(event) => handleHeaderLinkFieldChange('authenticatedLinks', index, 'href', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                              <span className="text-sm font-medium">Abrir en nueva pestaña</span>
                              <Switch
                                checked={link.openInNewTab ?? false}
                                onCheckedChange={(checked) => handleHeaderLinkFieldChange('authenticatedLinks', index, 'openInNewTab', checked)}
                              />
                            </div>
                            <LinkVisibilityConfig
                              visibility={link.visibility}
                              onChange={(visibility) => handleHeaderLinkFieldChange('authenticatedLinks', index, 'visibility', visibility)}
                              disabled={loading}
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="landing" className="space-y-6" style={{ display: 'none' }}>


            <Card>
              <CardHeader>
                <CardTitle>{copy?.landing?.title ?? 'Landing page'}</CardTitle>
                <CardDescription>
                  {copy?.landing?.description ??
                    'Personaliza el contenido que verán los visitantes en la página principal.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {copy?.hero?.title ?? 'Sección hero'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {copy?.hero?.description ??
                        'Define el mensaje principal y la imagen de fondo del encabezado.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="heroTitle"
                        name="heroTitle"
                        placeholder={copy?.hero?.fields?.title ?? 'Título principal'}
                        value={landingForm?.hero.title ?? ''}
                        onChange={(event) => handleHeroChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="heroSubtitle"
                        name="heroSubtitle"
                        placeholder={copy?.hero?.fields?.subtitle ?? 'Subtítulo'}
                        value={landingForm?.hero.subtitle ?? ''}
                        onChange={(event) => handleHeroChange('subtitle', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label>{copy?.hero?.fields?.backgroundImageUrl ?? 'Imagen de fondo'}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleHeroFileChange}
                            disabled={uploadingHero}
                            className="hidden"
                            id="heroFile"
                            aria-label="Upload hero background image"
                          />
                          <Label htmlFor="heroFile" className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" disabled={uploadingHero} asChild>
                              <span>
                                {uploadingHero ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {uploadingHero ? 'Subiendo...' : 'Subir imagen'}
                              </span>
                            </Button>
                          </Label>
                          {landingForm?.hero.backgroundImageUrl && (
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                placeholder="Imagen subida"
                                value={landingForm.hero.backgroundImageUrl}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleHeroChange('backgroundImageUrl', '')}
                                disabled={uploadingHero}
                                title="Eliminar imagen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {copy?.about?.title ?? 'Sección sobre nosotros'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {copy?.about?.description ??
                        'Cuenta la historia de la marca y reforza la propuesta de valor.'}
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="aboutTitle"
                        name="aboutTitle"
                        placeholder={copy?.about?.fields?.title ?? 'Título'}
                        value={landingForm?.about.title ?? ''}
                        onChange={(event) => handleAboutChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      <Textarea
                        id="aboutDescription"
                        name="aboutDescription"
                        rows={4}
                        placeholder={copy?.about?.fields?.description ?? 'Descripción principal'}
                        value={landingForm?.about.description ?? ''}
                        onChange={(event) => handleAboutChange('description', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      <Textarea
                        id="aboutSecondary"
                        name="aboutSecondary"
                        rows={3}
                        placeholder={copy?.about?.fields?.secondaryDescription ?? 'Descripción secundaria (opcional)'}
                        value={landingForm?.about.secondaryDescription ?? ''}
                        onChange={(event) => handleAboutChange('secondaryDescription', event.target.value)}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <div className="space-y-2">
                        <Label>{copy?.about?.fields?.imageUrl ?? 'Imagen'}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleAboutFileChange}
                            disabled={uploadingAbout}
                            className="hidden"
                            id="aboutFile"
                          />
                          <Label htmlFor="aboutFile" className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" disabled={uploadingAbout} asChild>
                              <span>
                                {uploadingAbout ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {uploadingAbout ? 'Subiendo...' : 'Subir imagen'}
                              </span>
                            </Button>
                          </Label>
                          {landingForm?.about.imageUrl && (
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                placeholder="Imagen subida"
                                value={landingForm.about.imageUrl}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAboutChange('imageUrl', '')}
                                disabled={uploadingAbout}
                                title="Eliminar imagen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{(copy as any)?.opportunity?.title ?? 'Oportunidad de negocio'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {(copy as any)?.opportunity?.description ??
                        'Configura los textos generales de la sección de oportunidad. Las fases se gestionan desde Configuración de la Aplicación.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={(copy as any)?.opportunity?.fields?.title ?? 'Título de la sección'}
                        value={landingForm?.opportunity.title ?? ''}
                        onChange={(event) => handleOpportunityFieldChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={(copy as any)?.opportunity?.fields?.duplicationNote ?? 'Nota de duplicación'}
                        value={landingForm?.opportunity.duplicationNote ?? ''}
                        onChange={(event) => handleOpportunityFieldChange('duplicationNote', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-24 w-full md:col-span-2" />
                    ) : (
                      <Textarea
                        rows={3}
                        placeholder={(copy as any)?.opportunity?.fields?.subtitle ?? 'Subtítulo de la sección'}
                        value={landingForm?.opportunity.subtitle ?? ''}
                        onChange={(event) => handleOpportunityFieldChange('subtitle', event.target.value)}
                        required
                        minLength={1}
                        className="md:col-span-2"
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={(copy as any)?.opportunity?.fields?.networkCap ?? 'Capacidad visible de red'}
                        value={landingForm?.opportunity.networkCap ?? ''}
                        onChange={(event) => handleOpportunityFieldChange('networkCap', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}

                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={(copy as any)?.opportunity?.fields?.summaryTitle ?? 'Título de resumen (opcional)'}
                        value={landingForm?.opportunity.summary?.title ?? ''}
                        onChange={(event) => handleOpportunitySummaryChange('title', event.target.value)}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={(copy as any)?.opportunity?.fields?.summaryDescription ?? 'Descripción de resumen (opcional)'}
                        value={landingForm?.opportunity.summary?.description ?? ''}
                        onChange={(event) => handleOpportunitySummaryChange('description', event.target.value)}
                      />
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{copy?.testimonials?.title ?? 'Testimonios'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {copy?.testimonials?.description ?? 'Comparte historias y resultados de tus miembros o clientes.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addTestimonial} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {copy?.testimonials?.addTestimonial ?? 'Agregar testimonio'}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.testimonials?.fields?.title ?? 'Título de la sección'}
                        value={landingForm?.testimonials.title ?? ''}
                        onChange={(event) => handleTestimonialsTitleChange(event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-40 w-full" />
                    ) : (
                      landingForm.testimonials.testimonials.map((testimonial, index) => (
                        <Card key={testimonial.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {copy?.testimonials?.itemLabel
                                ? copy.testimonials.itemLabel.replace('{{index}}', String(index + 1))
                                : `Testimonio ${index + 1}`}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTestimonial(index)}
                              disabled={isRemovingTestimonialsDisabled}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {copy?.testimonials?.removeTestimonial ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={copy?.testimonials?.fields?.name ?? 'Nombre o título'}
                              value={testimonial.name}
                              onChange={(event) => handleTestimonialFieldChange(index, 'name', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={4}
                              placeholder={copy?.testimonials?.fields?.quote ?? 'Mensaje principal'}
                              value={testimonial.quote}
                              onChange={(event) => handleTestimonialFieldChange(index, 'quote', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={copy?.testimonials?.fields?.role ?? 'Rol o nota (opcional)'}
                              value={testimonial.role ?? ''}
                              onChange={(event) => handleTestimonialFieldChange(index, 'role', event.target.value)}
                            />
                            <div className="space-y-2">
                              <Label>{copy?.testimonials?.fields?.imageUrl ?? 'Imagen'}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleTestimonialFileChange(index, e)}
                                  disabled={uploadingTestimonials[index]}
                                  className="hidden"
                                  id={`testimonialFile-${index}`}
                                />
                                <Label htmlFor={`testimonialFile-${index}`} className="cursor-pointer">
                                  <Button type="button" variant="outline" size="sm" disabled={uploadingTestimonials[index]} asChild>
                                    <span>
                                      {uploadingTestimonials[index] ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                      )}
                                      {uploadingTestimonials[index] ? 'Subiendo...' : 'Subir imagen'}
                                    </span>
                                  </Button>
                                </Label>
                                {testimonial.imageUrl && (
                                  <div className="flex-1 flex items-center gap-2">
                                    <Input
                                      placeholder="Imagen subida"
                                      value={testimonial.imageUrl}
                                      onChange={(event) => handleTestimonialFieldChange(index, 'imageUrl', event.target.value)}
                                      disabled={uploadingTestimonials[index]}
                                      readOnly
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleTestimonialFieldChange(index, 'imageUrl', '')}
                                      disabled={uploadingTestimonials[index]}
                                      title="Eliminar imagen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                {/* Team Section - Featured Member Selection */}
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{(copy as any)?.team?.title ?? 'Equipo Destacado'}</h2>
                    <p className="text-sm text-muted-foreground">
                      Selecciona hasta 4 miembros del equipo para mostrar en la landing page. Los miembros se gestionan desde la pestaña &quot;Team&quot; en el panel de Páginas.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <>
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="team-section-title">Título de la sección</Label>
                          <Input
                            id="team-section-title"
                            placeholder="Nuestro Equipo"
                            value={landingForm?.team?.title ?? ''}
                            onChange={(event) => handleTeamTitleChange(event.target.value)}
                            required
                            minLength={1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="team-section-subtitle">Subtítulo de la sección</Label>
                          <Input
                            id="team-section-subtitle"
                            placeholder="Conoce a las personas detrás de nuestro éxito"
                            value={landingForm?.team?.subtitle ?? ''}
                            onChange={(event) => handleTeamSubtitleChange(event.target.value)}
                            required
                            minLength={1}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold">Miembros Destacados (máx. 4)</h3>
                        <p className="text-sm text-muted-foreground">
                          Selecciona los miembros que aparecerán en la landing page
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadAvailableTeamMembers(selectedLocale)}
                        disabled={loadingTeamMembers}
                      >
                        {loadingTeamMembers ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Recargar
                      </Button>
                    </div>

                    {loadingTeamMembers ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-24 w-full" />
                        ))}
                      </div>
                    ) : availableTeamMembers.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No hay miembros del equipo disponibles. Agrega miembros desde la pestaña &quot;Team&quot; en el panel de Páginas.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {availableTeamMembers.map((member) => {
                          const isSelected = landingForm?.team?.featuredMemberIds.includes(member.id) ?? false;
                          const canSelect = isSelected || (landingForm?.team?.featuredMemberIds.length ?? 0) < 4;

                          return (
                            <Card
                              key={member.id}
                              className={`cursor-pointer transition-all ${isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : canSelect
                                  ? 'hover:border-primary/50 hover:bg-accent'
                                  : 'opacity-50 cursor-not-allowed'
                                }`}
                              onClick={() => canSelect && toggleFeaturedMember(member.id)}
                            >
                              <CardContent className="flex items-center gap-4 p-4">
                                <div className="flex-shrink-0">
                                  {member.imageUrl ? (
                                    <div className="relative h-16 w-16 overflow-hidden rounded-full">
                                      <Image
                                        src={member.imageUrl}
                                        alt={member.name}
                                        width={64}
                                        height={64}
                                        className="h-full w-full object-cover"
                                        unoptimized
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                      <span className="text-lg font-semibold text-primary">
                                        {member.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold truncate">{member.name}</h4>
                                  <p className="text-sm text-muted-foreground truncate">{member.role}</p>
                                </div>
                                <div className="flex-shrink-0">
                                  <Switch
                                    checked={isSelected}
                                    disabled={!canSelect}
                                    onCheckedChange={() => canSelect && toggleFeaturedMember(member.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {landingForm?.team && landingForm.team.featuredMemberIds.length > 0 && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                      <h3 className="text-sm font-semibold mb-2 text-primary">
                        Miembros seleccionados ({landingForm.team.featuredMemberIds.length}/4)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {landingForm.team.featuredMemberIds.map((memberId) => {
                          const member = availableTeamMembers.find(m => m.id === memberId);
                          return member ? (
                            <span key={memberId} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                              {member.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        La sección se adaptará automáticamente a la cantidad de miembros seleccionados (1-4).
                      </p>
                    </div>
                  )}
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{copy?.featuredProducts?.title ?? 'Productos destacados'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {copy?.featuredProducts?.description ?? 'Configura el mensaje y el estado vacío del catálogo destacado.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.featuredProducts?.fields?.title ?? 'Título de la sección'}
                        value={landingForm?.featuredProducts.title ?? ''}
                        onChange={(event) => handleFeaturedProductsFieldChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.featuredProducts?.fields?.subtitle ?? 'Subtítulo o descripción'}
                        value={landingForm?.featuredProducts.subtitle ?? ''}
                        onChange={(event) => handleFeaturedProductsFieldChange('subtitle', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <Input
                        placeholder={copy?.featuredProducts?.fields?.emptyState ?? 'Mensaje cuando no hay productos'}
                        value={landingForm?.featuredProducts.emptyState ?? ''}
                        onChange={(event) => handleFeaturedProductsFieldChange('emptyState', event.target.value)}
                        required
                        minLength={1}
                        className="md:col-span-2"
                      />
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{copy?.contact?.title ?? 'Contacto'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {copy?.contact?.description ?? 'Actualiza la información visible y los placeholders del formulario.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.title ?? 'Título de la sección'}
                        value={landingForm?.contact.title ?? ''}
                        onChange={(event) => handleContactFieldChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        type="email"
                        placeholder={copy?.contact?.fields?.recipientEmail ?? 'Correo destinatario'}
                        value={landingForm?.contact.recipientEmail ?? ''}
                        onChange={(event) => handleContactFieldChange('recipientEmail', event.target.value)}
                        required
                        minLength={3}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-24 w-full md:col-span-2" />
                    ) : (
                      <Textarea
                        rows={3}
                        placeholder={copy?.contact?.fields?.description ?? 'Descripción de la sección'}
                        value={landingForm?.contact.description ?? ''}
                        onChange={(event) => handleContactFieldChange('description', event.target.value)}
                        required
                        minLength={1}
                        className="md:col-span-2"
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.phone ?? 'Teléfono de contacto'}
                        value={landingForm?.contact.contactInfo.phone ?? ''}
                        onChange={(event) => handleContactInfoFieldChange('phone', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        type="email"
                        placeholder={copy?.contact?.fields?.email ?? 'Correo de contacto'}
                        value={landingForm?.contact.contactInfo.email ?? ''}
                        onChange={(event) => handleContactInfoFieldChange('email', event.target.value)}
                        required
                        minLength={3}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.address ?? 'Dirección física'}
                        value={landingForm?.contact.contactInfo.address ?? ''}
                        onChange={(event) => handleContactInfoFieldChange('address', event.target.value)}
                        required
                        minLength={1}
                        className="md:col-span-2"
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.namePlaceholder ?? 'Placeholder nombre'}
                        value={landingForm?.contact.form.namePlaceholder ?? ''}
                        onChange={(event) => handleContactFormFieldChange('namePlaceholder', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.emailPlaceholder ?? 'Placeholder correo'}
                        value={landingForm?.contact.form.emailPlaceholder ?? ''}
                        onChange={(event) => handleContactFormFieldChange('emailPlaceholder', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.messagePlaceholder ?? 'Placeholder mensaje'}
                        value={landingForm?.contact.form.messagePlaceholder ?? ''}
                        onChange={(event) => handleContactFormFieldChange('messagePlaceholder', event.target.value)}
                        required
                        minLength={1}
                        className="md:col-span-2"
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={copy?.contact?.fields?.sendButton ?? 'Texto del botón'}
                        value={landingForm?.contact.form.sendButton ?? ''}
                        onChange={(event) => handleContactFormFieldChange('sendButton', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {copy?.howItWorks?.title ?? 'Cómo funciona'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {copy?.howItWorks?.description ??
                          'Describe los pasos que deben seguir tus distribuidores o clientes. Debe existir al menos un paso.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addStep}
                      disabled={loading}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {copy?.howItWorks?.addStep ?? 'Agregar paso'}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="howItWorksTitle"
                        name="howItWorksTitle"
                        placeholder={copy?.howItWorks?.fields?.sectionTitle ?? 'Título de la sección'}
                        value={landingForm?.howItWorks.title ?? ''}
                        onChange={(event) => handleHowItWorksFieldChange('title', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="howItWorksSubtitle"
                        name="howItWorksSubtitle"
                        placeholder={copy?.howItWorks?.fields?.sectionSubtitle ?? 'Subtítulo de la sección'}
                        value={landingForm?.howItWorks.subtitle ?? ''}
                        onChange={(event) => handleHowItWorksFieldChange('subtitle', event.target.value)}
                        required
                        minLength={1}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-40 w-full" />
                    ) : (
                      landingForm.howItWorks.steps.map((step, index) => (
                        <Card key={step.id ?? index} className="border-primary/20 bg-muted/30">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {copy?.howItWorks?.stepLabel
                                ? copy.howItWorks.stepLabel.replace('{{index}}', String(index + 1))
                                : `Paso ${index + 1}`}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(index)}
                              disabled={isRemovingStepsDisabled}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {copy?.howItWorks?.removeStep ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={copy?.howItWorks?.fields?.stepTitle ?? 'Título del paso'}
                              value={step.title}
                              onChange={(event) => updateStep(index, 'title', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={3}
                              placeholder={copy?.howItWorks?.fields?.stepDescription ?? 'Descripción del paso'}
                              value={step.description}
                              onChange={(event) => updateStep(index, 'description', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="space-y-2">
                              <Label>{copy?.howItWorks?.fields?.stepImageUrl ?? 'Imagen'}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleStepFileChange(index, e)}
                                  disabled={uploadingSteps[index]}
                                  className="hidden"
                                  id={`stepFile-${index}`}
                                />
                                <Label htmlFor={`stepFile-${index}`} className="cursor-pointer">
                                  <Button type="button" variant="outline" size="sm" disabled={uploadingSteps[index]} asChild>
                                    <span>
                                      {uploadingSteps[index] ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                      )}
                                      {uploadingSteps[index] ? 'Subiendo...' : 'Subir imagen'}
                                    </span>
                                  </Button>
                                </Label>
                                {step.imageUrl && (
                                  <div className="flex-1 flex items-center gap-2">
                                    <Input
                                      placeholder="Imagen subida"
                                      value={step.imageUrl}
                                      readOnly
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateStep(index, 'imageUrl', '')}
                                      disabled={uploadingSteps[index]}
                                      title="Eliminar imagen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {copy?.faqs?.title ?? 'Preguntas frecuentes'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {copy?.faqs?.description ??
                          'Agrega respuestas a las preguntas más comunes. Puedes dejar esta sección vacía si no la necesitas.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addFaq} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {copy?.faqs?.addFaq ?? 'Agregar pregunta'}
                    </Button>
                  </div>

                  {loading || !landingForm ? (
                    <Skeleton className="h-40 w-full" />
                  ) : landingForm.faqs.length === 0 ? (
                    <p className="rounded-md border border-dashed border-primary/40 p-6 text-center text-sm text-muted-foreground">
                      {copy?.faqs?.empty ?? 'Aún no hay preguntas registradas.'}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {landingForm.faqs.map((faq, index) => (
                        <Card key={faq.id ?? index} className="border-primary/10">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {copy?.faqs?.questionLabel
                                ? `${copy.faqs.questionLabel} ${index + 1}`
                                : `Pregunta ${index + 1}`}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFaq(index)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {copy?.faqs?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={copy?.faqs?.questionPlaceholder ?? 'Pregunta'}
                              value={faq.question}
                              onChange={(event) => updateFaq(index, 'question', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={3}
                              placeholder={copy?.faqs?.answerPlaceholder ?? 'Respuesta'}
                              value={faq.answer}
                              onChange={(event) => updateFaq(index, 'answer', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="space-y-2">
                              <Label>{copy?.faqs?.imageLabel ?? 'Imagen'}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFaqFileChange(index, e)}
                                  disabled={uploadingFaqs[index]}
                                  className="hidden"
                                  id={`faqFile-${index}`}
                                />
                                <Label htmlFor={`faqFile-${index}`} className="cursor-pointer">
                                  <Button type="button" variant="outline" size="sm" disabled={uploadingFaqs[index]} asChild>
                                    <span>
                                      {uploadingFaqs[index] ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                      )}
                                      {uploadingFaqs[index] ? 'Subiendo...' : 'Subir imagen'}
                                    </span>
                                  </Button>
                                </Label>
                                {faq.imageUrl && (
                                  <div className="flex-1 flex items-center gap-2">
                                    <Input
                                      placeholder="Imagen subida"
                                      value={faq.imageUrl}
                                      readOnly
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateFaq(index, 'imageUrl', '')}
                                      disabled={uploadingFaqs[index]}
                                      title="Eliminar imagen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              </CardContent>
            </Card>

          </TabsContent>
          <TabsContent value="footer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{(copy as any)?.footer?.title ?? 'Contenido del footer'}</CardTitle>
                <CardDescription>
                  {(copy as any)?.footer?.description ??
                    'Configura el eslogan, los enlaces y los perfiles sociales visibles al final de cada página.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section className="space-y-4">
                  <div className="space-y-2">
                    <Label>{(copy as any)?.footer?.taglineLabel ?? 'Eslogan'}</Label>
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        value={landingForm?.footer.tagline ?? ''}
                        onChange={(event) => handleFooterFieldChange('tagline', event.target.value)}
                        required={landingForm?.footer.showBrandingDescription ?? true}
                        minLength={landingForm?.footer.showBrandingDescription ?? true ? 1 : undefined}
                        disabled={landingForm?.footer.showBrandingDescription === false}
                      />
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {footerBrandingCopy?.showLogo ?? 'Mostrar logo'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {footerBrandingCopy?.showLogoDescription ??
                            'Controla si el logotipo aparece en el bloque de marca del footer.'}
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="h-6 w-11 rounded-full" />
                      ) : (
                        <Switch
                          checked={landingForm?.footer.showBrandingLogo ?? true}
                          onCheckedChange={(checked) => handleFooterFieldChange('showBrandingLogo', checked)}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {footerBrandingCopy?.showAppName ?? 'Mostrar nombre de la app'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {footerBrandingCopy?.showAppNameDescription ??
                            'Oculta o muestra el nombre comercial junto al logo.'}
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="h-6 w-11 rounded-full" />
                      ) : (
                        <Switch
                          checked={landingForm?.footer.showBrandingAppName ?? true}
                          onCheckedChange={(checked) => handleFooterFieldChange('showBrandingAppName', checked)}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {footerBrandingCopy?.showDescription ?? 'Mostrar descripción'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {footerBrandingCopy?.showDescriptionDescription ??
                            'Activa el eslogan debajo de tu identidad visual.'}
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="h-6 w-11 rounded-full" />
                      ) : (
                        <Switch
                          checked={landingForm?.footer.showBrandingDescription ?? true}
                          onCheckedChange={(checked) => handleFooterFieldChange('showBrandingDescription', checked)}
                        />
                      )}
                    </div>
                  </div>

                  {(landingForm?.footer.showBrandingAppName ?? true) && (
                    <div className="space-y-2">
                      <Label htmlFor="footer-branding-app-name">
                        {footerBrandingCopy?.appNameLabel ?? 'Nombre mostrado en el footer'}
                      </Label>
                      {loading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Input
                          id="footer-branding-app-name"
                          value={landingForm?.footer.brandingAppName ?? ''}
                          onChange={(event) => handleFooterFieldChange('brandingAppName', event.target.value)}
                          placeholder={footerBrandingCopy?.appNamePlaceholder ?? 'Ej. PūrVita Network'}
                          required={(landingForm?.footer.showBrandingAppName ?? true) && !loading}
                          minLength={1}
                          maxLength={180}
                        />
                      )}
                    </div>
                  )}

                  {((landingForm?.footer.showBrandingLogo ?? true) ||
                    (landingForm?.footer.showBrandingAppName ?? true)) && (
                      <div className="space-y-2">
                        <Label htmlFor="footer-branding-orientation">
                          {footerBrandingCopy?.orientation ?? 'Orientación del logo'}
                        </Label>
                        {loading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <Select
                            value={landingForm?.footer.brandingOrientation ?? 'beside'}
                            onValueChange={(value) =>
                              handleFooterFieldChange('brandingOrientation', value as 'beside' | 'above' | 'below')
                            }
                          >
                            <SelectTrigger id="footer-branding-orientation">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beside">Logo al lado del nombre</SelectItem>
                              <SelectItem value="above">Logo encima del nombre</SelectItem>
                              <SelectItem value="below">Logo debajo del nombre</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{(copy as any)?.footer?.navigation?.title ?? 'Enlaces de navegación'}</h3>
                      <p className="text-sm text-muted-foreground">{(copy as any)?.footer?.navigation?.description ?? 'Resalta las secciones más importantes.'}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => addFooterLink('navigationLinks')} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {(copy as any)?.footer?.navigation?.add ?? 'Agregar enlace'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      landingForm.footer.navigationLinks.map((link, index) => (
                        <Card key={link.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">{((copy as any)?.footer?.navigation?.label ?? 'Enlace {{index}}').replace('{{index}}', String(index + 1))}</CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeFooterLink('navigationLinks', index)} disabled={landingForm.footer.navigationLinks.length <= 1}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {(copy as any)?.footer?.navigation?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={(copy as any)?.footer?.navigation?.label ?? 'Etiqueta'}
                              value={link.label}
                              onChange={(event) => handleFooterLinkFieldChange('navigationLinks', index, 'label', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={(copy as any)?.footer?.navigation?.href ?? 'URL o ancla'}
                              value={link.href}
                              onChange={(event) => handleFooterLinkFieldChange('navigationLinks', index, 'href', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                              <span className="text-sm font-medium">Abrir en nueva pestaña</span>
                              <Switch
                                checked={link.openInNewTab ?? false}
                                onCheckedChange={(checked) => handleFooterLinkFieldChange('navigationLinks', index, 'openInNewTab', checked)}
                              />
                            </div>
                            <LinkVisibilityConfig
                              visibility={link.visibility}
                              onChange={(visibility) => handleFooterLinkFieldChange('navigationLinks', index, 'visibility', visibility)}
                              disabled={loading}
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{(copy as any)?.footer?.legal?.title ?? 'Enlaces legales'}</h3>
                      <p className="text-sm text-muted-foreground">{(copy as any)?.footer?.legal?.description ?? 'Incluye tus políticas más importantes.'}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => addFooterLink('legalLinks')} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {(copy as any)?.footer?.legal?.add ?? 'Agregar enlace'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      landingForm.footer.legalLinks.map((link, index) => (
                        <Card key={link.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">{((copy as any)?.footer?.legal?.label ?? 'Enlace {{index}}').replace('{{index}}', String(index + 1))}</CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeFooterLink('legalLinks', index)} disabled={landingForm.footer.legalLinks.length <= 1}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {(copy as any)?.footer?.legal?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={(copy as any)?.footer?.legal?.label ?? 'Etiqueta'}
                              value={link.label}
                              onChange={(event) => handleFooterLinkFieldChange('legalLinks', index, 'label', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={(copy as any)?.footer?.legal?.href ?? 'URL'}
                              value={link.href}
                              onChange={(event) => handleFooterLinkFieldChange('legalLinks', index, 'href', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                              <span className="text-sm font-medium">Abrir en nueva pestaña</span>
                              <Switch
                                checked={link.openInNewTab ?? false}
                                onCheckedChange={(checked) => handleFooterLinkFieldChange('legalLinks', index, 'openInNewTab', checked)}
                              />
                            </div>
                            <LinkVisibilityConfig
                              visibility={link.visibility}
                              onChange={(visibility) => handleFooterLinkFieldChange('legalLinks', index, 'visibility', visibility)}
                              disabled={loading}
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{(copy as any)?.footer?.social?.title ?? 'Perfiles sociales'}</h3>
                      <p className="text-sm text-muted-foreground">{(copy as any)?.footer?.social?.description ?? 'Comparte los perfiles en los que la comunidad puede seguirte.'}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addFooterSocial} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {(copy as any)?.footer?.social?.add ?? 'Agregar perfil'}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {loading || !landingForm ? (
                      <Skeleton className="h-24 w-full" />
                    ) : landingForm.footer.socialLinks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{(copy as any)?.footer?.social?.empty ?? 'Añade al menos un perfil social.'}</p>
                    ) : (
                      landingForm.footer.socialLinks.map((link, index) => (
                        <Card key={link.id ?? index} className="border-muted/30 bg-muted/20">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">{((copy as any)?.footer?.social?.label ?? 'Perfil {{index}}').replace('{{index}}', String(index + 1))}</CardTitle>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeFooterSocial(index)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              {(copy as any)?.footer?.social?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="grid gap-3 md:grid-cols-2">
                            <Select
                              value={link.platform}
                              onValueChange={(value) => handleFooterSocialFieldChange(index, 'platform', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="facebook">Facebook</SelectItem>
                                <SelectItem value="instagram">Instagram</SelectItem>
                                <SelectItem value="twitter">Twitter/X</SelectItem>
                                <SelectItem value="linkedin">LinkedIn</SelectItem>
                                <SelectItem value="youtube">YouTube</SelectItem>
                                <SelectItem value="tiktok">TikTok</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder={(copy as any)?.footer?.social?.label ?? 'Etiqueta accesible'}
                              value={link.label}
                              onChange={(event) => handleFooterSocialFieldChange(index, 'label', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={(copy as any)?.footer?.social?.href ?? 'URL del perfil'}
                              value={link.href}
                              onChange={(event) => handleFooterSocialFieldChange(index, 'href', event.target.value)}
                              required
                              minLength={1}
                              className="md:col-span-2"
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                    <span className="text-sm font-medium">{(copy as any)?.footer?.toggles?.language ?? 'Mostrar selector de idioma'}</span>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <Switch
                        checked={landingForm?.footer.showLanguageSwitcher ?? false}
                        onCheckedChange={(checked) => handleFooterFieldChange('showLanguageSwitcher', checked)}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                    <span className="text-sm font-medium">{(copy as any)?.footer?.toggles?.theme ?? 'Mostrar selector de tema'}</span>
                    {loading ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <Switch
                        checked={landingForm?.footer.showThemeSwitcher ?? false}
                        onCheckedChange={(checked) => handleFooterFieldChange('showThemeSwitcher', checked)}
                      />
                    )}
                  </div>
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affiliate & MLM Pages Configuration Tab */}
          <TabsContent value="affiliate" className="space-y-6">
            {/* Affiliate Pages Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>{'Configuración de Páginas de Afiliados'}</CardTitle>
                <CardDescription>
                  {'Controla la apariencia y funcionalidad de las páginas personalizadas de tus afiliados.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header Settings for Affiliate Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración del Header'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Controla qué elementos aparecen en el header de las páginas de afiliados.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar carrito'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Permite a los visitantes ver el carrito de compras.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.header.showCart}
                        onCheckedChange={(checked) => handleAffiliateChange('header', 'showCart', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar menú de usuario'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra el menú de usuario cuando está autenticado.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.header.showUserMenu}
                        onCheckedChange={(checked) => handleAffiliateChange('header', 'showUserMenu', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir logo personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los afiliados pueden subir su propio logo.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.header.allowCustomLogo}
                        onCheckedChange={(checked) => handleAffiliateChange('header', 'allowCustomLogo', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir nombre de tienda personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los afiliados pueden personalizar el nombre de su tienda.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.header.allowCustomStoreName}
                        onCheckedChange={(checked) => handleAffiliateChange('header', 'allowCustomStoreName', checked)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Footer Settings for Affiliate Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración del Footer'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Controla qué elementos aparecen en el footer de las páginas de afiliados.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar footer'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra el footer en las páginas de afiliados.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.footer.showFooter}
                        onCheckedChange={(checked) => handleAffiliateChange('footer', 'showFooter', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Heredar enlaces sociales'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Usa los enlaces sociales del sitio principal.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.footer.inheritSocialLinks}
                        onCheckedChange={(checked) => handleAffiliateChange('footer', 'inheritSocialLinks', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar branding'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra la sección de marca en el footer.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.footer.showBranding}
                        onCheckedChange={(checked) => handleAffiliateChange('footer', 'showBranding', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Selector de idioma'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Permite cambiar el idioma desde el footer.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.footer.showLanguageSwitcher}
                        onCheckedChange={(checked) => handleAffiliateChange('footer', 'showLanguageSwitcher', checked)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Global Settings for Affiliate Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración Global de Afiliados'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Opciones generales para todas las páginas de afiliados.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir banner personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los afiliados pueden subir un banner para su página.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.settings.allowCustomBanner}
                        onCheckedChange={(checked) => handleAffiliateChange('settings', 'allowCustomBanner', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir título de tienda personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los afiliados pueden personalizar el título de su tienda.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.settings.allowCustomStoreTitle}
                        onCheckedChange={(checked) => handleAffiliateChange('settings', 'allowCustomStoreTitle', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar badge "Powered by"'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra un badge indicando que la página está potenciada por tu plataforma.'}
                        </p>
                      </div>
                      <Switch
                        checked={affiliateForm.settings.showPoweredByBadge}
                        onCheckedChange={(checked) => handleAffiliateChange('settings', 'showPoweredByBadge', checked)}
                      />
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>

            {/* MLM Pages Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>{'Configuración de Páginas MLM'}</CardTitle>
                <CardDescription>
                  {'Controla la apariencia y funcionalidad de las páginas personalizadas de usuarios MLM (multinivel).'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header Settings for MLM Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración del Header MLM'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Controla qué elementos aparecen en el header de las páginas de usuarios MLM.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar carrito'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Permite a los visitantes ver el carrito de compras.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar menú de usuario'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra el menú de usuario cuando está autenticado.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir logo personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los usuarios MLM pueden subir su propio logo.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir nombre de tienda personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los usuarios MLM pueden personalizar el nombre de su tienda.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Footer Settings for MLM Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración del Footer MLM'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Controla qué elementos aparecen en el footer de las páginas de usuarios MLM.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar footer'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra el footer en las páginas MLM.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Heredar enlaces sociales'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Usa los enlaces sociales del sitio principal.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar branding'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra la sección de marca en el footer.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Selector de idioma'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Permite cambiar el idioma desde el footer.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Global Settings for MLM Pages */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">{'Configuración Global MLM'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {'Opciones generales para todas las páginas de usuarios MLM.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir banner personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los usuarios MLM pueden subir un banner para su página.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Permitir título de tienda personalizado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Los usuarios MLM pueden personalizar el título de su tienda.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar badge "Powered by"'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra un badge indicando que la página está potenciada por tu plataforma.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{'Mostrar enlaces de equipo'}</p>
                        <p className="text-xs text-muted-foreground">
                          {'Muestra enlaces para ver el equipo y la red del usuario MLM.'}
                        </p>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                      />
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>

            {/* Info Alert */}
            <Alert>
              <AlertTitle>{'Información'}</AlertTitle>
              <AlertDescription>
                {'Los usuarios con suscripción activa pueden personalizar su logo, banner y nombre de tienda desde su panel de control en la sección de configuración de tienda. La configuración aquí controla qué opciones están disponibles para ellos.'}
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {(copy as any)?.footerNote ??
              'Los cambios son visibles inmediatamente en la landing page y en toda la aplicación.'}
          </p>
          <Button type="submit" disabled={saving || loading} className="min-w-[180px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy?.submit?.saving ?? 'Guardando...'}
              </>
            ) : (
              copy?.submit?.label ?? 'Guardar configuración'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
