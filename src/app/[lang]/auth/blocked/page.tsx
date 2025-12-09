'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldX, Mail, Calendar, AlertTriangle } from 'lucide-react';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { use } from 'react';
import type { Locale } from '@/i18n/config';

interface BlockedPageProps {
  params: Promise<{ lang: Locale }>;
}

export default function BlockedPage({ params }: BlockedPageProps) {
  const { lang } = use(params);
  const searchParams = useSearchParams();
  const _dict = useAppDictionary();
  
  const reason = searchParams.get('reason') || 'Your account has been suspended.';
  const fraudType = searchParams.get('type');
  const expiresAt = searchParams.get('expires');

  // Format expiration date if provided
  const formattedExpiry = expiresAt 
    ? new Date(expiresAt).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const getFraudTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; es: string }> = {
      payment_fraud: { en: 'Payment Fraud', es: 'Fraude de Pago' },
      chargeback_abuse: { en: 'Chargeback Abuse', es: 'Abuso de Contracargos' },
      account_takeover: { en: 'Account Takeover', es: 'Robo de Cuenta' },
      velocity_abuse: { en: 'Velocity Abuse', es: 'Abuso de Velocidad' },
      multiple_accounts: { en: 'Multiple Accounts', es: 'Cuentas Múltiples' },
      synthetic_identity: { en: 'Synthetic Identity', es: 'Identidad Sintética' },
      other: { en: 'Policy Violation', es: 'Violación de Políticas' },
    };
    return labels[type]?.[lang] || labels.other[lang];
  };

  const content = {
    en: {
      title: 'Account Suspended',
      subtitle: 'Your account has been blocked',
      reasonLabel: 'Reason for suspension:',
      typeLabel: 'Violation type:',
      expiresLabel: 'Suspension expires:',
      permanent: 'This suspension is permanent.',
      contactTitle: 'Need Help?',
      contactDescription: 'If you believe this is a mistake, please contact our support team.',
      contactButton: 'Contact Support',
      homeButton: 'Go to Home',
    },
    es: {
      title: 'Cuenta Suspendida',
      subtitle: 'Tu cuenta ha sido bloqueada',
      reasonLabel: 'Razón de la suspensión:',
      typeLabel: 'Tipo de violación:',
      expiresLabel: 'La suspensión expira:',
      permanent: 'Esta suspensión es permanente.',
      contactTitle: '¿Necesitas Ayuda?',
      contactDescription: 'Si crees que esto es un error, por favor contacta a nuestro equipo de soporte.',
      contactButton: 'Contactar Soporte',
      homeButton: 'Ir al Inicio',
    },
  };

  const t = content[lang] || content.en;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-2xl text-destructive">{t.title}</CardTitle>
            <CardDescription className="text-base mt-2">{t.subtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reason Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t.reasonLabel}</AlertTitle>
            <AlertDescription className="mt-2">
              {reason}
            </AlertDescription>
          </Alert>

          {/* Details */}
          <div className="space-y-3 text-sm">
            {fraudType && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldX className="h-4 w-4" />
                <span className="font-medium">{t.typeLabel}</span>
                <span>{getFraudTypeLabel(fraudType)}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{t.expiresLabel}</span>
              <span>{formattedExpiry || t.permanent}</span>
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{t.contactTitle}</p>
                <p className="text-sm text-muted-foreground">{t.contactDescription}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/${lang}/contact`}>
                {t.contactButton}
              </Link>
            </Button>
          </div>

          {/* Home Button */}
          <Button variant="ghost" className="w-full" asChild>
            <Link href={`/${lang}`}>
              {t.homeButton}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
