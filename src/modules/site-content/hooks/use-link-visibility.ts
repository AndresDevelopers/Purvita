'use client';

import { useMemo } from 'react';
import type { LinkVisibilityRules, LandingHeaderLink, LandingFooterLink } from '../domain/models/landing-content';
import { defaultVisibilityRules } from '../domain/models/landing-content';

/**
 * User context for determining link visibility
 */
export interface UserVisibilityContext {
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  subscriptionType: 'mlm' | 'affiliate' | null;
  isAdmin: boolean;
}

/**
 * Default context for guests (non-authenticated users)
 */
export const guestContext: UserVisibilityContext = {
  isAuthenticated: false,
  hasActiveSubscription: false,
  subscriptionType: null,
  isAdmin: false,
};

/**
 * Check if a link should be visible based on visibility rules and user context
 */
export function isLinkVisible(
  visibility: LinkVisibilityRules | undefined,
  context: UserVisibilityContext
): boolean {
  // If no visibility rules defined, use defaults (show to everyone)
  const rules = visibility ?? defaultVisibilityRules;

  // Check authentication-based visibility
  if (!context.isAuthenticated && !rules.showToGuests) {
    return false;
  }
  if (context.isAuthenticated && !rules.showToAuthenticated) {
    return false;
  }

  // For authenticated users, check subscription-based visibility
  if (context.isAuthenticated) {
    // Check subscription status
    if (context.hasActiveSubscription && !rules.showToActiveSubscription) {
      return false;
    }
    if (!context.hasActiveSubscription && !rules.showToInactiveSubscription) {
      return false;
    }

    // Check subscription type
    if (context.subscriptionType === 'mlm' && !rules.showToMlm) {
      return false;
    }
    if (context.subscriptionType === 'affiliate' && !rules.showToAffiliate) {
      return false;
    }

    // Check admin visibility
    if (context.isAdmin && !rules.showToAdmin) {
      return false;
    }
  }

  return true;
}

/**
 * Filter an array of links based on visibility rules
 */
export function filterLinksByVisibility<T extends { visibility?: LinkVisibilityRules }>(
  links: T[],
  context: UserVisibilityContext
): T[] {
  return links.filter((link) => isLinkVisible(link.visibility, context));
}

/**
 * Hook to filter header links based on user context
 */
export function useFilteredHeaderLinks(
  links: LandingHeaderLink[],
  context: UserVisibilityContext
): LandingHeaderLink[] {
  return useMemo(() => {
    return filterLinksByVisibility(links, context).sort((a, b) => a.order - b.order);
  }, [links, context]);
}

/**
 * Hook to filter footer links based on user context
 */
export function useFilteredFooterLinks(
  links: LandingFooterLink[],
  context: UserVisibilityContext
): LandingFooterLink[] {
  return useMemo(() => {
    return filterLinksByVisibility(links, context).sort((a, b) => a.order - b.order);
  }, [links, context]);
}

/**
 * Hook that provides the complete visibility context from various sources
 */
export function useVisibilityContext(params: {
  isAuthenticated: boolean;
  authChecked: boolean;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid' | null;
  subscriptionType?: 'mlm' | 'affiliate' | null;
  isAdmin?: boolean;
}): UserVisibilityContext {
  return useMemo(() => {
    if (!params.authChecked) {
      return guestContext;
    }

    return {
      isAuthenticated: params.isAuthenticated,
      hasActiveSubscription: params.subscriptionStatus === 'active',
      subscriptionType: params.subscriptionType ?? null,
      isAdmin: params.isAdmin ?? false,
    };
  }, [
    params.authChecked,
    params.isAuthenticated,
    params.subscriptionStatus,
    params.subscriptionType,
    params.isAdmin,
  ]);
}

/**
 * Combined hook for filtering navigation links with automatic context building
 */
export function useNavigationLinks<T extends { visibility?: LinkVisibilityRules; order: number }>(
  links: T[],
  params: {
    isAuthenticated: boolean;
    authChecked: boolean;
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid' | null;
    subscriptionType?: 'mlm' | 'affiliate' | null;
    isAdmin?: boolean;
  }
): T[] {
  const context = useVisibilityContext(params);
  
  return useMemo(() => {
    return filterLinksByVisibility(links, context).sort((a, b) => a.order - b.order);
  }, [links, context]);
}
