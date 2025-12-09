import type { SiteBranding } from '@/modules/site-content/domain/models/site-branding';

export interface InvoiceTemplateParams {
  order: any;
  items: any[];
  profile: any;
  branding: SiteBranding;
  currency: string;
  emptyItemsDescription?: string;
}

export const escapeHtml = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const resolveStatusClass = (status: string | null | undefined) => {
  switch ((status ?? '').toLowerCase()) {
    case 'paid':
    case 'succeeded':
    case 'completed':
      return 'status-paid';
    case 'canceled':
    case 'cancelled':
    case 'failed':
      return 'status-canceled';
    default:
      return 'status-pending';
  }
};

export const formatStatusLabel = (status: string | null | undefined) => {
  if (!status) {
    return 'Pending';
  }

  return status
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function generateInvoiceHTML({
  order,
  items,
  profile,
  branding,
  currency,
  emptyItemsDescription = 'This invoice corresponds to a subscription payment.',
}: InvoiceTemplateParams) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format((Number(cents) || 0) / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum: number, item: any) => {
    const quantityValue = Number(item.qty ?? item.quantity ?? 1);
    const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
    const price = Number(item.price_cents) || 0;
    return sum + price * quantity;
  }, 0);

  const tax = Number(order.tax_cents) || 0;
  const shipping = Number(order.shipping_cents) || 0;
  const discount = Number(order.discount_cents) || 0;

  const rawAppName = branding.showAppName === false ? '' : branding.appName;
  const appName = escapeHtml(rawAppName);
  const appDescription = branding.description ? escapeHtml(branding.description) : '';
  const logoUrl = branding.showLogo === false || !branding.logoUrl ? '' : escapeHtml(branding.logoUrl);
  const statusClass = resolveStatusClass(order.status);
  const statusLabel = formatStatusLabel(order.status);
  const invoiceNumber = order?.id ? escapeHtml(order.id.toString().substring(0, 8).toUpperCase()) : 'N/A';

  const profileName = escapeHtml(profile?.name) || 'Customer';
  const profileEmail = escapeHtml(profile?.email);
  const profilePhone = escapeHtml(profile?.phone);
  const profileAddress = escapeHtml(profile?.address);

  const locationSegments = [profile?.city, profile?.state, profile?.postal_code]
    .map((segment) => {
      const value = segment === null || segment === undefined ? '' : String(segment).trim();
      return value.length > 0 ? value : null;
    })
    .filter((segment): segment is string => Boolean(segment));

  const profileLocation = escapeHtml(locationSegments.join(', '));
  const profileCountry = escapeHtml(profile?.country);
  const paymentGateway = order?.gateway ? escapeHtml(order.gateway.toUpperCase()) : 'N/A';
  const transactionId = order?.gateway_transaction_id ? escapeHtml(order.gateway_transaction_id) : '';

  const _safeAppName = appName || 'Our team';
  const supportLabel = appName ? `${appName} support` : 'our support team';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1f2933; background-color: #f8fafc; }
    .invoice-container { max-width: 880px; margin: 0 auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08); overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.2); }
    .header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24px; padding: 36px; border-bottom: 1px solid rgba(148, 163, 184, 0.25); background: linear-gradient(135deg, rgba(59, 130, 246, 0.07), rgba(14, 116, 144, 0.05)); }
    .company-info { display: flex; gap: 18px; align-items: center; flex: 1 1 280px; }
    .logo-container { width: 72px; height: 72px; border-radius: 18px; background: rgba(255, 255, 255, 0.85); display: grid; place-items: center; padding: 10px; border: 1px solid rgba(148, 163, 184, 0.3); }
    .logo-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .company-details h1 { font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
    .company-details p { margin-top: 6px; font-size: 14px; color: #475569; max-width: 360px; line-height: 1.5; }
    .invoice-info { text-align: right; min-width: 220px; }
    .invoice-info h2 { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: 0.12em; margin-bottom: 12px; text-transform: uppercase; }
    .invoice-info p { margin: 6px 0; font-size: 14px; color: #334155; }
    .addresses { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24px; padding: 32px 36px; background: #f8fafc; }
    .address-block { flex: 1 1 260px; border-radius: 16px; padding: 20px; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.25); }
    .address-block h3 { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; color: #64748b; margin-bottom: 12px; text-transform: uppercase; }
    .address-block p { margin: 6px 0; font-size: 14px; color: #1f2937; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 0 36px; border-radius: 18px; overflow: hidden; }
    thead { background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(79, 70, 229, 0.12)); color: #0f172a; }
    th { text-align: left; padding: 16px 18px; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
    tbody tr { background: #ffffff; transition: background 0.2s ease; }
    tbody tr:nth-child(even) { background: rgba(15, 23, 42, 0.02); }
    tbody tr:hover { background: rgba(59, 130, 246, 0.07); }
    td { padding: 18px; font-size: 14px; color: #1f2933; border-bottom: 1px solid rgba(148, 163, 184, 0.2); vertical-align: top; }
    .text-right { text-align: right; }
    .totals { margin: 30px 36px 0 auto; width: min(320px, 100%); border-radius: 18px; background: #0f172a; color: #ffffff; padding: 24px; box-shadow: 0 20px 35px rgba(15, 23, 42, 0.2); }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; }
    .totals-row span:first-child { color: rgba(226, 232, 240, 0.85); }
    .totals-row.total { font-size: 20px; font-weight: 700; padding-top: 16px; margin-top: 10px; border-top: 1px solid rgba(226, 232, 240, 0.35); }
    .footer { margin: 40px 36px 32px; padding: 28px; border-radius: 18px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 165, 233, 0.12)); text-align: center; font-size: 13px; color: #0f172a; line-height: 1.6; }
    .footer strong { display: block; font-size: 14px; margin-bottom: 6px; letter-spacing: 0.08em; text-transform: uppercase; }
    .status-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 110px; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
    .status-paid { background-color: rgba(34, 197, 94, 0.15); color: #15803d; }
    .status-pending { background-color: rgba(250, 204, 21, 0.15); color: #a16207; }
    .status-canceled { background-color: rgba(239, 68, 68, 0.15); color: #b91c1c; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-container { box-shadow: none; border: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        ${logoUrl ? `<div class="logo-container"><img src="${logoUrl}" alt="${appName || 'Company'} logo" /></div>` : ''}
        <div class="company-details">
          ${appName ? `<h1>${appName}</h1>` : ''}
          ${appDescription ? `<p>${appDescription}</p>` : ''}
        </div>
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
        <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
        <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusLabel}</span></p>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Bill To</h3>
        <p><strong>${profileName}</strong></p>
        ${profileEmail ? `<p>${profileEmail}</p>` : ''}
        ${profilePhone ? `<p>${profilePhone}</p>` : ''}
        ${profileAddress ? `<p>${profileAddress}</p>` : ''}
        ${profileLocation ? `<p>${profileLocation}</p>` : ''}
        ${profileCountry ? `<p>${profileCountry}</p>` : ''}
      </div>
      <div class="address-block">
        <h3>Payment Method</h3>
        <p>${paymentGateway}</p>
        ${transactionId ? `<p>Transaction: ${transactionId}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          safeItems.length > 0
            ? safeItems
                .map((item: any) => {
                  const quantityValue = Number(item.qty ?? item.quantity ?? 1);
                  const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
                  const price = Number(item.price_cents) || 0;
                  const productName = escapeHtml(item.products?.name || item.product_id || 'Product');
                  const productDescription = item.products?.description ? escapeHtml(item.products.description) : '';
                  return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${productName}</div>
            ${productDescription ? `<div style="margin-top: 6px; font-size: 12px; color: #64748b;">${productDescription}</div>` : ''}
          </td>
          <td class="text-right">${quantity}</td>
          <td class="text-right">${formatCurrency(price)}</td>
          <td class="text-right">${formatCurrency(price * quantity)}</td>
        </tr>
        `;
                })
                .join('')
            : `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; font-size: 14px; color: #475569;">
            ${escapeHtml(emptyItemsDescription)}
          </td>
        </tr>
        `
        }
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(subtotal || order.total_cents)}</span>
      </div>
      ${
        discount > 0
          ? `
      <div class="totals-row">
        <span>Discount</span>
        <span>- ${formatCurrency(discount)}</span>
      </div>
      `
          : ''
      }
      ${
        tax > 0
          ? `
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(tax)}</span>
      </div>
      `
          : ''
      }
      ${
        shipping > 0
          ? `
      <div class="totals-row">
        <span>Shipping</span>
        <span>${formatCurrency(shipping)}</span>
      </div>
      `
          : ''
      }
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCurrency(order.total_cents)}</span>
      </div>
    </div>

    <div class="footer">
      <strong>THANK YOU!</strong>
      <p>We appreciate your trust${appName ? ` in ${appName}` : ''}. If you have any questions about this invoice, please contact ${supportLabel}.</p>
    </div>
  </div>
</body>
</html>
  `;
}
