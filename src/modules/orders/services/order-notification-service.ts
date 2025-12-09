import { sendEmail } from '@/lib/services/email-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmailTemplateService, EMAIL_TEMPLATE_IDS, type TemplateLocale } from '@/modules/email-templates';

interface PaymentConfirmationParams {
  orderId: string;
  orderCode?: string;
  userEmail: string;
  userName: string;
  totalCents: number;
  currency: string;
  items?: Array<{
    name: string;
    quantity: number;
    priceCents: number;
  }>;
  gateway: string;
  locale?: string;
}

interface TrackingUpdateParams {
  orderId: string;
  orderCode?: string;
  userEmail: string;
  userName: string;
  status: string;
  trackingCode?: string;
  responsibleCompany?: string;
  location?: string;
  estimatedDelivery?: string;
  locale?: string;
}

interface DeliveryConfirmationParams {
  orderId: string;
  orderCode?: string;
  userEmail: string;
  userName: string;
  trackingCode?: string;
  responsibleCompany?: string;
  deliveryDate: string;
  locale?: string;
}

interface CancellationNotificationParams {
  orderId: string;
  orderCode?: string;
  userEmail: string;
  userName: string;
  reason?: string;
  trackingCode?: string;
  locale?: string;
}

export class OrderNotificationService {
  private readonly templateService = createEmailTemplateService();

  constructor(private readonly supabaseClient: SupabaseClient) {}

