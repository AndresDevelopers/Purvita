'use client';

import { use, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { useSiteBranding } from '@/contexts/site-branding-context';

interface AdminEmailNotificationsPageProps {
  searchParams: Promise<{ lang?: Locale }>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject_en: string;
  subject_es: string;
  body_en: string;
  body_es: string;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  // Promotional
  {
    id: 'promotional_offers',
    name: 'Promotional Offers',
    subject_en: 'Special Offer Just for You!',
    subject_es: '¡Oferta Especial Solo para Ti!',
    body_en: `<h2>Don't Miss Out!</h2>
<p>We have an exciting offer for you, {{userName}}!</p>
<p>{{offerDescription}}</p>
<a href="{{offerUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Offer</a>`,
    body_es: `<h2>¡No Te Lo Pierdas!</h2>
<p>¡Tenemos una oferta emocionante para ti, {{userName}}!</p>
<p>{{offerDescription}}</p>
<a href="{{offerUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Oferta</a>`,
  },
  // Team Updates
  {
    id: 'team_member_added',
    name: 'New Team Member',
    subject_en: 'New Team Member: {{newMemberName}} joined your team!',
    subject_es: 'Nuevo Miembro: ¡{{newMemberName}} se unió a tu equipo!',
    body_en: `<h2>Great News, {{sponsorName}}!</h2>
<p><strong>{{newMemberName}}</strong> ({{newMemberEmail}}) has just joined your team.</p>
<p>This is a great opportunity to reach out and welcome them to the team. Building strong relationships with your team members is key to success!</p>`,
    body_es: `<h2>¡Excelentes Noticias, {{sponsorName}}!</h2>
<p><strong>{{newMemberName}}</strong> ({{newMemberEmail}}) acaba de unirse a tu equipo.</p>
<p>Esta es una gran oportunidad para contactarlos y darles la bienvenida al equipo. ¡Construir relaciones sólidas con los miembros de tu equipo es clave para el éxito!</p>`,
  },
  // Content
  {
    id: 'new_video_content',
    name: 'New Video Content',
    subject_en: 'New Video Available: {{videoTitle}}',
    subject_es: 'Nuevo Video Disponible: {{videoTitle}}',
    body_en: `<h2>New Video Content Available!</h2>
<h3>{{videoTitle}}</h3>
<p>{{videoDescription}}</p>
<a href="{{videoUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Watch Now</a>`,
    body_es: `<h2>¡Nuevo Contenido de Video Disponible!</h2>
<h3>{{videoTitle}}</h3>
<p>{{videoDescription}}</p>
<a href="{{videoUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Ahora</a>`,
  },
  // Order Notifications
  {
    id: 'order_confirmation',
    name: 'Order Confirmation',
    subject_en: 'Order Confirmation - {{orderCode}}',
    subject_es: 'Confirmación de Pedido - {{orderCode}}',
    body_en: `<h2>Thank you for your order, {{userName}}!</h2>
<p>Your order <strong>{{orderCode}}</strong> has been confirmed.</p>
<p><strong>Total:</strong> {{totalAmount}}</p>
<p>We'll send you another email when your order ships.</p>`,
    body_es: `<h2>¡Gracias por tu pedido, {{userName}}!</h2>
<p>Tu pedido <strong>{{orderCode}}</strong> ha sido confirmado.</p>
<p><strong>Total:</strong> {{totalAmount}}</p>
<p>Te enviaremos otro correo cuando tu pedido sea enviado.</p>`,
  },
  {
    id: 'order_shipped',
    name: 'Order Shipped',
    subject_en: 'Your Order Has Shipped! - {{orderCode}}',
    subject_es: '¡Tu Pedido Ha Sido Enviado! - {{orderCode}}',
    body_en: `<h2>Your Order is On Its Way!</h2>
<p>Hello {{userName}}, your order <strong>{{orderCode}}</strong> has been shipped.</p>
<p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
<p><strong>Carrier:</strong> {{carrier}}</p>
<p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
<a href="{{trackingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Track Your Package</a>`,
    body_es: `<h2>¡Tu Pedido Está en Camino!</h2>
<p>Hola {{userName}}, tu pedido <strong>{{orderCode}}</strong> ha sido enviado.</p>
<p><strong>Número de Rastreo:</strong> {{trackingNumber}}</p>
<p><strong>Transportista:</strong> {{carrier}}</p>
<p><strong>Entrega Estimada:</strong> {{estimatedDelivery}}</p>
<a href="{{trackingUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Rastrear tu Paquete</a>`,
  },
  {
    id: 'order_delivered',
    name: 'Order Delivered',
    subject_en: 'Your Order Has Been Delivered - {{orderCode}}',
    subject_es: 'Tu Pedido Ha Sido Entregado - {{orderCode}}',
    body_en: `<h2>Your Order Has Been Delivered!</h2>
<p>Hello {{userName}}, your order <strong>{{orderCode}}</strong> has been successfully delivered.</p>
<p>We hope you enjoy your purchase! If you have any questions or concerns, please don't hesitate to contact us.</p>`,
    body_es: `<h2>¡Tu Pedido Ha Sido Entregado!</h2>
<p>Hola {{userName}}, tu pedido <strong>{{orderCode}}</strong> ha sido entregado exitosamente.</p>
<p>¡Esperamos que disfrutes tu compra! Si tienes alguna pregunta o inquietud, no dudes en contactarnos.</p>`,
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    subject_en: 'Order Cancelled - {{orderCode}}',
    subject_es: 'Pedido Cancelado - {{orderCode}}',
    body_en: `<h2>Order Cancelled</h2>
<p>Hello {{userName}}, your order <strong>{{orderCode}}</strong> has been cancelled as requested.</p>
<p><strong>Reason:</strong> {{cancellationReason}}</p>
<p>If you have any questions, please contact our support team.</p>`,
    body_es: `<h2>Pedido Cancelado</h2>
<p>Hola {{userName}}, tu pedido <strong>{{orderCode}}</strong> ha sido cancelado según lo solicitado.</p>
<p><strong>Razón:</strong> {{cancellationReason}}</p>
<p>Si tienes alguna pregunta, por favor contacta a nuestro equipo de soporte.</p>`,
  },
  // Subscription Notifications
  {
    id: 'subscription_cancelled_user',
    name: 'Subscription Cancelled (User Requested)',
    subject_en: 'Your subscription has been cancelled',
    subject_es: 'Tu suscripción ha sido cancelada',
    body_en: `<h2>Hi {{name}},</h2>
<p>We processed your cancellation request and stopped future charges.</p>
<p>Sign back in whenever you want to reactivate your membership.</p>
<p>Thank you for being part of {{appName}}.</p>`,
    body_es: `<h2>Hola {{name}},</h2>
<p>Procesamos tu solicitud de cancelación y detuvimos los próximos cargos.</p>
<p>Puedes volver a tu panel cuando quieras para reactivar la membresía.</p>
<p>Gracias por ser parte de {{appName}}.</p>`,
  },
  {
    id: 'subscription_cancelled_payment_failure',
    name: 'Subscription Cancelled (Payment Failed)',
    subject_en: 'Your {{appName}} subscription was cancelled after a failed payment',
    subject_es: 'Cancelamos tu suscripción de {{appName}} tras un pago fallido',
    body_en: `<h2>Hi {{name}},</h2>
<p>We were unable to process your last subscription payment, so we cancelled the plan to protect your account.</p>
<p>Update your payment method and reactivate your membership whenever you're ready.</p>
<p>If this was an error, sign in to restart your membership.</p>`,
    body_es: `<h2>Hola {{name}},</h2>
<p>No pudimos procesar tu último pago de suscripción, así que cancelamos el plan para proteger tu cuenta.</p>
<p>Actualiza tu método de pago y reactiva la membresía cuando estés lista.</p>
<p>Si fue un error, inicia sesión para reiniciar tu membresía.</p>`,
  },
  {
    id: 'subscription_renewal_success',
    name: 'Subscription Renewed Successfully',
    subject_en: 'Subscription Renewed Successfully - {{appName}}',
    subject_es: 'Suscripción Renovada Exitosamente - {{appName}}',
    body_en: `<h2>Hi {{name}},</h2>
<p>Your {{appName}} subscription has been successfully renewed!</p>
<p><strong>Amount Charged:</strong> {{amount}}</p>
<p><strong>Payment Method:</strong> {{paymentMethod}}</p>
<p><strong>Next Billing Date:</strong> {{nextBillingDate}}</p>
<p>Thank you for continuing your membership with {{appName}}.</p>`,
    body_es: `<h2>Hola {{name}},</h2>
<p>¡Tu suscripción de {{appName}} ha sido renovada exitosamente!</p>
<p><strong>Monto Cobrado:</strong> {{amount}}</p>
<p><strong>Método de Pago:</strong> {{paymentMethod}}</p>
<p><strong>Próxima Fecha de Cobro:</strong> {{nextBillingDate}}</p>
<p>Gracias por continuar tu membresía con {{appName}}.</p>`,
  },
  {
    id: 'subscription_renewal_failure',
    name: 'Subscription Renewal Failed',
    subject_en: 'Subscription Renewal Failed - {{appName}}',
    subject_es: 'Fallo en la Renovación de Suscripción - {{appName}}',
    body_en: `<h2>Hi {{name}},</h2>
<p>We were unable to renew your {{appName}} subscription.</p>
<p><strong>Amount:</strong> {{amount}}</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>Please update your payment method to continue your subscription.</p>
<a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Update Payment Method</a>`,
    body_es: `<h2>Hola {{name}},</h2>
<p>No pudimos renovar tu suscripción de {{appName}}.</p>
<p><strong>Monto:</strong> {{amount}}</p>
<p><strong>Razón:</strong> {{reason}}</p>
<p>Por favor actualiza tu método de pago para continuar tu suscripción.</p>
<a href="{{updatePaymentUrl}}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Actualizar Método de Pago</a>`,
  },
  // Payment Notifications
  {
    id: 'payment_reminder',
    name: 'Payment Reminder',
    subject_en: 'Payment Reminder - {{appName}}',
    subject_es: 'Recordatorio de Pago - {{appName}}',
    body_en: `<h2>Payment Reminder</h2>
<p>Hello {{userName}}, this is a friendly reminder that you have an upcoming payment.</p>
<p><strong>Amount Due:</strong> {{amount}}</p>
<p><strong>Due Date:</strong> {{dueDate}}</p>
<p>Please ensure your payment method is up to date to avoid any service interruption.</p>`,
    body_es: `<h2>Recordatorio de Pago</h2>
<p>Hola {{userName}}, este es un recordatorio amistoso de que tienes un pago próximo.</p>
<p><strong>Monto a Pagar:</strong> {{amount}}</p>
<p><strong>Fecha de Vencimiento:</strong> {{dueDate}}</p>
<p>Por favor asegúrate de que tu método de pago esté actualizado para evitar interrupciones en el servicio.</p>`,
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    subject_en: 'Payment Received - Thank You!',
    subject_es: 'Pago Recibido - ¡Gracias!',
    body_en: `<h2>Payment Received!</h2>
<p>Hello {{userName}}, we have successfully received your payment of <strong>{{amount}}</strong>.</p>
<p><strong>Payment Method:</strong> {{paymentMethod}}</p>
<p><strong>Transaction ID:</strong> {{transactionId}}</p>
<p><strong>Date:</strong> {{paymentDate}}</p>
<p>Thank you for your payment!</p>`,
    body_es: `<h2>¡Pago Recibido!</h2>
<p>Hola {{userName}}, hemos recibido exitosamente tu pago de <strong>{{amount}}</strong>.</p>
<p><strong>Método de Pago:</strong> {{paymentMethod}}</p>
<p><strong>ID de Transacción:</strong> {{transactionId}}</p>
<p><strong>Fecha:</strong> {{paymentDate}}</p>
<p>¡Gracias por tu pago!</p>`,
  },
];

// Sample data for email preview
const SAMPLE_VARIABLES: Record<string, string> = {
  userName: 'John Doe',
  name: 'John Doe',
  sponsorName: 'Jane Smith',
  sponsorEmail: 'jane.smith@example.com',
  newMemberName: 'John Doe',
  newMemberEmail: 'john.doe@example.com',
  offerDescription: 'Get 20% off on all products this week!',
  offerUrl: '#offer',
  videoTitle: 'Getting Started with Our Platform',
  videoDescription: 'Learn how to make the most of your membership in this comprehensive guide.',
  videoUrl: '#video',
  orderCode: 'ORD-2024-001',
  totalAmount: '$149.99',
  trackingNumber: '1Z999AA10123456784',
  carrier: 'UPS',
  estimatedDelivery: 'March 15, 2024',
  trackingUrl: '#tracking',
  cancellationReason: 'Customer requested cancellation',
  appName: 'PurVita',
  amount: '$49.99',
  paymentMethod: 'Visa ending in 4242',
  nextBillingDate: 'April 1, 2024',
  reason: 'Card declined',
  updatePaymentUrl: '#update-payment',
  dueDate: 'March 20, 2024',
  transactionId: 'TXN-2024-12345',
  paymentDate: 'March 1, 2024',
};

// Function to replace template variables with sample data
const replaceVariables = (template: string): string => {
  let result = template;
  Object.entries(SAMPLE_VARIABLES).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, value);
  });
  return result;
};

