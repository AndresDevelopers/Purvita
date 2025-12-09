import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import { getStaticPages } from '@/modules/site-content/services/static-pages-service';

export default async function TermsPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const branding = await getSiteBranding();
  const staticPages = await getStaticPages(lang, branding.appName);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-headline">{staticPages.terms.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            {staticPages.terms.intro}
          </p>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.terms.sections.license.title}</h3>
          <p>
            {staticPages.terms.sections.license.content}
          </p>
          <p>{staticPages.terms.sections.license.restrictions.title}</p>
          <ul className="list-disc list-inside space-y-2">
            {staticPages.terms.sections.license.restrictions.items.map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.terms.sections.userContent.title}</h3>
          <p>
            {staticPages.terms.sections.userContent.content}
          </p>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.terms.sections.limitationOfLiability.title}</h3>
          <p>
            {staticPages.terms.sections.limitationOfLiability.content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
