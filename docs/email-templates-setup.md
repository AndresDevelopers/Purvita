# Email Templates Setup Guide

## Overview

This guide explains how to set up the email template system that allows admins to customize email notifications through the admin panel.

## Architecture

The email template system consists of:

1. **Database Table**: `email_templates` - Stores customizable templates in multiple languages
2. **Admin UI**: `/admin/email-notifications` - Interface for editing templates
3. **Template Service**: Processes templates and replaces variables
4. **Email Services**: Use templates from database instead of hardcoded HTML

## Setup Instructions

### 1. Database Setup

The `email_templates` table is already created in `docs/database/database.sql` (SECTION: Email Templates).

To populate the table with default templates, run the seed script in Supabase SQL Editor:

```sql
-- Execute the seed script
\i docs/database/email-templates-seed.sql
```

Or copy and paste the contents of `docs/database/email-templates-seed.sql` into the Supabase SQL Editor.

### 2. Verify Installation

After running the seed script, verify that templates were created:

```sql
SELECT id, name, category, is_active 
FROM public.email_templates 
ORDER BY category, name;
```

You should see 14 templates across different categories:
- **promotional**: promotional_offers
- **team**: team_member_added
- **content**: new_video_content
- **orders**: order_confirmation, order_shipped, order_delivered, order_cancelled
- **subscription**: subscription_created, subscription_renewed, subscription_cancelled, subscription_expiring
- **payment**: payment_received, payment_failed, payment_refunded

### 3. Access Admin Panel

Navigate to `/admin/email-notifications` to edit templates.

The admin panel allows you to:
- Select any template from the dropdown
- Edit subject and body in both English and Spanish
- Preview emails with sample data
- Save changes to the database

### 4. Template Variables

Each template supports specific variables that are replaced when emails are sent:

#### Order Templates
- `userName` - Customer's name
- `orderCode` - Order number
- `totalAmount` - Order total
- `trackingNumber` - Shipping tracking number
- `carrier` - Shipping carrier name
- `estimatedDelivery` - Estimated delivery date
- `deliveryDate` - Actual delivery date
- `cancellationReason` - Reason for cancellation

#### Team Templates
- `sponsorName` - Sponsor's name
- `newMemberName` - New team member's name
- `newMemberEmail` - New team member's email

#### Content Templates
- `videoTitle` - Video title
- `videoDescription` - Video description
- `videoUrl` - Link to video

#### Subscription Templates
- `userName` - User's name
- `appName` - Application name
- `planName` - Subscription plan name
- `amount` - Subscription amount
- `nextBillingDate` - Next billing date
- `expirationDate` - Subscription expiration date
- `cancellationReason` - Cancellation reason

#### Payment Templates
- `userName` - User's name
- `amount` - Payment amount
- `transactionId` - Transaction ID
- `paymentDate` - Payment date
- `refundDate` - Refund date
- `reason` - Failure reason

## How It Works

### 1. Template Storage

Templates are stored in the `email_templates` table with:
- Separate fields for English (`subject_en`, `body_en`) and Spanish (`subject_es`, `body_es`)
- Variables marked with `{{variableName}}` syntax
- Category for organization
- Active/inactive status

### 2. Template Processing

When an email is sent:

1. **Retrieve Template**: Service fetches template from database by ID
2. **Select Language**: Chooses English or Spanish based on user locale
3. **Replace Variables**: Replaces `{{variableName}}` with actual values
4. **Generate HTML**: Wraps processed body in full HTML email layout
5. **Send Email**: Sends email with processed subject and HTML

### 3. Fallback Mechanism

If a template is not found in the database, services fall back to hardcoded HTML to ensure emails are always sent.

## Code Structure

```
src/modules/email-templates/
├── domain/
│   ├── models/email-template.ts          # Types and constants
│   └── contracts/email-template-repository.ts
├── data/
│   └── repositories/supabase-email-template-repository.ts
├── services/
│   └── email-template-service.ts         # Template processing logic
├── factories/
│   └── email-template-factory.ts
└── index.ts                              # Public exports
```

## Usage Example

```typescript
import { createEmailTemplateService, EMAIL_TEMPLATE_IDS } from '@/modules/email-templates';

const templateService = createEmailTemplateService();

// Get processed template
const template = await templateService.getProcessedTemplate(
  EMAIL_TEMPLATE_IDS.ORDER_CONFIRMATION,
  {
    userName: 'John Doe',
    orderCode: 'ORD-2024-001',
    totalAmount: '$149.99',
    paymentMethod: 'Credit Card',
  },
  'en' // or 'es' for Spanish
);

if (template) {
  await sendEmail({
    to: 'user@example.com',
    subject: template.subject,
    html: template.html,
  });
}
```

## Customization

### Adding New Templates

1. Add template ID to `EMAIL_TEMPLATE_IDS` in `src/modules/email-templates/domain/models/email-template.ts`
2. Insert template into database using SQL or admin UI
3. Use template in your service with `templateService.getProcessedTemplate()`

### Modifying Existing Templates

Use the admin panel at `/admin/email-notifications` to edit:
- Subject lines (English and Spanish)
- Email body HTML (English and Spanish)
- Variables are automatically detected from `{{variableName}}` syntax

## Testing

To test the email template system:

1. **Edit Template**: Go to `/admin/email-notifications` and modify a template
2. **Trigger Email**: Perform an action that sends that email (e.g., place an order)
3. **Verify Email**: Check that the email uses your customized template

## Troubleshooting

### Templates Not Loading

Check that:
- Seed script was executed successfully
- Templates exist in database: `SELECT * FROM email_templates;`
- Templates are active: `is_active = true`

### Variables Not Replaced

Ensure:
- Variable names match exactly (case-sensitive)
- Variables use correct syntax: `{{variableName}}`
- Service passes all required variables

### Emails Using Fallback HTML

This means:
- Template not found in database (check template ID)
- Template is inactive (`is_active = false`)
- Database connection issue

Check server logs for error messages starting with `[OrderNotificationService]` or `[NotificationEmailService]`.

## Migration from Hardcoded HTML

The system now uses database templates instead of hardcoded HTML. The migration is complete for:

✅ **NotificationEmailService**
- Team member added notifications
- New video content notifications

✅ **OrderNotificationService**
- Payment confirmation emails
- Delivery confirmation emails

All services include fallback mechanisms to ensure emails are sent even if templates are missing.

## Next Steps

1. Run the seed script to populate templates
2. Customize templates in the admin panel
3. Test email sending to verify templates are used
4. Monitor logs for any template-related errors

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify database connection and table structure
- Ensure environment variables are set correctly (RESEND_API_KEY, etc.)

