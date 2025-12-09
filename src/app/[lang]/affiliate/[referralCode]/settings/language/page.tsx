'use client';

import { useState, use } from 'react';
import type { Locale } from '@/i18n/config';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { ArrowLeft } from 'lucide-react';

interface AffiliateLanguagePageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliateLanguagePage({ params }: AffiliateLanguagePageProps) {
  const { lang, referralCode } = use(params);
  const _dict = useAppDictionary();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(lang);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
  ];

  const handleApply = () => {
    // Redirect to the selected language in affiliate context
    router.push(`/${selectedLanguage}/affiliate/${referralCode}/settings/language`);
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Language Settings</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Choose your preferred language for the application.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="space-y-2 p-6">
              <RadioGroup value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as Locale)}>
                {languages.map((language) => (
                  <div key={language.code} className="flex items-center justify-between p-4 rounded-lg cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 data-[state=checked]:bg-primary/20 dark:data-[state=checked]:bg-primary/30 data-[state=checked]:border-primary border border-transparent dark:border-transparent">
                    <Label htmlFor={language.code} className="text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                      {language.name}
                    </Label>
                    <RadioGroupItem value={language.code} id={language.code} />
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end rounded-b-xl">
              <Button onClick={handleApply} className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

