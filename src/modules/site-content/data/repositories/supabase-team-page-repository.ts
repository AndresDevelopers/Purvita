import { supabase, getServiceRoleClient } from '@/lib/supabase';
import type { Locale } from '@/i18n/config';
import {
  TeamPageContentSchema,
  type TeamPageContent,
  type TeamPageContentPayload,
} from '../../domain/models/team-page';

const TABLE_NAME = 'team_page_content';

/**
 * Get the appropriate Supabase client
 * Uses service role client on server for admin operations (bypasses RLS)
 * Uses regular client on browser (respects RLS)
 */
function getSupabaseClient() {
  // On server, prefer service role client for admin operations
  if (typeof window === 'undefined') {
    const serviceClient = getServiceRoleClient();
    if (serviceClient) {
      return serviceClient;
    }
  }
  // Fallback to regular client (browser or server without service role)
  return supabase;
}

export class SupabaseTeamPageRepository {
  /**
   * Fetch team page content for a specific locale
   */
  async fetchTeamPageContent(locale: Locale): Promise<TeamPageContent | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('locale', locale)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found
        return null;
      }
      throw new Error(`Failed to fetch team page content: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Parse and validate the data
    const parsed = TeamPageContentSchema.safeParse({
      locale: data.locale,
      title: data.title,
      subtitle: data.subtitle,
      members: data.members || [],
      featuredMemberIds: data.featured_member_ids || [],
      updatedAt: data.updated_at,
    });

    if (!parsed.success) {
      console.error('Team page content validation failed:', parsed.error);
      return null;
    }

    return parsed.data;
  }

  /**
   * Upsert team page content for a specific locale
   */
  async upsertTeamPageContent(
    locale: Locale,
    payload: TeamPageContentPayload,
  ): Promise<TeamPageContent> {
    const updateData: Record<string, unknown> = {
      locale,
    };

    if (payload.title !== undefined) {
      updateData.title = payload.title;
    }

    if (payload.subtitle !== undefined) {
      updateData.subtitle = payload.subtitle;
    }

    if (payload.members !== undefined) {
      updateData.members = payload.members;
    }

    if (payload.featuredMemberIds !== undefined) {
      updateData.featured_member_ids = payload.featuredMemberIds;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .upsert(updateData, { onConflict: 'locale' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert team page content: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after upsert');
    }

    // Parse and validate the returned data
    const parsed = TeamPageContentSchema.safeParse({
      locale: data.locale,
      title: data.title,
      subtitle: data.subtitle,
      members: data.members || [],
      featuredMemberIds: data.featured_member_ids || [],
      updatedAt: data.updated_at,
    });

    if (!parsed.success) {
      throw new Error(`Team page content validation failed: ${parsed.error.message}`);
    }

    return parsed.data;
  }

  /**
   * Delete team page content for a specific locale
   */
  async deleteTeamPageContent(locale: Locale): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('locale', locale);

    if (error) {
      throw new Error(`Failed to delete team page content: ${error.message}`);
    }
  }
}

export const teamPageRepository = new SupabaseTeamPageRepository();

