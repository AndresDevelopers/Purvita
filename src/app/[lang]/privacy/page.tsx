import type { Locale } from '@/i18n/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import { getStaticPages } from '@/modules/site-content/services/static-pages-service';

export default async function PrivacyPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const branding = await getSiteBranding();
  const staticPages = await getStaticPages(lang, branding.appName);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-headline">{staticPages.privacy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            {staticPages.privacy.intro}
          </p>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.privacy.sections.informationWeCollect.title}</h3>
          <p>
            {staticPages.privacy.sections.informationWeCollect.content}
          </p>
          <p>
            {staticPages.privacy.sections.informationWeCollect.details}
          </p>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.privacy.sections.howWeUseInformation.title}</h3>
          <p>
            {staticPages.privacy.sections.howWeUseInformation.content}
          </p>
          <h3 className="font-semibold text-lg text-foreground pt-4">{staticPages.privacy.sections.dataProtection.title}</h3>
          <p>
            {staticPages.privacy.sections.dataProtection.content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