// Function to create email HTML with proper layout
const createEmailPreview = (subject: string, body: string, appName: string): string => {
  const processedBody = replaceVariables(body);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;" cellpadding="0" cellspacing="0">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 0.5px;">
                ${appName}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px; color: #333333; font-size: 16px; line-height: 1.6;">
              ${processedBody}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                This is a preview of how your email will appear to recipients.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminEmailNotificationsPage({ searchParams }: AdminEmailNotificationsPageProps) {
  const params = use(searchParams);
  const lang = params.lang || 'en';
  const { branding } = useSiteBranding();
  const dictionary = useMemo(() => getDictionary(lang, branding.appName), [lang, branding.appName]);
  const copy = dictionary?.admin?.emailNotifications;
  const { toast } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('promotional_offers');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>('en');

  const currentTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplate) || templates[0],
    [templates, selectedTemplate]
  );

  const handleTemplateChange = (field: keyof EmailTemplate, value: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplate
          ? { ...t, [field]: value }
          : t
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    try {
      // ✅ SECURITY: Use adminApi.put() to automatically include CSRF token
      const { adminApi } = await import('@/lib/utils/admin-csrf-helpers');
      const response = await adminApi.put('/api/admin/email-notifications', { templates });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || copy?.errors?.saveFailed || 'Could not save email templates.';
        throw new Error(message);
      }

      toast({
        title: copy?.toast?.successTitle ?? 'Templates updated',
        description: copy?.toast?.successDescription ?? 'Email templates were saved successfully.',
      });
    } catch (error) {
      console.error('[AdminEmailNotifications] Failed to save templates', error);
      const message = error instanceof Error ? error.message : copy?.errors?.saveFailed ?? 'Could not save email templates.';
      setErrorMessage(message);
      toast({
        title: copy?.toast?.errorTitle ?? 'Update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = (language: 'en' | 'es') => {
    setPreviewLang(language);
    setPreviewOpen(true);
  };

  const previewHtml = useMemo(() => {
    const subject = previewLang === 'en' ? currentTemplate.subject_en : currentTemplate.subject_es;
    const body = previewLang === 'en' ? currentTemplate.body_en : currentTemplate.body_es;
    return createEmailPreview(subject, body, branding.appName);
  }, [currentTemplate, previewLang, branding.appName]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {copy?.title ?? 'Email Notifications'}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {copy?.description ?? 'Manage email notification templates in multiple languages. Customize the content that users receive for different events.'}
        </p>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{copy?.errors?.title ?? 'An issue occurred'}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{copy?.form?.title ?? 'Email Templates'}</CardTitle>
          <CardDescription>
            {copy?.form?.description ?? 'Select a template to edit its content in English and Spanish.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="template-select">{copy?.form?.selectTemplate ?? 'Select Template'}</Label>
            <select
              id="template-select"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              aria-label={copy?.form?.selectTemplate ?? 'Select Template'}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <Tabs defaultValue="en" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="es">Español</TabsTrigger>
            </TabsList>

            <TabsContent value="en" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="subject-en">{copy?.form?.subject ?? 'Subject'}</Label>
                <Input
                  id="subject-en"
                  value={currentTemplate.subject_en}
                  onChange={(e) => handleTemplateChange('subject_en', e.target.value)}
                  placeholder="Email subject in English"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body-en">{copy?.form?.body ?? 'Body (HTML)'}</Label>
                <Textarea
                  id="body-en"
                  value={currentTemplate.body_en}
                  onChange={(e) => handleTemplateChange('body_en', e.target.value)}
                  placeholder="Email body in English (HTML supported)"
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {copy?.form?.variablesHint ?? 'Use {{variableName}} for dynamic content. Available variables depend on the template type.'}
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePreview('en')}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Preview Email
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="es" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="subject-es">{copy?.form?.subject ?? 'Asunto'}</Label>
                <Input
                  id="subject-es"
                  value={currentTemplate.subject_es}
                  onChange={(e) => handleTemplateChange('subject_es', e.target.value)}
                  placeholder="Asunto del correo en español"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body-es">{copy?.form?.body ?? 'Cuerpo (HTML)'}</Label>
                <Textarea
                  id="body-es"
                  value={currentTemplate.body_es}
                  onChange={(e) => handleTemplateChange('body_es', e.target.value)}
                  placeholder="Cuerpo del correo en español (HTML soportado)"
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {copy?.form?.variablesHint ?? 'Usa {{nombreVariable}} para contenido dinámico. Las variables disponibles dependen del tipo de plantilla.'}
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePreview('es')}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Previsualizar Email
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-4 border-t">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {copy?.form?.saving ?? 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {copy?.form?.submit ?? 'Save Templates'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy?.variables?.title ?? 'Available Variables'}</CardTitle>
          <CardDescription>
            {copy?.variables?.description ?? 'Variables you can use in your email templates'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Promotional Offers</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{userName}}'}</code> - User&apos;s name</li>
                <li><code>{'{{offerDescription}}'}</code> - Offer description</li>
                <li><code>{'{{offerUrl}}'}</code> - Offer URL</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Team Member Added</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{sponsorName}}'}</code> - Sponsor&apos;s name</li>
                <li><code>{'{{sponsorEmail}}'}</code> - Sponsor&apos;s email</li>
                <li><code>{'{{newMemberName}}'}</code> - New member&apos;s name</li>
                <li><code>{'{{newMemberEmail}}'}</code> - New member&apos;s email</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">New Video Content</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{videoTitle}}'}</code> - Video title</li>
                <li><code>{'{{videoDescription}}'}</code> - Video description</li>
                <li><code>{'{{videoUrl}}'}</code> - Video URL</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Orders</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{userName}}'}</code> - User&apos;s name</li>
                <li><code>{'{{orderCode}}'}</code> - Order code</li>
                <li><code>{'{{totalAmount}}'}</code> - Total amount</li>
                <li><code>{'{{trackingNumber}}'}</code> - Tracking number</li>
                <li><code>{'{{carrier}}'}</code> - Carrier name</li>
                <li><code>{'{{estimatedDelivery}}'}</code> - Estimated delivery</li>
                <li><code>{'{{trackingUrl}}'}</code> - Tracking URL</li>
                <li><code>{'{{cancellationReason}}'}</code> - Cancellation reason</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Subscriptions</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{name}}'}</code> - User&apos;s name</li>
                <li><code>{'{{appName}}'}</code> - Application name</li>
                <li><code>{'{{amount}}'}</code> - Amount charged</li>
                <li><code>{'{{paymentMethod}}'}</code> - Payment method</li>
                <li><code>{'{{nextBillingDate}}'}</code> - Next billing date</li>
                <li><code>{'{{reason}}'}</code> - Failure reason</li>
                <li><code>{'{{updatePaymentUrl}}'}</code> - Update payment URL</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Payments</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><code>{'{{userName}}'}</code> - User&apos;s name</li>
                <li><code>{'{{amount}}'}</code> - Amount</li>
                <li><code>{'{{dueDate}}'}</code> - Due date</li>
                <li><code>{'{{paymentMethod}}'}</code> - Payment method</li>
                <li><code>{'{{transactionId}}'}</code> - Transaction ID</li>
                <li><code>{'{{paymentDate}}'}</code> - Payment date</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewLang === 'en' ? 'Email Preview - English' : 'Vista Previa - Español'}
            </DialogTitle>
            <DialogDescription>
              {previewLang === 'en'
                ? 'This is how your email will look when recipients open it in their email client.'
                : 'Así es como se verá tu correo cuando los destinatarios lo abran en su cliente de correo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full min-h-[600px] border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

