import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getSiteBranding } from '@/modules/site-content/services/site-content-service';
import { getStaticPages } from '@/modules/site-content/services/static-pages-service';
import ContactForm from '@/app/components/contact-form';

export default async function Contact({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = getDictionary(lang);
  const branding = await getSiteBranding();
  const staticPages = await getStaticPages(lang, branding.appName);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">{staticPages.contact.title}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {staticPages.contact.subtitle}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">{staticPages.contact.contactInfo.title}</h2>
              <div className="space-y-3 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{dict.contact.email}</span>
                  <span>{staticPages.contact.contactInfo.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{dict.contact.phone}</span>
                  <span>{staticPages.contact.contactInfo.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{dict.contact.hours}</span>
                  <span>{staticPages.contact.contactInfo.hours}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">{staticPages.contact.whyReachOut.title}</h3>
              <ul className="space-y-2 text-muted-foreground">
                {staticPages.contact.whyReachOut.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <ContactForm lang={lang} dict={dict} />
          </div>
        </div>
      </div>
    </div>
  );
}