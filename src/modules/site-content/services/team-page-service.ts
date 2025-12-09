import type { Locale } from '@/i18n/config';
import { teamPageRepository } from '../data/repositories/supabase-team-page-repository';
import {
  TeamPageContentPayloadSchema,
  sortTeamMembersByOrder,
  type TeamPageContent,
  type TeamPageContentUpdateInput,
} from '../domain/models/team-page';

/**
 * Get team page content for a specific locale
 * Merges database content with default values
 */
export async function getTeamPageContent(
  locale: Locale,
  defaultContent?: Partial<TeamPageContent>,
): Promise<TeamPageContent> {
  const stored = await teamPageRepository.fetchTeamPageContent(locale);

  // If we have stored content, return it with sorted members
  if (stored) {
    return {
      ...stored,
      members: sortTeamMembersByOrder(stored.members),
    };
  }

  // Return default content if no stored content exists
  const defaults: TeamPageContent = {
    locale,
    title: defaultContent?.title || 'Our Team',
    subtitle: defaultContent?.subtitle || 'Meet the people behind our success',
    members: defaultContent?.members || [],
    featuredMemberIds: defaultContent?.featuredMemberIds || [],
    updatedAt: null,
  };

  return defaults;
}

/**
 * Update team page content for a specific locale
 */
export async function updateTeamPageContent(
  locale: Locale,
  input: TeamPageContentUpdateInput,
): Promise<TeamPageContent> {
  // Validate the input
  const validated = TeamPageContentPayloadSchema.parse(input);

  // Sort members by order before saving
  if (validated.members) {
    validated.members = sortTeamMembersByOrder(validated.members);
  }

  // Upsert the content
  const updated = await teamPageRepository.upsertTeamPageContent(locale, validated);

  return {
    ...updated,
    members: sortTeamMembersByOrder(updated.members),
  };
}

/**
 * Get featured members for landing page
 * Returns up to 4 members based on featuredMemberIds
 */
export async function getFeaturedMembers(locale: Locale) {
  const content = await getTeamPageContent(locale);
  
  if (!content.featuredMemberIds || content.featuredMemberIds.length === 0) {
    return [];
  }

  // Filter members by featured IDs and maintain the order from featuredMemberIds
  const featuredMembers = content.featuredMemberIds
    .map(id => content.members.find(member => member.id === id))
    .filter((member): member is NonNullable<typeof member> => member !== undefined)
    .slice(0, 4); // Ensure max 4 members

  return featuredMembers;
}

/**
 * Update only the featured member IDs (for landing page control)
 */
export async function updateFeaturedMembers(
  locale: Locale,
  featuredMemberIds: string[],
): Promise<TeamPageContent> {
  // Validate max 4 featured members
  const validatedIds = featuredMemberIds.slice(0, 4);

  // Update only featured member IDs
  const updated = await teamPageRepository.upsertTeamPageContent(locale, {
    featuredMemberIds: validatedIds,
  });

  return {
    ...updated,
    members: sortTeamMembersByOrder(updated.members),
  };
}

