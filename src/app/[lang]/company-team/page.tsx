'use client';

import { use, useEffect, useState } from 'react';
import Image from 'next/image';
import type { Locale } from '@/i18n/config';
import { Users } from 'lucide-react';
import type { TeamPageContent } from '@/modules/site-content/domain/models/team-page';

export default function CompanyTeamPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const [teamContent, setTeamContent] = useState<TeamPageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeamContent() {
      try {
        const response = await fetch(`/api/public/team-page?locale=${lang}`);
        if (response.ok) {
          const data = await response.json();
          setTeamContent(data);
        }
      } catch (error) {
        console.error('Error fetching team content:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamContent();
  }, [lang]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!teamContent || teamContent.members.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background text-muted-foreground">
        <p>No team information available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16">
        {/* Header */}
        <div className="max-w-3xl text-center mx-auto space-y-4">
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">{teamContent.title}</h1>
          <p className="text-lg text-muted-foreground">{teamContent.subtitle}</p>
        </div>

        {/* Team Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {teamContent.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card p-8 shadow-lg dark:bg-slate-900/60 text-center transition-all hover:shadow-xl"
            >
              {member.imageUrl ? (
                <div className="relative h-40 w-40 overflow-hidden rounded-full">
                  <Image
                    src={member.imageUrl}
                    alt={member.name}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-20 w-20 text-primary" />
                </div>
              )}
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground">{member.name}</h2>
                <p className="text-base font-medium text-primary">{member.role}</p>
                {member.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{member.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

