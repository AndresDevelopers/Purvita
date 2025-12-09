import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { TeamMember } from '../domain/models/team-page';

interface FeaturedTeamData {
  title: string;
  subtitle: string;
  members: TeamMember[];
}

/**
 * Hook to fetch featured team members for the landing page
 * Fetches featuredMemberIds from landing_page_content.team
 * and member details from team_page_content.members
 */
export function useFeaturedTeamMembers(locale: Locale) {
  const [data, setData] = useState<FeaturedTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchFeaturedMembers() {
      try {
        setLoading(true);

        // Fetch both landing content (for featuredMemberIds) and team page content (for member details)
        const [landingResponse, teamResponse] = await Promise.all([
          fetch(`/api/public/site-content?locale=${locale}`),
          fetch(`/api/public/team-page?locale=${locale}`)
        ]);

        if (!landingResponse.ok || !teamResponse.ok) {
          throw new Error('Failed to fetch content');
        }

        const landingContent = await landingResponse.json();
        const teamPageContent = await teamResponse.json();

        // Get featured member IDs from landing_page_content.team
        const featuredMemberIds = landingContent.landing?.team?.featuredMemberIds || [];

        // Get member details from team_page_content.members
        const featuredMembers = featuredMemberIds
          .map((id: string) =>
            teamPageContent.members.find((member: TeamMember) => member.id === id)
          )
          .filter((member: TeamMember | undefined): member is TeamMember => member !== undefined)
          .slice(0, 4);

        setData({
          title: landingContent.landing?.team?.title || 'Our Team',
          subtitle: landingContent.landing?.team?.subtitle || 'Meet the people behind our success',
          members: featuredMembers,
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching featured team members:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedMembers();
  }, [locale]);

  return { data, loading, error };
}

