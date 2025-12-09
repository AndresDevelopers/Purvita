"use client";

import { FormEvent, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { AppDictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeUserInput } from "@/lib/security/frontend-sanitization";

interface ContactFormProps {
  lang: Locale;
  dict: AppDictionary;
}

export default function ContactForm({ lang, dict }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');

  // ✅ SECURITY: Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    };
    fetchCsrfToken();
  }, []);

  const handleFieldChange = (field: 'name' | 'email' | 'message', value: string) => {
    if (status !== 'idle') {
      setStatus('idle');
      setError(null);
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setError(null);

    try {
      // ✅ SECURITY: Include CSRF token in request
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          ...formData,
          locale: lang,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const rawMessage = body?.error ?? 'No se pudo enviar el mensaje.';
        // ✅ SECURITY: Sanitize error message before displaying
        const message = sanitizeUserInput(rawMessage);
        throw new Error(message);
      }

      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
    } catch (_error) {
      const rawMessage = (error as any) instanceof Error ? (error as any).message : 'No se pudo enviar el mensaje.';
      // ✅ SECURITY: Sanitize error message before displaying
      const message = sanitizeUserInput(rawMessage);
      setError(message);
      setStatus('error');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{dict.contact.formTitle}</CardTitle>
        <CardDescription>
          {dict.contact.formDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="contact-name">{dict.contact.nameLabel}</Label>
            <Input
              id="contact-name"
              type="text"
              required
              minLength={2}
              maxLength={180}
              placeholder={dict.contact.namePlaceholder}
              value={formData.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              disabled={status === 'loading'}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">{dict.contact.emailLabel}</Label>
            <Input
              id="contact-email"
              type="email"
              required
              maxLength={180}
              placeholder={dict.contact.emailPlaceholder}
              value={formData.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              disabled={status === 'loading'}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">{dict.contact.messageLabel}</Label>
            <Textarea
              id="contact-message"
              required
              minLength={10}
              maxLength={4000}
              placeholder={dict.contact.messagePlaceholder}
              value={formData.message}
              onChange={(event) => handleFieldChange('message', event.target.value)}
              disabled={status === 'loading'}
              className="min-h-[120px] w-full resize-none"
            />
          </div>

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={status === 'loading'}
              size="lg"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dict.contact.sendingLabel}
                </>
              ) : (
                dict.contact.sendButton
              )}
            </Button>

            <div className="min-h-[3rem] rounded-lg bg-muted/50 px-4 py-3 text-sm" aria-live="polite" role="status">
              {status === 'success' ? (
                <p className="text-green-600 dark:text-green-400">
                  {dict.contact.successMessage}
                </p>
              ) : status === 'error' ? (
                <p className="text-red-600 dark:text-red-400">{error}</p>
              ) : (
                <p className="text-muted-foreground">
                  {dict.contact.helperText}
                </p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}