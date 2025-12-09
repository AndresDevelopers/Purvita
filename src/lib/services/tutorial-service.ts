/**
 * Tutorial Service
 * Handles tutorial retrieval and filtering based on page targeting
 */

import { createClient } from '@/lib/supabase/server';

export interface Tutorial {
  id: string;
  title: string;
  title_es?: string | null;
  title_en?: string | null;
  description: string;
  description_es?: string | null;
  description_en?: string | null;
  content: unknown[];
  is_active: boolean;
  show_on_all_pages: boolean;
  target_pages: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Get tutorials for a specific page
 * @param pagePath - The current page path (e.g., '/dashboard', '/products')
 * @param locale - The user's locale ('es' or 'en')
 * @returns Array of tutorials that should be shown on this page
 */
export async function getTutorialsForPage(
  pagePath: string,
  _locale: 'es' | 'en' = 'es'
): Promise<Tutorial[]> {
  const supabase = await createClient();

  // Get all active tutorials
  const { data: tutorials, error } = await supabase
    .from('tutorials')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tutorials:', error);
    return [];
  }

  if (!tutorials) {
    return [];
  }

  // Filter tutorials based on page targeting
  const filteredTutorials = tutorials.filter((tutorial) => {
    // Show if it's set to show on all pages
    if (tutorial.show_on_all_pages) {
      return true;
    }

    // Show if the current page is in the target pages
    if (tutorial.target_pages && Array.isArray(tutorial.target_pages)) {
      return tutorial.target_pages.some((targetPage: string) => {
        // Exact match
        if (targetPage === pagePath) {
          return true;
        }

        // Wildcard match (e.g., '/dashboard/*' matches '/dashboard/settings')
        if (targetPage.endsWith('/*')) {
          const basePath = targetPage.slice(0, -2);
          return pagePath.startsWith(basePath);
        }

        return false;
      });
    }

    return false;
  });

  return filteredTutorials;
}

/**
 * Get all active tutorials (for admin or general listing)
 */
export async function getAllActiveTutorials(): Promise<Tutorial[]> {
  const supabase = await createClient();

  const { data: tutorials, error } = await supabase
    .from('tutorials')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tutorials:', error);
    return [];
  }

  return tutorials || [];
}

/**
 * Check if a tutorial should be shown on a specific page
 * @param tutorial - The tutorial to check
 * @param pagePath - The current page path
 * @returns true if the tutorial should be shown
 */
export function shouldShowTutorial(
  tutorial: Tutorial,
  pagePath: string
): boolean {
  if (!tutorial.is_active) {
    return false;
  }

  if (tutorial.show_on_all_pages) {
    return true;
  }

  if (tutorial.target_pages && Array.isArray(tutorial.target_pages)) {
    return tutorial.target_pages.some((targetPage: string) => {
      if (targetPage === pagePath) {
        return true;
      }

      if (targetPage.endsWith('/*')) {
        const basePath = targetPage.slice(0, -2);
        return pagePath.startsWith(basePath);
      }

      return false;
    });
  }

  return false;
}
