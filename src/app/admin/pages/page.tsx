'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  SiteBrandingSchema,
  type SiteBranding,
} from '@/modules/site-content/domain/models/site-branding';
import {
  StaticPagesSchema,
  type StaticPages as _StaticPages,
  type StaticPagesUpdateInput,
} from '@/modules/site-content/domain/models/static-pages';
import type { LandingContentUpdateInput } from '@/modules/site-content/services/site-content-service';
import {
  TeamPageContentSchema,
  type TeamPageContent,
  type TeamMember,
} from '@/modules/site-content/domain/models/team-page';
import { supabase, PAGE_BUCKET } from '@/lib/supabase';
import { ArrowDown, ArrowUp, Loader2, PlusCircle, RefreshCcw, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import type { PhaseLevel } from '@/modules/phase-levels/domain/models/phase-level';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

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
type StaticPagesFormState = StaticPagesUpdateInput;

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
});

const mapFooterLink = (link: LandingFooterLink, index: number): LandingFooterLink => ({
  id: link.id,
  label: link.label,
  href: link.href,
  order: index,
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
    backgroundImageUrl: landing.hero.backgroundImageUrl ?? '',
    backgroundColor: landing.hero.backgroundColor ?? '',
    style: landing.hero.style,
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
  team: {
    title: landing.team.title,
    subtitle: landing.team.subtitle,
    featuredMemberIds: landing.team.featuredMemberIds ?? [],
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
});

const createEmptyLandingFormState = (): LandingFormState => ({
  hero: {
    title: '',
    subtitle: '',
    backgroundImageUrl: '',
    backgroundColor: '',
    style: 'default',
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
  team: {
    title: 'Meet Our Team',
    subtitle: 'The people behind our success',
    featuredMemberIds: [],
  },
  header: {
    landingLinks: [
      {
        id: `landing-link-${Date.now()}`,
        label: '',
        href: '#',
        requiresAuth: false,
        order: 0,
      },
    ],
    authenticatedLinks: [
      {
        id: `auth-link-${Date.now()}`,
        label: '',
        href: '/',
        requiresAuth: true,
        order: 0,
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
      },
    ],
    legalLinks: [
      {
        id: `footer-legal-${Date.now()}`,
        label: '',
        href: '#',
        order: 0,
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
});

const createEmptyTeamPageFormState = (locale: Locale): TeamPageContent => ({
  locale,
  title: 'Meet Our Team',
  subtitle: 'The people behind our success',
  members: [],
  featuredMemberIds: [],
});

const toRequestPayload = (
  locale: Locale,
  branding: BrandingFormState,
  landing: LandingFormState,
) => ({
  locale,
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
      backgroundColor: landing.hero.backgroundColor?.trim()
        ? landing.hero.backgroundColor.trim()
        : null,
      style: landing.hero.style,
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
    team: {
      title: landing.team.title,
      subtitle: landing.team.subtitle,
      featuredMemberIds: landing.team.featuredMemberIds ?? [],
    },
    header: {
      landingLinks: landing.header.landingLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        requiresAuth: link.requiresAuth ?? false,
        order: index,
      })),
      authenticatedLinks: landing.header.authenticatedLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        requiresAuth: link.requiresAuth ?? true,
        order: index,
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
      })),
      legalLinks: landing.footer.legalLinks.map((link, index) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        order: index,
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
  const copy = dict.admin?.pages;
  const siteContentCopy = dict.admin?.siteContent;
  const _footerBrandingCopy = (siteContentCopy?.footer as { branding?: FooterBrandingCopy } | undefined)?.branding;
  const { toast } = useToast();

  const [selectedLocale, setSelectedLocale] = useState<Locale>(initialLocale);
  const [brandingForm, setBrandingForm] = useState<BrandingFormState>(() =>
    createBrandingState(globalBranding),
  );
  const [landingForm, setLandingForm] = useState<LandingFormState | null>(null);
  const [teamPageForm, setTeamPageForm] = useState<TeamPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_uploadingLogo, setUploadingLogo] = useState(false);
  const [_uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingAbout, setUploadingAbout] = useState(false);
  const [uploadingSteps, setUploadingSteps] = useState<Record<number, boolean>>({});
  const [uploadingFaqs, setUploadingFaqs] = useState<Record<number, boolean>>({});
  const [uploadingTeamMembers, _setUploadingTeamMembers] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'landing' | 'team' | 'contact' | 'privacy' | 'terms'>('landing');
  const [staticPagesForm, setStaticPagesForm] = useState<StaticPagesFormState | null>(null);
  const [_phaseLevels, setPhaseLevels] = useState<PhaseLevel[]>([]);
  const [_loadingPhases, setLoadingPhases] = useState(false);
  const [_savingPhases, setSavingPhases] = useState<Record<string, boolean>>({});
  
  // Affiliate Opportunity state
  type AffiliateOpportunityFormState = {
    isEnabled: boolean;
    title: string;
    subtitle: string;
    description: string;
    benefits: Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      order: number;
    }>;
    commissionRate: string;
    commissionLabel: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
  };
  const [affiliateOpportunity, setAffiliateOpportunity] = useState<AffiliateOpportunityFormState | null>(null);
  const [loadingAffiliateOpportunity, setLoadingAffiliateOpportunity] = useState(false);
  const [_savingAffiliateOpportunity, setSavingAffiliateOpportunity] = useState(false);
  const [uploadingAffiliateOpportunityImage, setUploadingAffiliateOpportunityImage] = useState(false);
  const [uploadingTestimonials, setUploadingTestimonials] = useState<Record<number, boolean>>({});

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

        setBrandingForm(createBrandingState(branding));
        setLandingForm(createLandingState(landing));
      } catch (_err) {
        console.error('Failed to load site content configuration', _err);
        setError(copy?.errorLoading ?? 'No pudimos cargar la configuración actual.');
        setLandingForm((prev) => prev ?? createEmptyLandingFormState());
        toast({
          title: siteContentCopy?.toast?.loadError?.title ?? 'Error al cargar',
          description: siteContentCopy?.toast?.loadError?.description ??
            'No se pudo obtener la configuración. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [copy?.errorLoading, siteContentCopy?.toast?.loadError?.title, siteContentCopy?.toast?.loadError?.description, toast],
  );

  const loadStaticPages = useCallback(
    async (locale: Locale) => {
      try {
        const response = await fetch(`/api/admin/static-pages?locale=${locale}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('Failed to load static pages');
          return;
        }

        const payload = await response.json();
        const staticPages = StaticPagesSchema.parse(payload);

        setStaticPagesForm({
          contact: staticPages.contact,
          privacy: staticPages.privacy,
          terms: staticPages.terms,
        });
      } catch (_err) {
        console.error('Failed to load static pages', _err);
      }
    },
    [],
  );

  const loadTeamPage = useCallback(
    async (locale: Locale) => {
      try {
        const response = await fetch(`/api/admin/team-page?locale=${locale}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('Failed to load team page');
          setTeamPageForm(createEmptyTeamPageFormState(locale));
          return;
        }

        const payload = await response.json();
        const teamPage = TeamPageContentSchema.parse(payload);
        setTeamPageForm(teamPage);
      } catch (_err) {
        console.error('Failed to load team page', _err);
        setTeamPageForm(createEmptyTeamPageFormState(locale));
      }
    },
    [],
  );

  const loadPhaseLevels = useCallback(async () => {
    setLoadingPhases(true);
    try {
      const response = await fetch('/api/admin/phase-levels', {
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('Failed to load phase levels');
        return;
      }

      const payload = await response.json();
      setPhaseLevels(payload.phaseLevels ?? []);
    } catch (_err) {
      console.error('Failed to load phase levels', _err);
    } finally {
      setLoadingPhases(false);
    }
  }, []);

  const _handlePhaseVisibilityToggle = useCallback(
    async (phaseId: string, currentIsActive: boolean) => {
      setSavingPhases((prev) => ({ ...prev, [phaseId]: true }));
      try {
        const response = await adminApi.put(`/api/admin/phase-levels/${phaseId}`, {
          isActive: !currentIsActive,
        });

        if (!response.ok) {
          throw new Error('Failed to update phase visibility');
        }

        // Update local state
        setPhaseLevels((prev) =>
          prev.map((phase) =>
            phase.id === phaseId ? { ...phase, isActive: !currentIsActive } : phase
          )
        );

        toast({
          title: 'Fase actualizada',
          description: `La fase ahora está ${!currentIsActive ? 'visible' : 'oculta'} en la landing page.`,
        });
      } catch (_err) {
        console.error('Failed to update phase visibility', _err);
        toast({
          title: 'Error al actualizar',
          description: 'No se pudo cambiar la visibilidad de la fase.',
          variant: 'destructive',
        });
      } finally {
        setSavingPhases((prev) => ({ ...prev, [phaseId]: false }));
      }
    },
    [toast]
  );

  // Load affiliate opportunity content
  const loadAffiliateOpportunity = useCallback(async (locale: Locale) => {
    setLoadingAffiliateOpportunity(true);
    try {
      const response = await fetch(`/api/admin/affiliate-opportunity?locale=${locale}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('Failed to load affiliate opportunity content');
        return;
      }

      const payload = await response.json();
      const data = payload.affiliateOpportunity;
      setAffiliateOpportunity({
        isEnabled: data.isEnabled ?? true,
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        description: data.description ?? '',
        benefits: (data.benefits ?? []).map((b: any, idx: number) => ({
          id: b.id ?? `benefit-${idx}`,
          icon: b.icon ?? '',
          title: b.title ?? '',
          description: b.description ?? '',
          order: b.order ?? idx,
        })),
        commissionRate: data.commissionRate ?? '',
        commissionLabel: data.commissionLabel ?? '',
        ctaText: data.ctaText ?? '',
        ctaLink: data.ctaLink ?? '',
        imageUrl: data.imageUrl ?? '',
      });
    } catch (_err) {
      console.error('Failed to load affiliate opportunity content', _err);
    } finally {
      setLoadingAffiliateOpportunity(false);
    }
  }, []);

  // Save affiliate opportunity content
  const _saveAffiliateOpportunity = useCallback(async () => {
    if (!affiliateOpportunity) return;
    
    setSavingAffiliateOpportunity(true);
    try {
      const response = await adminApi.put(`/api/admin/affiliate-opportunity?locale=${selectedLocale}`, {
        isEnabled: affiliateOpportunity.isEnabled,
        title: affiliateOpportunity.title,
        subtitle: affiliateOpportunity.subtitle,
        description: affiliateOpportunity.description || null,
        benefits: affiliateOpportunity.benefits.map((b, idx) => ({
          id: b.id,
          icon: b.icon || null,
          title: b.title,
          description: b.description,
          order: idx,
        })),
        commissionRate: affiliateOpportunity.commissionRate || null,
        commissionLabel: affiliateOpportunity.commissionLabel || null,
        ctaText: affiliateOpportunity.ctaText,
        ctaLink: affiliateOpportunity.ctaLink,
        imageUrl: affiliateOpportunity.imageUrl || null,
      });

      if (!response.ok) {
        throw new Error('Failed to save affiliate opportunity content');
      }

      toast({
        title: 'Guardado exitosamente',
        description: 'La sección de oportunidad de afiliados ha sido actualizada.',
      });
    } catch (_err) {
      console.error('Failed to save affiliate opportunity content', _err);
      toast({
        title: 'Error al guardar',
        description: 'No se pudo guardar la configuración de oportunidad de afiliados.',
        variant: 'destructive',
      });
    } finally {
      setSavingAffiliateOpportunity(false);
    }
  }, [affiliateOpportunity, selectedLocale, toast]);

  // Handle affiliate opportunity field changes
  const handleAffiliateOpportunityChange = useCallback(
    (field: keyof Omit<AffiliateOpportunityFormState, 'benefits'>, value: string | boolean) => {
      setAffiliateOpportunity((prev) => prev ? { ...prev, [field]: value } : prev);
    },
    []
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

  // Handle affiliate opportunity image file upload
  const handleAffiliateOpportunityImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingAffiliateOpportunityImage(true);
      try {
        const publicUrl = await uploadFileToPageBucket(file, 'affiliate-opportunity');
        setAffiliateOpportunity((prev) => prev ? { ...prev, imageUrl: publicUrl } : prev);
        toast({
          title: 'Imagen subida',
          description: 'La imagen se subió correctamente.',
        });
      } catch (_err) {
        console.error('Error uploading affiliate opportunity image', _err);
        toast({
          title: 'Error al subir imagen',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingAffiliateOpportunityImage(false);
      }
    },
    [toast, uploadFileToPageBucket]
  );

  // Handle testimonial image file upload
  const handleTestimonialFileChange = useCallback(
    async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingTestimonials((prev) => ({ ...prev, [index]: true }));
      try {
        const publicUrl = await uploadFileToPageBucket(file, `testimonial-${index}`);
        setLandingForm((prev) => {
          if (!prev) return prev;
          const testimonials = prev.testimonials.testimonials.map((testimonial, idx) =>
            idx === index ? { ...testimonial, imageUrl: publicUrl } : testimonial
          );
          return {
            ...prev,
            testimonials: {
              ...prev.testimonials,
              testimonials,
            },
          };
        });
        toast({
          title: 'Imagen subida',
          description: 'La imagen se subió correctamente.',
        });
      } catch (_err) {
        console.error('Error uploading testimonial image', _err);
        toast({
          title: 'Error al subir imagen',
          description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } finally {
        setUploadingTestimonials((prev) => ({ ...prev, [index]: false }));
      }
    },
    [toast, uploadFileToPageBucket]
  );

  // Handle affiliate opportunity benefit changes
  const handleAffiliateBenefitChange = useCallback(
    (index: number, field: 'icon' | 'title' | 'description', value: string) => {
      setAffiliateOpportunity((prev) => {
        if (!prev) return prev;
        const newBenefits = [...prev.benefits];
        newBenefits[index] = { ...newBenefits[index], [field]: value };
        return { ...prev, benefits: newBenefits };
      });
    },
    []
  );

  // Add new benefit
  const addAffiliateBenefit = useCallback(() => {
    setAffiliateOpportunity((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        benefits: [
          ...prev.benefits,
          {
            id: `benefit-${Date.now()}`,
            icon: '',
            title: '',
            description: '',
            order: prev.benefits.length,
          },
        ],
      };
    });
  }, []);

  // Remove benefit
  const removeAffiliateBenefit = useCallback((index: number) => {
    setAffiliateOpportunity((prev) => {
      if (!prev || prev.benefits.length <= 1) return prev;
      return {
        ...prev,
        benefits: prev.benefits.filter((_, i) => i !== index),
      };
    });
  }, []);

  useEffect(() => {
    loadConfiguration(selectedLocale);
    loadStaticPages(selectedLocale);
    loadTeamPage(selectedLocale);
    loadPhaseLevels();
    loadAffiliateOpportunity(selectedLocale);
  }, [selectedLocale, loadConfiguration, loadStaticPages, loadTeamPage, loadPhaseLevels, loadAffiliateOpportunity]);

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


  const _handleLogoFileChange = useCallback(
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

  const _handleFaviconFileChange = useCallback(
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

  const _handleOpportunityFieldChange = useCallback(
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

  const _handleOpportunitySummaryChange = useCallback(
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

  const _handleHeaderActionChange = useCallback(
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

  const _handleHeaderLinkFieldChange = useCallback(
    (
      collection: HeaderLinkCollection,
      index: number,
      field: Exclude<keyof LandingHeaderLink, 'id' | 'order'>,
      value: string | boolean,
    ) => {
      updateHeaderLink(collection, index, (link) => ({
        ...link,
        [field]: field === 'requiresAuth' ? Boolean(value) : (value as string),
      }));
    },
    [updateHeaderLink],
  );

  const _addHeaderLink = useCallback((collection: HeaderLinkCollection) => {
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

  const _removeHeaderLink = useCallback((collection: HeaderLinkCollection, index: number) => {
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

  const _toggleHeaderShowCart = useCallback((value: boolean) => {
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

  const _handleFooterFieldChange = useCallback(
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

  const _handleFooterLinkFieldChange = useCallback(
    (
      collection: FooterLinkCollection,
      index: number,
      field: Exclude<keyof LandingFooterLink, 'id' | 'order'>,
      value: string,
    ) => {
      updateFooterLink(collection, index, (link) => ({
        ...link,
        [field]: value,
      }));
    },
    [updateFooterLink],
  );

  const _addFooterLink = useCallback((collection: FooterLinkCollection) => {
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

  const _removeFooterLink = useCallback((collection: FooterLinkCollection, index: number) => {
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

  const _handleFooterSocialFieldChange = useCallback(
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

  const _addFooterSocial = useCallback(() => {
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

  const _removeFooterSocial = useCallback((index: number) => {
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

  // Team Page handlers
  const handleTeamPageFieldChange = useCallback((field: 'title' | 'subtitle', value: string) => {
    setTeamPageForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const addTeamMember = useCallback(() => {
    setTeamPageForm((prev) => {
      if (!prev) return prev;
      const newMember: TeamMember = {
        id: `member-${Date.now()}`,
        name: '',
        role: '',
        description: '',
        imageUrl: '',
        order: prev.members.length,
      };
      return {
        ...prev,
        members: [...prev.members, newMember],
      };
    });
  }, []);

  const updateTeamMember = useCallback((index: number, field: keyof TeamMember, value: string | number) => {
    setTeamPageForm((prev) => {
      if (!prev) return prev;
      const updatedMembers = [...prev.members];
      updatedMembers[index] = { ...updatedMembers[index], [field]: value };
      return { ...prev, members: updatedMembers };
    });
  }, []);

  const removeTeamMember = useCallback((index: number) => {
    setTeamPageForm((prev) => {
      if (!prev) return prev;
      const updatedMembers = prev.members
        .filter((_, idx) => idx !== index)
        .map((member, idx) => ({ ...member, order: idx }));
      return { ...prev, members: updatedMembers };
    });
  }, []);

  const moveTeamMember = useCallback((index: number, direction: 'up' | 'down') => {
    setTeamPageForm((prev) => {
      if (!prev) return prev;
      const members = [...prev.members];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= members.length) return prev;

      [members[index], members[newIndex]] = [members[newIndex], members[index]];
      const reordered = members.map((member, idx) => ({ ...member, order: idx }));
      return { ...prev, members: reordered };
    });
  }, []);

  // Featured Team Members handlers (for landing page)
  const toggleFeaturedMember = useCallback(async (memberId: string) => {
    if (!landingForm || !landingForm.team || !brandingForm) return;

    const currentIds = landingForm.team.featuredMemberIds ?? [];
    const isCurrentlyFeatured = currentIds.includes(memberId);

    let newIds: string[];
    if (isCurrentlyFeatured) {
      // Remove from featured
      newIds = currentIds.filter(id => id !== memberId);
    } else {
      // Add to featured (max 3)
      if (currentIds.length >= 3) {
        toast({
          title: 'Límite alcanzado',
          description: 'Solo puedes seleccionar hasta 3 miembros destacados.',
          variant: 'destructive',
        });
        return;
      }
      newIds = [...currentIds, memberId];
    }

    // Update local state optimistically
    const updatedLandingForm = {
      ...landingForm,
      team: {
        ...landingForm.team,
        featuredMemberIds: newIds,
      },
    };

    setLandingForm(updatedLandingForm);

    // Save to server
    try {
      const payload = toRequestPayload(selectedLocale, brandingForm, updatedLandingForm);
      const response = await adminApi.put('/api/admin/site-content', payload);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || 'Failed to save featured member selection.';
        throw new Error(message);
      }

      // Show success toast
      const memberName = teamPageForm?.members.find(m => m.id === memberId)?.name || 'Miembro';
      toast({
        title: isCurrentlyFeatured ? 'Miembro removido' : 'Miembro agregado',
        description: isCurrentlyFeatured
          ? `${memberName} ya no aparecerá en la landing page.`
          : `${memberName} ahora aparecerá en la landing page.`,
      });
    } catch (err) {
      console.error('Failed to save featured member selection', err);
      // Revert optimistic update
      setLandingForm(landingForm);
      toast({
        title: 'Error al guardar',
        description: 'No se pudo guardar la selección. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  }, [landingForm, brandingForm, selectedLocale, teamPageForm, toast]);

  const handleTeamSectionFieldChange = useCallback((field: 'title' | 'subtitle', value: string) => {
    setLandingForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        team: {
          ...prev.team,
          [field]: value,
        },
      };
    });
  }, []);

  const uploadTeamMemberImage = useCallback(async (index: number, file: File) => {
    try {
      const publicUrl = await uploadFileToPageBucket(file, `team-member-${index}`);
      updateTeamMember(index, 'imageUrl', publicUrl);
      toast({
        title: 'Imagen subida',
        description: 'La imagen del miembro se subió correctamente.',
      });
    } catch (_err) {
      console.error('Error uploading team member image', _err);
      toast({
        title: 'Error al subir imagen',
        description: 'No se pudo subir la imagen. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  }, [toast, uploadFileToPageBucket, updateTeamMember]);

  // Static Pages Handlers
  const handleContactChange = useCallback((path: string[], value: string | string[]) => {
    setStaticPagesForm((prev) => {
      if (!prev) return prev;
      const newContact = JSON.parse(JSON.stringify(prev.contact));

      let current: any = newContact;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;

      return { ...prev, contact: newContact };
    });
  }, []);

  const handlePrivacyChange = useCallback((path: string[], value: string) => {
    setStaticPagesForm((prev) => {
      if (!prev) return prev;
      const newPrivacy = JSON.parse(JSON.stringify(prev.privacy));

      let current: any = newPrivacy;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;

      return { ...prev, privacy: newPrivacy };
    });
  }, []);

  const handleTermsChange = useCallback((path: string[], value: string | string[]) => {
    setStaticPagesForm((prev) => {
      if (!prev) return prev;
      const newTerms = JSON.parse(JSON.stringify(prev.terms));

      let current: any = newTerms;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;

      return { ...prev, terms: newTerms };
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setSaving(true);

      try {
        // Save landing page
        if (activeTab === 'landing' && landingForm) {
          const payload = toRequestPayload(selectedLocale, brandingForm, landingForm);
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

          setBrandingForm(createBrandingState(branding));
          setLandingForm(createLandingState(landing));

          // Refresh global branding context
          await refreshBranding();

          // Save affiliate opportunity content if available
          if (affiliateOpportunity) {
            const affiliateResponse = await adminApi.put(`/api/admin/affiliate-opportunity?locale=${selectedLocale}`, {
              isEnabled: affiliateOpportunity.isEnabled,
              title: affiliateOpportunity.title,
              subtitle: affiliateOpportunity.subtitle,
              description: affiliateOpportunity.description || null,
              benefits: affiliateOpportunity.benefits.map((b, idx) => ({
                id: b.id,
                icon: b.icon || null,
                title: b.title,
                description: b.description,
                order: idx,
              })),
              commissionRate: affiliateOpportunity.commissionRate || null,
              commissionLabel: affiliateOpportunity.commissionLabel || null,
              ctaText: affiliateOpportunity.ctaText,
              ctaLink: affiliateOpportunity.ctaLink,
              imageUrl: affiliateOpportunity.imageUrl || null,
            });

            if (!affiliateResponse.ok) {
              console.error('Failed to save affiliate opportunity content');
            }
          }
        }

        // Save team page
        if (activeTab === 'team' && teamPageForm) {
          const response = await adminApi.post('/api/admin/team-page', {
            locale: selectedLocale,
            teamPage: {
              title: teamPageForm.title,
              subtitle: teamPageForm.subtitle,
              members: teamPageForm.members,
              featuredMemberIds: teamPageForm.featuredMemberIds,
            },
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const message = body?.error || 'Failed to save team page.';
            throw new Error(message);
          }

          const data = await response.json();
          const teamPage = TeamPageContentSchema.parse(data);
          setTeamPageForm(teamPage);
        }

        // Save static pages (contact, privacy, terms)
        if ((activeTab === 'contact' || activeTab === 'privacy' || activeTab === 'terms') && staticPagesForm) {
          // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
          const response = await adminApi.put('/api/admin/static-pages', {
            locale: selectedLocale,
            ...staticPagesForm,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const message = body?.error || 'Failed to save static pages.';
            throw new Error(message);
          }

          const data = await response.json();
          const staticPages = StaticPagesSchema.parse(data);

          setStaticPagesForm({
            contact: staticPages.contact,
            privacy: staticPages.privacy,
            terms: staticPages.terms,
          });
        }

        toast({
          title: copy?.toast?.success?.title ?? 'Configuración actualizada',
          description:
            copy?.toast?.success?.description ?? 'Los cambios se guardaron correctamente.',
        });
      } catch (_err) {
        console.error('Failed to save configuration', _err);
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
    [activeTab, affiliateOpportunity, brandingForm, copy?.toast?.error?.description, copy?.toast?.error?.title, copy?.toast?.success?.description, copy?.toast?.success?.title, landingForm, refreshBranding, selectedLocale, staticPagesForm, teamPageForm, toast],
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
            {copy?.title ?? 'Page Editor'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy?.description ??
              'Edit and manage your website pages including the landing page.'}
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'landing' | 'team' | 'contact' | 'privacy' | 'terms')} className="space-y-6">
          <TabsList>
            <TabsTrigger value="landing">{siteContentCopy?.tabs?.landing ?? 'Landing Page'}</TabsTrigger>
            <TabsTrigger value="team">{copy?.tabs?.team ?? 'Team'}</TabsTrigger>
            <TabsTrigger value="contact">{copy?.tabs?.contact ?? 'Contact Page'}</TabsTrigger>
            <TabsTrigger value="privacy">{copy?.tabs?.privacy ?? 'Privacy Policy'}</TabsTrigger>
            <TabsTrigger value="terms">{copy?.tabs?.terms ?? 'Terms of Service'}</TabsTrigger>
          </TabsList>
          <TabsContent value="landing" className="space-y-6">


            <Card>
              <CardHeader>
                <CardTitle>{siteContentCopy?.landing?.title ?? 'Landing page'}</CardTitle>
                <CardDescription>
                  {siteContentCopy?.landing?.description ??
                    'Personaliza el contenido que verán los visitantes en la página principal.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {siteContentCopy?.hero?.title ?? 'Sección hero'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {siteContentCopy?.hero?.description ??
                        'Define el mensaje principal y la imagen de fondo del encabezado.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="heroStyle">Estilo del Hero</Label>
                        <Select
                          value={landingForm?.hero.style ?? 'default'}
                          onValueChange={(value) => handleHeroChange('style', value)}
                        >
                          <SelectTrigger id="heroStyle">
                            <SelectValue placeholder="Selecciona un estilo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default (Original)</SelectItem>
                            <SelectItem value="modern">Moderno (Centrado)</SelectItem>
                            <SelectItem value="minimal">Minimalista (Limpio)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="heroTitle"
                        name="heroTitle"
                        placeholder={siteContentCopy?.hero?.fields?.title ?? 'Título principal'}
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
                        placeholder={siteContentCopy?.hero?.fields?.subtitle ?? 'Subtítulo'}
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
                        <Input
                          id="heroImage"
                          name="heroImage"
                          placeholder={siteContentCopy?.hero?.fields?.backgroundImageUrl ?? 'Imagen de fondo (URL)'}
                          value={landingForm?.hero.backgroundImageUrl ?? ''}
                          onChange={(event) => handleHeroChange('backgroundImageUrl', event.target.value)}
                        />
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingHero}
                            onClick={() => document.getElementById('heroFile')?.click()}
                          >
                            {uploadingHero ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            {uploadingHero ? 'Subiendo...' : 'Subir archivo'}
                          </Button>
                        </div>
                      </div>
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full md:col-span-2" />
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="heroBackgroundColor">Color de fondo (cuando no hay imagen)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="heroBackgroundColor"
                            name="heroBackgroundColor"
                            type="color"
                            value={landingForm?.hero.backgroundColor || '#10b981'}
                            onChange={(event) => handleHeroChange('backgroundColor', event.target.value)}
                            className="h-10 w-20"
                          />
                          <Input
                            type="text"
                            placeholder="#10b981"
                            value={landingForm?.hero.backgroundColor || ''}
                            onChange={(event) => handleHeroChange('backgroundColor', event.target.value)}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Este color se mostrará como fondo cuando no haya una imagen de fondo configurada
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {siteContentCopy?.about?.title ?? 'Sección sobre nosotros'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {siteContentCopy?.about?.description ??
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
                        placeholder={siteContentCopy?.about?.fields?.title ?? 'Título'}
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
                        placeholder={siteContentCopy?.about?.fields?.description ?? 'Descripción principal'}
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
                        placeholder={siteContentCopy?.about?.fields?.secondaryDescription ?? 'Descripción secundaria (opcional)'}
                        value={landingForm?.about.secondaryDescription ?? ''}
                        onChange={(event) => handleAboutChange('secondaryDescription', event.target.value)}
                      />
                    )}
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <div className="space-y-2">
                        <Input
                          id="aboutImage"
                          name="aboutImage"
                          type="url"
                          placeholder={siteContentCopy?.about?.fields?.imageUrl ?? 'Imagen (URL)'}
                          value={landingForm?.about.imageUrl ?? ''}
                          onChange={(event) => handleAboutChange('imageUrl', event.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleAboutFileChange}
                            disabled={uploadingAbout}
                            className="hidden"
                            id="aboutFile"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingAbout}
                            onClick={() => document.getElementById('aboutFile')?.click()}
                          >
                            {uploadingAbout ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            {uploadingAbout ? 'Subiendo...' : 'Subir archivo'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                {/* Affiliate Opportunity Section */}
                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{siteContentCopy?.affiliateOpportunity?.title ?? 'Affiliate Opportunity'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {siteContentCopy?.affiliateOpportunity?.description ?? 'Configure the affiliate program promotion section on the landing page.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadAffiliateOpportunity(selectedLocale)}
                      disabled={loadingAffiliateOpportunity}
                    >
                      {loadingAffiliateOpportunity ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      {siteContentCopy?.affiliateOpportunity?.refresh ?? 'Refresh'}
                    </Button>
                  </div>

                  {loadingAffiliateOpportunity ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : affiliateOpportunity ? (
                    <div className="space-y-4">
                      {/* Title and Subtitle */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{siteContentCopy?.affiliateOpportunity?.fields?.title ?? 'Title'}</Label>
                          <Input
                            placeholder={siteContentCopy?.affiliateOpportunity?.fields?.titlePlaceholder ?? 'Affiliate Program'}
                            value={affiliateOpportunity.title}
                            onChange={(e) => handleAffiliateOpportunityChange('title', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{siteContentCopy?.affiliateOpportunity?.fields?.subtitle ?? 'Subtitle'}</Label>
                          <Input
                            placeholder={siteContentCopy?.affiliateOpportunity?.fields?.subtitlePlaceholder ?? 'Earn commissions by promoting our products'}
                            value={affiliateOpportunity.subtitle}
                            onChange={(e) => handleAffiliateOpportunityChange('subtitle', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label>{siteContentCopy?.affiliateOpportunity?.fields?.description ?? 'Description (optional)'}</Label>
                        <Textarea
                          rows={3}
                          placeholder={siteContentCopy?.affiliateOpportunity?.fields?.descriptionPlaceholder ?? 'Detailed description of the affiliate program...'}
                          value={affiliateOpportunity.description}
                          onChange={(e) => handleAffiliateOpportunityChange('description', e.target.value)}
                        />
                      </div>

                      {/* Commission Label */}
                      <div className="space-y-2">
                        <Label>{siteContentCopy?.affiliateOpportunity?.fields?.commissionLabel ?? 'Commission Label'}</Label>
                        <Input
                          placeholder={siteContentCopy?.affiliateOpportunity?.fields?.commissionLabelPlaceholder ?? 'Commission per sale'}
                          value={affiliateOpportunity.commissionLabel}
                          onChange={(e) => handleAffiliateOpportunityChange('commissionLabel', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">{siteContentCopy?.affiliateOpportunity?.fields?.commissionLabelHelp ?? 'The percentage is automatically obtained from the affiliate configuration.'}</p>
                      </div>

                      {/* CTA */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{siteContentCopy?.affiliateOpportunity?.fields?.ctaText ?? 'Button Text (CTA)'}</Label>
                          <Input
                            placeholder={siteContentCopy?.affiliateOpportunity?.fields?.ctaTextPlaceholder ?? 'Join Now'}
                            value={affiliateOpportunity.ctaText}
                            onChange={(e) => handleAffiliateOpportunityChange('ctaText', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{siteContentCopy?.affiliateOpportunity?.fields?.ctaLink ?? 'Button Link'}</Label>
                          <Input
                            placeholder={siteContentCopy?.affiliateOpportunity?.fields?.ctaLinkPlaceholder ?? '/register'}
                            value={affiliateOpportunity.ctaLink}
                            onChange={(e) => handleAffiliateOpportunityChange('ctaLink', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Image */}
                      <div className="space-y-2">
                        <Label>{siteContentCopy?.affiliateOpportunity?.fields?.imageUrl ?? 'Imagen'}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleAffiliateOpportunityImageUpload}
                            disabled={uploadingAffiliateOpportunityImage}
                            className="hidden"
                            id="affiliateOpportunityImage"
                          />
                          <Label htmlFor="affiliateOpportunityImage" className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" disabled={uploadingAffiliateOpportunityImage} asChild>
                              <span>
                                {uploadingAffiliateOpportunityImage ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {uploadingAffiliateOpportunityImage ? 'Subiendo...' : 'Subir imagen'}
                              </span>
                            </Button>
                          </Label>
                          {affiliateOpportunity.imageUrl && (
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                placeholder="Imagen subida"
                                value={affiliateOpportunity.imageUrl}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAffiliateOpportunityChange('imageUrl', '')}
                                disabled={uploadingAffiliateOpportunityImage}
                                title="Eliminar imagen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Benefits */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>{siteContentCopy?.affiliateOpportunity?.benefits?.title ?? 'Benefits'}</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAffiliateBenefit}
                            disabled={affiliateOpportunity.benefits.length >= 8}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {siteContentCopy?.affiliateOpportunity?.benefits?.addBenefit ?? 'Add Benefit'}
                          </Button>
                        </div>
                        
                        {affiliateOpportunity.benefits.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {siteContentCopy?.affiliateOpportunity?.benefits?.empty ?? 'No benefits configured. Add benefits to display in the section.'}
                          </p>
                        ) : (
                          affiliateOpportunity.benefits.map((benefit, index) => (
                            <Card key={benefit.id} className="border-muted/30 bg-muted/20">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {(siteContentCopy?.affiliateOpportunity?.benefits?.benefitLabel ?? 'Benefit {{index}}').replace('{{index}}', String(index + 1))}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAffiliateBenefit(index)}
                                    disabled={affiliateOpportunity.benefits.length <= 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">{siteContentCopy?.affiliateOpportunity?.benefits?.icon ?? 'Icon'}</Label>
                                    <Input
                                      placeholder={siteContentCopy?.affiliateOpportunity?.benefits?.iconPlaceholder ?? 'gift, store, trending-up'}
                                      value={benefit.icon}
                                      onChange={(e) => handleAffiliateBenefitChange(index, 'icon', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs">{siteContentCopy?.affiliateOpportunity?.benefits?.benefitTitle ?? 'Title'}</Label>
                                    <Input
                                      placeholder={siteContentCopy?.affiliateOpportunity?.benefits?.benefitTitlePlaceholder ?? 'Attractive Commissions'}
                                      value={benefit.title}
                                      onChange={(e) => handleAffiliateBenefitChange(index, 'title', e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{siteContentCopy?.affiliateOpportunity?.benefits?.benefitDescription ?? 'Description'}</Label>
                                  <Input
                                    placeholder={siteContentCopy?.affiliateOpportunity?.benefits?.benefitDescriptionPlaceholder ?? 'Earn up to 15% commission on every referred sale'}
                                    value={benefit.description}
                                    onChange={(e) => handleAffiliateBenefitChange(index, 'description', e.target.value)}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {siteContentCopy?.affiliateOpportunity?.loadError ?? 'Could not load configuration. Click Refresh to retry.'}
                    </p>
                  )}
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{siteContentCopy?.testimonials?.title ?? 'Testimonios'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {siteContentCopy?.testimonials?.description ?? 'Comparte historias y resultados de tus miembros o clientes.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addTestimonial} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {siteContentCopy?.testimonials?.addTestimonial ?? 'Agregar testimonio'}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={siteContentCopy?.testimonials?.fields?.title ?? 'Título de la sección'}
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
                              {siteContentCopy?.testimonials?.itemLabel
                                ? siteContentCopy.testimonials.itemLabel.replace('{{index}}', String(index + 1))
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
                              {siteContentCopy?.testimonials?.removeTestimonial ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={siteContentCopy?.testimonials?.fields?.name ?? 'Nombre o título'}
                              value={testimonial.name}
                              onChange={(event) => handleTestimonialFieldChange(index, 'name', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={4}
                              placeholder={siteContentCopy?.testimonials?.fields?.quote ?? 'Mensaje principal'}
                              value={testimonial.quote}
                              onChange={(event) => handleTestimonialFieldChange(index, 'quote', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Input
                              placeholder={siteContentCopy?.testimonials?.fields?.role ?? 'Rol o nota (opcional)'}
                              value={testimonial.role ?? ''}
                              onChange={(event) => handleTestimonialFieldChange(index, 'role', event.target.value)}
                            />
                            <div className="space-y-2">
                              <Label>{siteContentCopy?.testimonials?.fields?.imageUrl ?? 'Imagen'}</Label>
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

                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{siteContentCopy?.featuredProducts?.title ?? 'Productos destacados'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {siteContentCopy?.featuredProducts?.description ?? 'Configura el mensaje y el estado vacío del catálogo destacado.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={siteContentCopy?.featuredProducts?.fields?.title ?? 'Título de la sección'}
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
                        placeholder={siteContentCopy?.featuredProducts?.fields?.subtitle ?? 'Subtítulo o descripción'}
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
                        placeholder={siteContentCopy?.featuredProducts?.fields?.emptyState ?? 'Mensaje cuando no hay productos'}
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
                    <h2 className="text-lg font-semibold">{siteContentCopy?.contact?.title ?? 'Contacto'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {siteContentCopy?.contact?.description ?? 'Actualiza la información visible y los placeholders del formulario.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        placeholder={siteContentCopy?.contact?.fields?.title ?? 'Título de la sección'}
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
                        placeholder={siteContentCopy?.contact?.fields?.recipientEmail ?? 'Correo destinatario'}
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
                        placeholder={siteContentCopy?.contact?.fields?.description ?? 'Descripción de la sección'}
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
                        placeholder={siteContentCopy?.contact?.fields?.phone ?? 'Teléfono de contacto'}
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
                        placeholder={siteContentCopy?.contact?.fields?.email ?? 'Correo de contacto'}
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
                        placeholder={siteContentCopy?.contact?.fields?.address ?? 'Dirección física'}
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
                        placeholder={siteContentCopy?.contact?.fields?.namePlaceholder ?? 'Placeholder nombre'}
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
                        placeholder={siteContentCopy?.contact?.fields?.emailPlaceholder ?? 'Placeholder correo'}
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
                        placeholder={siteContentCopy?.contact?.fields?.messagePlaceholder ?? 'Placeholder mensaje'}
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
                        placeholder={siteContentCopy?.contact?.fields?.sendButton ?? 'Texto del botón'}
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
                        {siteContentCopy?.howItWorks?.title ?? 'Cómo funciona'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {siteContentCopy?.howItWorks?.description ??
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
                      {siteContentCopy?.howItWorks?.addStep ?? 'Agregar paso'}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {loading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="howItWorksTitle"
                        name="howItWorksTitle"
                        placeholder={siteContentCopy?.howItWorks?.fields?.sectionTitle ?? 'Título de la sección'}
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
                        placeholder={siteContentCopy?.howItWorks?.fields?.sectionSubtitle ?? 'Subtítulo de la sección'}
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
                              {siteContentCopy?.howItWorks?.stepLabel
                                ? siteContentCopy.howItWorks.stepLabel.replace('{{index}}', String(index + 1))
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
                              {siteContentCopy?.howItWorks?.removeStep ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={siteContentCopy?.howItWorks?.fields?.stepTitle ?? 'Título del paso'}
                              value={step.title}
                              onChange={(event) => updateStep(index, 'title', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={3}
                              placeholder={siteContentCopy?.howItWorks?.fields?.stepDescription ?? 'Descripción del paso'}
                              value={step.description}
                              onChange={(event) => updateStep(index, 'description', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="space-y-2">
                              <Label>{siteContentCopy?.howItWorks?.fields?.stepImageUrl ?? 'Imagen'}</Label>
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
                        {siteContentCopy?.faqs?.title ?? 'Preguntas frecuentes'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {siteContentCopy?.faqs?.description ??
                          'Agrega respuestas a las preguntas más comunes. Puedes dejar esta sección vacía si no la necesitas.'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addFaq} disabled={loading}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {siteContentCopy?.faqs?.addFaq ?? 'Agregar pregunta'}
                    </Button>
                  </div>

                  {loading || !landingForm ? (
                    <Skeleton className="h-40 w-full" />
                  ) : landingForm.faqs.length === 0 ? (
                    <p className="rounded-md border border-dashed border-primary/40 p-6 text-center text-sm text-muted-foreground">
                      {siteContentCopy?.faqs?.empty ?? 'Aún no hay preguntas registradas.'}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {landingForm.faqs.map((faq, index) => (
                        <Card key={faq.id ?? index} className="border-primary/10">
                          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {siteContentCopy?.faqs?.questionLabel
                                ? `${siteContentCopy.faqs.questionLabel} ${index + 1}`
                                : `Pregunta ${index + 1}`}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFaq(index)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {siteContentCopy?.faqs?.remove ?? 'Eliminar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Input
                              placeholder={siteContentCopy?.faqs?.questionPlaceholder ?? 'Pregunta'}
                              value={faq.question}
                              onChange={(event) => updateFaq(index, 'question', event.target.value)}
                              required
                              minLength={1}
                            />
                            <Textarea
                              rows={3}
                              placeholder={siteContentCopy?.faqs?.answerPlaceholder ?? 'Respuesta'}
                              value={faq.answer}
                              onChange={(event) => updateFaq(index, 'answer', event.target.value)}
                              required
                              minLength={1}
                            />
                            <div className="space-y-2">
                              <Label>{siteContentCopy?.faqs?.imageLabel ?? 'Imagen'}</Label>
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

                <Separator />

                {/* Featured Team Members Section */}
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{siteContentCopy?.featuredTeam?.title ?? 'Featured Team Members'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {siteContentCopy?.featuredTeam?.description ?? 'Select up to 4 team members to feature on the landing page. Add team members in the Team tab first.'}
                    </p>
                  </div>

                  {/* Section Title & Subtitle */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-section-title">{siteContentCopy?.featuredTeam?.sectionTitle ?? 'Section Title'}</Label>
                      {loading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <Input
                          id="team-section-title"
                          value={landingForm?.team?.title ?? ''}
                          onChange={(e) => handleTeamSectionFieldChange('title', e.target.value)}
                          placeholder={siteContentCopy?.featuredTeam?.sectionTitlePlaceholder ?? 'Meet Our Team'}
                          maxLength={180}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team-section-subtitle">{siteContentCopy?.featuredTeam?.sectionSubtitle ?? 'Section Subtitle'}</Label>
                      {loading ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <Textarea
                          id="team-section-subtitle"
                          value={landingForm?.team?.subtitle ?? ''}
                          onChange={(e) => handleTeamSectionFieldChange('subtitle', e.target.value)}
                          placeholder={siteContentCopy?.featuredTeam?.sectionSubtitlePlaceholder ?? 'The people behind our success'}
                          maxLength={600}
                          rows={3}
                        />
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Featured Members Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{siteContentCopy?.featuredTeam?.selectTitle ?? 'Select Featured Members'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {(siteContentCopy?.featuredTeam?.selectedCount ?? '{{count}} of 3 selected').replace('{{count}}', String(landingForm?.team?.featuredMemberIds?.length ?? 0))}
                        </p>
                      </div>
                    </div>

                    {loading ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-24 w-full" />
                        ))}
                      </div>
                    ) : teamPageForm && teamPageForm.members.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {teamPageForm.members.map((member) => {
                          const isFeatured = landingForm?.team?.featuredMemberIds?.includes(member.id) ?? false;
                          const canSelect = !isFeatured && (landingForm?.team?.featuredMemberIds?.length ?? 0) < 3;

                          return (
                            <Card
                              key={member.id}
                              className={`cursor-pointer transition-all ${isFeatured
                                ? 'border-primary bg-primary/5'
                                : canSelect
                                  ? 'hover:border-primary/50'
                                  : 'opacity-50 cursor-not-allowed'
                                }`}
                              onClick={() => {
                                if (isFeatured || canSelect) {
                                  toggleFeaturedMember(member.id);
                                }
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  {member.imageUrl ? (
                                    <Image
                                      src={member.imageUrl}
                                      alt={member.name}
                                      width={64}
                                      height={64}
                                      className="h-16 w-16 rounded-full object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                                      <span className="text-2xl text-muted-foreground">
                                        {member.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold truncate">{member.name || (siteContentCopy?.featuredTeam?.unnamedMember ?? 'Unnamed Member')}</h4>
                                    <p className="text-sm text-muted-foreground truncate">{member.role || (siteContentCopy?.featuredTeam?.noRole ?? 'No role')}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <Switch
                                      checked={isFeatured}
                                      disabled={!isFeatured && !canSelect}
                                      onCheckedChange={() => toggleFeaturedMember(member.id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <Alert>
                        <AlertTitle>{siteContentCopy?.featuredTeam?.noMembersTitle ?? 'No team members available'}</AlertTitle>
                        <AlertDescription>
                          {siteContentCopy?.featuredTeam?.noMembersDescription ?? 'Add team members in the Team tab first, then come back here to select up to 3 featured members for the landing page.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </section>

                <div className="flex justify-end pt-6">
                  <Button type="submit" disabled={saving} size="lg">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {siteContentCopy?.featuredTeam?.saveChanges ?? 'Save changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Team Page Tab */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy?.tabs?.team ?? 'Team Page'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="teamPageTitle">Page Title</Label>
                    <Input
                      id="teamPageTitle"
                      value={teamPageForm?.title ?? ''}
                      onChange={(e) => handleTeamPageFieldChange('title', e.target.value)}
                      placeholder="Meet Our Team"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamPageSubtitle">Page Subtitle</Label>
                    <Input
                      id="teamPageSubtitle"
                      value={teamPageForm?.subtitle ?? ''}
                      onChange={(e) => handleTeamPageFieldChange('subtitle', e.target.value)}
                      placeholder="The people behind our success"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Team Members</h3>
                  <Button type="button" onClick={addTeamMember} variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </div>

                <div className="space-y-4">
                  {teamPageForm?.members.map((member, index) => (
                    <Card key={member.id || index} className="relative">
                      <CardContent className="pt-6">
                        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
                          <div className="flex flex-col items-center gap-4">
                            <div className="relative h-40 w-40 overflow-hidden rounded-full border bg-muted">
                              {member.imageUrl ? (
                                <Image
                                  src={member.imageUrl}
                                  alt={member.name}
                                  width={320}
                                  height={320}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  No Image
                                </div>
                              )}
                              {uploadingTeamMembers[index] && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                              )}
                            </div>
                            <div className="flex w-full items-center justify-center">
                              <Label
                                htmlFor={`member-image-${index}`}
                                className="cursor-pointer rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                              >
                                <Upload className="mr-2 h-4 w-4 inline" />
                                Upload
                              </Label>
                              <Input
                                id={`member-image-${index}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadTeamMemberImage(index, file);
                                }}
                                disabled={uploadingTeamMembers[index]}
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                  value={member.name}
                                  onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                                  placeholder="John Doe"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Role</Label>
                                <Input
                                  value={member.role}
                                  onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                                  placeholder="CEO"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={member.description ?? ''}
                                onChange={(e) => updateTeamMember(index, 'description', e.target.value)}
                                placeholder="Short bio..."
                                rows={3}
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTeamMember(index, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTeamMember(index, 'down')}
                                disabled={index === (teamPageForm?.members.length ?? 0) - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeTeamMember(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {(!teamPageForm?.members || teamPageForm.members.length === 0) && (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                      No team members added yet.
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-6">
                  <Button type="submit" disabled={saving} size="lg">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Page Tab */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy?.tabs?.contact ?? 'Contact Page'}</CardTitle>
                <CardDescription>
                  Manage contact page content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : staticPagesForm ? (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Page Header</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="contactTitle">Title</Label>
                          <Input
                            id="contactTitle"
                            value={staticPagesForm.contact.title}
                            onChange={(e) => handleContactChange(['title'], e.target.value)}
                            placeholder="Contact Us"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactSubtitle">Subtitle</Label>
                          <Input
                            id="contactSubtitle"
                            value={staticPagesForm.contact.subtitle}
                            onChange={(e) => handleContactChange(['subtitle'], e.target.value)}
                            placeholder="Get in touch with us"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Contact Information</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="contactInfoTitle">Section Title</Label>
                          <Input
                            id="contactInfoTitle"
                            value={staticPagesForm.contact.contactInfo.title}
                            onChange={(e) => handleContactChange(['contactInfo', 'title'], e.target.value)}
                            placeholder="Contact Information"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactEmail">Email</Label>
                          <Input
                            id="contactEmail"
                            type="email"
                            value={staticPagesForm.contact.contactInfo.email}
                            onChange={(e) => handleContactChange(['contactInfo', 'email'], e.target.value)}
                            placeholder="contact@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactPhone">Phone</Label>
                          <Input
                            id="contactPhone"
                            value={staticPagesForm.contact.contactInfo.phone}
                            onChange={(e) => handleContactChange(['contactInfo', 'phone'], e.target.value)}
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactHours">Business Hours</Label>
                          <Input
                            id="contactHours"
                            value={staticPagesForm.contact.contactInfo.hours}
                            onChange={(e) => handleContactChange(['contactInfo', 'hours'], e.target.value)}
                            placeholder="Mon-Fri: 9AM-5PM"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Why Reach Out Section</h3>
                      <div className="space-y-2">
                        <Label htmlFor="whyReachOutTitle">Section Title</Label>
                        <Input
                          id="whyReachOutTitle"
                          value={staticPagesForm.contact.whyReachOut.title}
                          onChange={(e) => handleContactChange(['whyReachOut', 'title'], e.target.value)}
                          placeholder="Why Reach Out?"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Items (one per line)</Label>
                        <Textarea
                          value={staticPagesForm.contact.whyReachOut.items.join('\n')}
                          onChange={(e) => handleContactChange(['whyReachOut', 'items'], e.target.value.split('\n').filter(Boolean))}
                          placeholder="Product inquiries&#10;Partnership opportunities&#10;Technical support"
                          rows={6}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-6">
                      <Button type="submit" disabled={saving} size="lg">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar cambios
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>No data available</AlertTitle>
                    <AlertDescription>
                      Contact page data could not be loaded.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Policy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy?.tabs?.privacy ?? 'Privacy Policy'}</CardTitle>
                <CardDescription>
                  Manage privacy policy content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : staticPagesForm ? (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Page Header</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="privacyTitle">Title</Label>
                          <Input
                            id="privacyTitle"
                            value={staticPagesForm.privacy.title}
                            onChange={(e) => handlePrivacyChange(['title'], e.target.value)}
                            placeholder="Privacy Policy"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="privacyIntro">Introduction</Label>
                          <Textarea
                            id="privacyIntro"
                            value={staticPagesForm.privacy.intro}
                            onChange={(e) => handlePrivacyChange(['intro'], e.target.value)}
                            placeholder="Your privacy is important to us..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Information We Collect</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="privacyInfoTitle">Section Title</Label>
                          <Input
                            id="privacyInfoTitle"
                            value={staticPagesForm.privacy.sections.informationWeCollect.title}
                            onChange={(e) => handlePrivacyChange(['sections', 'informationWeCollect', 'title'], e.target.value)}
                            placeholder="Information We Collect"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="privacyInfoContent">Content</Label>
                          <Textarea
                            id="privacyInfoContent"
                            value={staticPagesForm.privacy.sections.informationWeCollect.content}
                            onChange={(e) => handlePrivacyChange(['sections', 'informationWeCollect', 'content'], e.target.value)}
                            placeholder="We collect information that you provide..."
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="privacyInfoDetails">Details</Label>
                          <Textarea
                            id="privacyInfoDetails"
                            value={staticPagesForm.privacy.sections.informationWeCollect.details}
                            onChange={(e) => handlePrivacyChange(['sections', 'informationWeCollect', 'details'], e.target.value)}
                            placeholder="Additional details about data collection..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">How We Use Information</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="privacyUseTitle">Section Title</Label>
                          <Input
                            id="privacyUseTitle"
                            value={staticPagesForm.privacy.sections.howWeUseInformation.title}
                            onChange={(e) => handlePrivacyChange(['sections', 'howWeUseInformation', 'title'], e.target.value)}
                            placeholder="How We Use Your Information"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="privacyUseContent">Content</Label>
                          <Textarea
                            id="privacyUseContent"
                            value={staticPagesForm.privacy.sections.howWeUseInformation.content}
                            onChange={(e) => handlePrivacyChange(['sections', 'howWeUseInformation', 'content'], e.target.value)}
                            placeholder="We use your information to..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Data Protection</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="privacyProtectionTitle">Section Title</Label>
                          <Input
                            id="privacyProtectionTitle"
                            value={staticPagesForm.privacy.sections.dataProtection.title}
                            onChange={(e) => handlePrivacyChange(['sections', 'dataProtection', 'title'], e.target.value)}
                            placeholder="Data Protection"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="privacyProtectionContent">Content</Label>
                          <Textarea
                            id="privacyProtectionContent"
                            value={staticPagesForm.privacy.sections.dataProtection.content}
                            onChange={(e) => handlePrivacyChange(['sections', 'dataProtection', 'content'], e.target.value)}
                            placeholder="We implement security measures..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6">
                      <Button type="submit" disabled={saving} size="lg">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar cambios
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>No data available</AlertTitle>
                    <AlertDescription>
                      Privacy policy data could not be loaded.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Terms of Service Tab */}
          <TabsContent value="terms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{copy?.tabs?.terms ?? 'Terms of Service'}</CardTitle>
                <CardDescription>
                  Manage terms of service content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : staticPagesForm ? (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Page Header</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="termsTitle">Title</Label>
                          <Input
                            id="termsTitle"
                            value={staticPagesForm.terms.title}
                            onChange={(e) => handleTermsChange(['title'], e.target.value)}
                            placeholder="Terms of Service"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="termsIntro">Introduction</Label>
                          <Textarea
                            id="termsIntro"
                            value={staticPagesForm.terms.intro}
                            onChange={(e) => handleTermsChange(['intro'], e.target.value)}
                            placeholder="By using our services, you agree to these terms..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">License</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="termsLicenseTitle">Section Title</Label>
                          <Input
                            id="termsLicenseTitle"
                            value={staticPagesForm.terms.sections.license.title}
                            onChange={(e) => handleTermsChange(['sections', 'license', 'title'], e.target.value)}
                            placeholder="License"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="termsLicenseContent">Content</Label>
                          <Textarea
                            id="termsLicenseContent"
                            value={staticPagesForm.terms.sections.license.content}
                            onChange={(e) => handleTermsChange(['sections', 'license', 'content'], e.target.value)}
                            placeholder="We grant you a limited license..."
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="termsRestrictionsTitle">Restrictions Title</Label>
                          <Input
                            id="termsRestrictionsTitle"
                            value={staticPagesForm.terms.sections.license.restrictions.title}
                            onChange={(e) => handleTermsChange(['sections', 'license', 'restrictions', 'title'], e.target.value)}
                            placeholder="Restrictions"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Restriction Items (one per line)</Label>
                          <Textarea
                            value={staticPagesForm.terms.sections.license.restrictions.items.join('\n')}
                            onChange={(e) => handleTermsChange(['sections', 'license', 'restrictions', 'items'], e.target.value.split('\n').filter(Boolean))}
                            placeholder="Do not modify or copy materials&#10;Do not use for commercial purposes&#10;Do not attempt to reverse engineer"
                            rows={6}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">User Content</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="termsUserContentTitle">Section Title</Label>
                          <Input
                            id="termsUserContentTitle"
                            value={staticPagesForm.terms.sections.userContent.title}
                            onChange={(e) => handleTermsChange(['sections', 'userContent', 'title'], e.target.value)}
                            placeholder="User Content"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="termsUserContentContent">Content</Label>
                          <Textarea
                            id="termsUserContentContent"
                            value={staticPagesForm.terms.sections.userContent.content}
                            onChange={(e) => handleTermsChange(['sections', 'userContent', 'content'], e.target.value)}
                            placeholder="You retain ownership of content you submit..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Limitation of Liability</h3>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="termsLiabilityTitle">Section Title</Label>
                          <Input
                            id="termsLiabilityTitle"
                            value={staticPagesForm.terms.sections.limitationOfLiability.title}
                            onChange={(e) => handleTermsChange(['sections', 'limitationOfLiability', 'title'], e.target.value)}
                            placeholder="Limitation of Liability"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="termsLiabilityContent">Content</Label>
                          <Textarea
                            id="termsLiabilityContent"
                            value={staticPagesForm.terms.sections.limitationOfLiability.content}
                            onChange={(e) => handleTermsChange(['sections', 'limitationOfLiability', 'content'], e.target.value)}
                            placeholder="We shall not be liable for any damages..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6">
                      <Button type="submit" disabled={saving} size="lg">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar cambios
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>No data available</AlertTitle>
                    <AlertDescription>
                      Terms of service data could not be loaded.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}

// Placeholder for team page content - will be implemented later
function TeamPageContent() {
  return null;
}
