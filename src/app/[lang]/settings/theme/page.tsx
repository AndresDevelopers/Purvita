'use client';

import { useState, useEffect, use } from 'react';
import type { Locale } from '@/i18n/config';
import { RadioGroup as _RadioGroup, RadioGroupItem as _RadioGroupItem } from '@/components/ui/radio-group';
import { Label as _Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { useAppDictionary } from '@/contexts/locale-content-context';

interface ThemePageProps {
  params: Promise<{
    lang: Locale;
  }>;
}

export default function ThemePage({ params }: ThemePageProps) {
  const { lang } = use(params);
  const _dict = useAppDictionary();
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  useEffect(() => {
    if (theme) {
      setSelectedTheme(theme);
    }
  }, [theme]);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const handleSave = () => {
    setTheme(selectedTheme);
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Theme</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Choose how PūrVita looks to you. Select a theme below.</p>
          </div>
          <div className="space-y-6">
            <fieldset>
              <legend className="sr-only">Theme selection</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themes.map((themeOption) => {
                  const Icon = themeOption.icon;
                  const isChecked = selectedTheme === themeOption.value;
                  return (
                    <label key={themeOption.value} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="theme-option"
                        value={themeOption.value}
                        checked={isChecked}
                        onChange={() => setSelectedTheme(themeOption.value)}
                        className="peer absolute h-full w-full opacity-0 cursor-pointer"
                      />
                      <div className={`flex flex-col items-center justify-center text-center p-4 rounded-lg border-2 transition-all duration-200 h-32 ${
                        isChecked
                          ? 'border-primary bg-primary/10 dark:bg-primary/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}>
                        <Icon className={`w-8 h-8 mb-2 ${
                          isChecked
                            ? 'text-primary'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                        <span className={`font-medium ${
                          isChecked
                            ? 'text-primary'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {themeOption.label}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}