  /**
   * Check if user has order notifications enabled
   */
  private async checkOrderNotificationsEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from('notification_preferences')
        .select('order_notifications')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking notification preferences:', error);
        // If we can't check preferences, default to enabled to not block notifications
        return true;
      }

      // If no preferences exist, default to enabled
      if (!data) {
        return true;
      }

      return data.order_notifications;
    } catch (error) {
      console.error('Error in checkOrderNotificationsEnabled:', error);
      // Default to enabled on error
      return true;
    }
  }

  /**
   * Send payment confirmation email when order is paid
   */
  async sendPaymentConfirmationEmail(params: PaymentConfirmationParams): Promise<void> {
    try {
      // Get user ID from email to check preferences
      const userId = await this.getUserIdFromEmail(params.userEmail);
      if (!userId) {
        console.log('[OrderNotificationService] User not found, skipping email');
        return;
      }

      // Check if user has order notifications enabled
      const notificationsEnabled = await this.checkOrderNotificationsEnabled(userId);
      if (!notificationsEnabled) {
        console.log('[OrderNotificationService] Order notifications disabled for user, skipping payment email');
        return;
      }

      const locale = (params.locale === 'es' ? 'es' : 'en') as TemplateLocale;
      const displayCode = params.orderCode || params.orderId.slice(0, 8);
      const totalFormatted = this.formatCurrency(params.totalCents, params.currency);
      const gatewayName = this.getGatewayDisplayName(params.gateway);

      // Build items list for template
      let itemsList = '';
      if (params.items && params.items.length > 0) {
        itemsList = params.items.map(item =>
          `${item.name} x${item.quantity} - ${this.formatCurrency(item.priceCents, params.currency)}`
        ).join(', ');
      }

      // Get processed template from database
      const template = await this.templateService.getProcessedTemplate(
        EMAIL_TEMPLATE_IDS.ORDER_CONFIRMATION,
        {
          userName: params.userName,
          orderCode: displayCode,
          totalAmount: totalFormatted,
          paymentMethod: gatewayName,
          items: itemsList,
        },
        locale
      );

      if (!template) {
        console.error('[OrderNotificationService] Order confirmation template not found, using fallback');
        await this.sendPaymentConfirmationFallback(params);
        return;
      }

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject: template.subject,
        html: template.html,
      });

      console.log(`Payment confirmation email sent to ${params.userEmail} for order ${params.orderId}`);
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      // Don't throw - we don't want to fail the main operation if email fails
    }
  }

  /**
   * Fallback method for payment confirmation (if template not in DB)
   */
  private async sendPaymentConfirmationFallback(params: PaymentConfirmationParams): Promise<void> {
    const isSpanish = params.locale === 'es';
    const displayCode = params.orderCode || params.orderId.slice(0, 8);
    const totalFormatted = this.formatCurrency(params.totalCents, params.currency);
    const gatewayName = this.getGatewayDisplayName(params.gateway);

    const subject = isSpanish
      ? `✓ Confirmación de Pago - Pedido ${displayCode}`
      : `✓ Payment Confirmation - Order ${displayCode}`;

    let itemsHtml = '';
    if (params.items && params.items.length > 0) {
      const itemsTitle = isSpanish ? 'Artículos:' : 'Items:';
      itemsHtml = `
        <div style="margin: 20px 0;">
          <h3 style="color: #555; font-size: 16px;">${itemsTitle}</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${params.items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">x${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${this.formatCurrency(item.priceCents, params.currency)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${isSpanish ? '¡Pago Confirmado!' : 'Payment Confirmed!'}</h2>
        <p>${isSpanish ? 'Hola' : 'Hello'} ${params.userName},</p>
        <p>${isSpanish ? '¡Gracias por tu compra! Hemos recibido tu pago exitosamente.' : 'Thank you for your purchase! We have successfully received your payment.'}</p>
        <p><strong>${isSpanish ? 'Número de Pedido' : 'Order Number'}:</strong> ${displayCode}</p>
        <p><strong>${isSpanish ? 'Total Pagado' : 'Total Paid'}:</strong> ${totalFormatted}</p>
        <p><strong>${isSpanish ? 'Método de Pago' : 'Payment Method'}:</strong> ${gatewayName}</p>
        ${itemsHtml}
      </div>
    `;

    const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
    const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
    const fromAddress = `${fromName} <${fromEmail}>`;

    await sendEmail({
      from: fromAddress,
      to: params.userEmail,
      subject,
      html,
    });
  }

  /**
   * Send delivery confirmation email when package is delivered
   */
  async sendDeliveryConfirmationEmail(params: DeliveryConfirmationParams): Promise<void> {
    try {
      // Get user ID from email to check preferences
      const userId = await this.getUserIdFromEmail(params.userEmail);
      if (!userId) {
        console.log('[OrderNotificationService] User not found, skipping delivery email');
        return;
      }

      // Check if user has order notifications enabled
      const notificationsEnabled = await this.checkOrderNotificationsEnabled(userId);
      if (!notificationsEnabled) {
        console.log('[OrderNotificationService] Order notifications disabled for user, skipping delivery email');
        return;
      }

      const locale = (params.locale === 'es' ? 'es' : 'en') as TemplateLocale;
      const displayCode = params.orderCode || params.orderId.slice(0, 8);
      const deliveryDateFormatted = new Date(params.deliveryDate).toLocaleDateString(
        locale === 'es' ? 'es-ES' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      );

      // Get processed template from database
      const template = await this.templateService.getProcessedTemplate(
        EMAIL_TEMPLATE_IDS.ORDER_DELIVERED,
        {
          userName: params.userName,
          orderCode: displayCode,
          trackingNumber: params.trackingCode || '',
          carrier: params.responsibleCompany || '',
          deliveryDate: deliveryDateFormatted,
        },
        locale
      );

      if (!template) {
        console.error('[OrderNotificationService] Order delivered template not found');
        return;
      }

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject: template.subject,
        html: template.html,
      });

      console.log(`Delivery confirmation email sent to ${params.userEmail} for order ${params.orderId}`);
    } catch (error) {
      console.error('Error sending delivery confirmation email:', error);
    }
  }

  /**
   * Send cancellation notification email
   */
  async sendCancellationNotificationEmail(params: CancellationNotificationParams): Promise<void> {
    try {
      // Get user ID from email to check preferences
      const userId = await this.getUserIdFromEmail(params.userEmail);
      if (!userId) {
        console.log('[OrderNotificationService] User not found, skipping cancellation email');
        return;
      }

      // Check if user has order notifications enabled
      const notificationsEnabled = await this.checkOrderNotificationsEnabled(userId);
      if (!notificationsEnabled) {
        console.log('[OrderNotificationService] Order notifications disabled for user, skipping cancellation email');
        return;
      }

      const isSpanish = params.locale === 'es';

      const subject = isSpanish
        ? `⚠️ Envío Cancelado - Pedido ${params.orderCode || params.orderId.slice(0, 8)}`
        : `⚠️ Shipment Canceled - Order ${params.orderCode || params.orderId.slice(0, 8)}`;

      const html = isSpanish ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Envío Cancelado</h1>
          </div>

          <div style="padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-bottom: 10px;">Hola ${params.userName},</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Lamentamos informarte que el envío de tu pedido ha sido cancelado.
            </p>

            <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
              <p style="color: #c62828; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">Estado: Cancelado</p>
              <p style="color: #666; font-size: 14px; margin: 0;">Número de Pedido: ${params.orderCode || params.orderId.slice(0, 8)}</p>
              ${params.trackingCode ? `<p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">Código de Rastreo: ${params.trackingCode}</p>` : ''}
            </div>

            ${params.reason ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>Motivo de cancelación:</strong></p>
                <p style="color: #333; font-size: 14px; margin: 0;">${params.reason}</p>
              </div>
            ` : ''}

            <div style="background-color: #e3f2fd; padding: 20px; border-left: 4px solid #2196f3; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #1565c0;">
                <strong>¿Qué sigue?</strong><br>
                • Si realizaste un pago, procesaremos el reembolso en los próximos 5-10 días hábiles<br>
                • Puedes realizar un nuevo pedido cuando lo desees<br>
                • Si tienes preguntas, nuestro equipo de soporte está aquí para ayudarte
              </p>
            </div>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Lamentamos cualquier inconveniente que esto pueda causar. Estamos comprometidos a brindarte el mejor servicio posible.
            </p>

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                ¿Necesitas más información? Contáctanos en ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}
              </p>
            </div>
          </div>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Shipment Canceled</h1>
          </div>

          <div style="padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-bottom: 10px;">Hello ${params.userName},</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              We regret to inform you that the shipment of your order has been canceled.
            </p>

            <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
              <p style="color: #c62828; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">Status: Canceled</p>
              <p style="color: #666; font-size: 14px; margin: 0;">Order Number: ${params.orderCode || params.orderId.slice(0, 8)}</p>
              ${params.trackingCode ? `<p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">Tracking Code: ${params.trackingCode}</p>` : ''}
            </div>

            ${params.reason ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>Cancellation reason:</strong></p>
                <p style="color: #333; font-size: 14px; margin: 0;">${params.reason}</p>
              </div>
            ` : ''}

            <div style="background-color: #e3f2fd; padding: 20px; border-left: 4px solid #2196f3; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #1565c0;">
                <strong>What's next?</strong><br>
                • If you made a payment, we will process the refund within 5-10 business days<br>
                • You can place a new order whenever you'd like<br>
                • If you have questions, our support team is here to help
              </p>
            </div>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              We apologize for any inconvenience this may cause. We are committed to providing you with the best service possible.
            </p>

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                Need more information? Contact us at ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}
              </p>
            </div>
          </div>
        </div>
      `;

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject,
        html,
      });

      console.log(`Cancellation notification email sent to ${params.userEmail} for order ${params.orderId}`);
    } catch (error) {
      console.error('Error sending cancellation notification email:', error);
    }
  }

  /**
   * Send tracking update email (for status changes like in_transit, delayed, etc.)
   */
  async sendTrackingUpdateEmail(params: TrackingUpdateParams): Promise<void> {
    try {
      // Get user ID from email to check preferences
      const userId = await this.getUserIdFromEmail(params.userEmail);
      if (!userId) {
        console.log('[OrderNotificationService] User not found, skipping tracking update email');
        return;
      }

      // Check if user has order notifications enabled
      const notificationsEnabled = await this.checkOrderNotificationsEnabled(userId);
      if (!notificationsEnabled) {
        console.log('[OrderNotificationService] Order notifications disabled for user, skipping tracking update email');
        return;
      }

      const isSpanish = params.locale === 'es';
      const statusDisplay = this.getStatusDisplay(params.status, isSpanish);

      const subject = isSpanish
        ? `📦 Actualización de Envío - ${statusDisplay.label}`
        : `📦 Shipping Update - ${statusDisplay.label}`;

      const html = isSpanish ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${statusDisplay.color} 0%, ${statusDisplay.darkColor} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Actualización de Envío</h1>
          </div>

          <div style="padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-bottom: 10px;">Hola ${params.userName},</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Tu pedido tiene una actualización de estado.
            </p>

            <div style="background-color: ${statusDisplay.bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">${statusDisplay.icon}</div>
              <p style="color: ${statusDisplay.textColor}; font-weight: bold; font-size: 20px; margin: 0;">${statusDisplay.label}</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Número de Pedido:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${params.orderCode || params.orderId.slice(0, 8)}</td>
                </tr>
                ${params.trackingCode ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Código de Rastreo:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.trackingCode}</td>
                </tr>
                ` : ''}
                ${params.responsibleCompany ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Empresa de Envío:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.responsibleCompany}</td>
                </tr>
                ` : ''}
                ${params.location ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Ubicación Actual:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.location}</td>
                </tr>
                ` : ''}
                ${params.estimatedDelivery ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Entrega Estimada:</td>
                  <td style="padding: 8px 0; color: #667eea; font-weight: bold; text-align: right;">${new Date(params.estimatedDelivery).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${statusDisplay.message ? `
              <div style="background-color: #e3f2fd; padding: 20px; border-left: 4px solid #2196f3; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1565c0;">${statusDisplay.message}</p>
              </div>
            ` : ''}

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                ¿Preguntas sobre tu envío? Contáctanos en ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}
              </p>
            </div>
          </div>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${statusDisplay.color} 0%, ${statusDisplay.darkColor} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Shipping Update</h1>
          </div>

          <div style="padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-bottom: 10px;">Hello ${params.userName},</p>

            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Your order has a status update.
            </p>

            <div style="background-color: ${statusDisplay.bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">${statusDisplay.icon}</div>
              <p style="color: ${statusDisplay.textColor}; font-weight: bold; font-size: 20px; margin: 0;">${statusDisplay.label}</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Order Number:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">${params.orderCode || params.orderId.slice(0, 8)}</td>
                </tr>
                ${params.trackingCode ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Tracking Code:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.trackingCode}</td>
                </tr>
                ` : ''}
                ${params.responsibleCompany ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Shipping Company:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.responsibleCompany}</td>
                </tr>
                ` : ''}
                ${params.location ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Current Location:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">${params.location}</td>
                </tr>
                ` : ''}
                ${params.estimatedDelivery ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Estimated Delivery:</td>
                  <td style="padding: 8px 0; color: #667eea; font-weight: bold; text-align: right;">${new Date(params.estimatedDelivery).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${statusDisplay.message ? `
              <div style="background-color: #e3f2fd; padding: 20px; border-left: 4px solid #2196f3; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1565c0;">${statusDisplay.message}</p>
              </div>
            ` : ''}

            <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #777; text-align: center;">
                Questions about your shipment? Contact us at ${process.env.CONTACT_REPLY_TO_EMAIL || 'support@purvita.com'}
              </p>
            </div>
          </div>
        </div>
      `;

      const fromName = process.env.CONTACT_FROM_NAME || 'PūrVita';
      const fromEmail = process.env.CONTACT_FROM_EMAIL || 'noreply@purvita.com';
      const fromAddress = `${fromName} <${fromEmail}>`;

      await sendEmail({
        from: fromAddress,
        to: params.userEmail,
        subject,
        html,
      });

      console.log(`Tracking update email sent to ${params.userEmail} for order ${params.orderId} - status: ${params.status}`);
    } catch (error) {
      console.error('Error sending tracking update email:', error);
    }
  }

  /**
   * Helper: Get user ID from email
   */
  private async getUserIdFromEmail(email: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user ID from email:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error in getUserIdFromEmail:', error);
      return null;
    }
  }

  /**
   * Helper: Get user email and name from profiles table
   */
  async getUserInfo(userId: string): Promise<{ email: string; name: string; userId: string } | null> {
    try {
      const { data, error} = await this.supabaseClient
        .from('profiles')
        .select('email, name, id')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user info:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        email: data.email,
        name: data.name,
        userId: data.id,
      };
    } catch (error) {
      console.error('Error in getUserInfo:', error);
      return null;
    }
  }

  /**
   * Helper: Format currency
   */
  private formatCurrency(cents: number, currency: string): string {
    const amount = cents / 100;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(amount);
  }

  /**
   * Helper: Get gateway display name
   */
  private getGatewayDisplayName(gateway: string): string {
    const names: Record<string, string> = {
      stripe: 'Stripe',
      paypal: 'PayPal',
      wallet: 'Wallet',
    };
    return names[gateway] || gateway;
  }

  /**
   * Helper: Get status display information
   */
  private getStatusDisplay(status: string, isSpanish: boolean): {
    label: string;
    icon: string;
    color: string;
    darkColor: string;
    bgColor: string;
    textColor: string;
    message?: string;
  } {
    const statusMap: Record<string, any> = {
      pending: {
        label: isSpanish ? 'Pendiente' : 'Pending',
        icon: '⏳',
        color: '#ff9800',
        darkColor: '#f57c00',
        bgColor: '#fff3e0',
        textColor: '#e65100',
        message: isSpanish
          ? 'Tu pedido está siendo preparado para el envío.'
          : 'Your order is being prepared for shipment.',
      },
      packed: {
        label: isSpanish ? 'Empaquetado' : 'Packed',
        icon: '📦',
        color: '#2196f3',
        darkColor: '#1976d2',
        bgColor: '#e3f2fd',
        textColor: '#1565c0',
        message: isSpanish
          ? 'Tu pedido ha sido empaquetado y está listo para ser enviado.'
          : 'Your order has been packed and is ready to be shipped.',
      },
      in_transit: {
        label: isSpanish ? 'En Tránsito' : 'In Transit',
        icon: '🚚',
        color: '#673ab7',
        darkColor: '#512da8',
        bgColor: '#ede7f6',
        textColor: '#4527a0',
        message: isSpanish
          ? 'Tu paquete está en camino. Pronto llegará a su destino.'
          : 'Your package is on its way. It will arrive at its destination soon.',
      },
      delayed: {
        label: isSpanish ? 'Retrasado' : 'Delayed',
        icon: '⚠️',
        color: '#ff5722',
        darkColor: '#e64a19',
        bgColor: '#fbe9e7',
        textColor: '#bf360c',
        message: isSpanish
          ? 'Tu envío ha experimentado un retraso. Estamos trabajando para resolver la situación.'
          : 'Your shipment has experienced a delay. We are working to resolve the situation.',
      },
    };

    return statusMap[status] || {
      label: status,
      icon: '📦',
      color: '#607d8b',
      darkColor: '#455a64',
      bgColor: '#eceff1',
      textColor: '#37474f',
    };
  }
}
