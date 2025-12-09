# Payment Gateway Setup Guide

## Problem: "Payment failed: {}" Error

If you're seeing an empty error `[PaymentService] Payment failed: {}` when trying to make a payment, it means your payment gateways are not properly configured.

## Root Causes

1. **Payment gateways are not activated in the database** (most common)
2. **Payment credentials are missing in environment variables**
3. **Payment credentials are incorrect**

## Quick Fix

### Step 1: Configure Payment Credentials

Edit your `.env.local` file and add your payment provider credentials:

#### For Stripe (Test Mode)
```bash
# Stripe Test Credentials
# IMPORTANTE: La clave pública DEBE tener el prefijo NEXT_PUBLIC_
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
```

#### For Stripe (Production Mode)
```bash
# Stripe Production Credentials
# IMPORTANTE: La clave pública DEBE tener el prefijo NEXT_PUBLIC_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### For PayPal (Test Mode)
```bash
# PayPal Sandbox Credentials
PAYPAL_TEST_CLIENT_ID=...
PAYPAL_TEST_CLIENT_SECRET=...
PAYPAL_TEST_WEBHOOK_SECRET=...
```

#### For PayPal (Production Mode)
```bash
# PayPal Live Credentials
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_SECRET=...
PAYPAL_WEBHOOK_ID=...
```

### Step 2: Activate Payment Gateways

Run the activation script:

```bash
npx tsx scripts/activate-payment-gateways.ts
```

This script will:
- Check which credentials are configured
- Activate the corresponding payment gateways in the database
- Set the appropriate mode (test or production)

### Step 3: Restart Your Development Server

```bash
npm run dev
```

## Manual Activation (Alternative)

If you prefer to activate gateways manually, you can do it through the admin panel:

1. Go to `/admin/payments`
2. Enable the payment providers you want to use
3. Set the mode (test or production)
4. Save changes

Or use SQL directly:

```sql
-- Activate Stripe in test mode
UPDATE payment_gateways 
SET is_active = true, mode = 'test', status = 'active'
WHERE provider = 'stripe';

-- Activate PayPal in test mode
UPDATE payment_gateways 
SET is_active = true, mode = 'test', status = 'active'
WHERE provider = 'paypal';
```

## Getting Payment Credentials

### Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Click on "Developers" → "API keys"
3. Copy your publishable and secret keys
4. For webhooks: Go to "Developers" → "Webhooks" → "Add endpoint"

### PayPal

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Go to "Apps & Credentials"
3. Create a new app or use an existing one
4. Copy your Client ID and Secret
5. For webhooks: Go to "Webhooks" → "Add Webhook"

## Testing

### Test Stripe Payments

Use these test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)

### Test PayPal Payments

1. Use PayPal sandbox accounts
2. Create test accounts in the PayPal Developer Dashboard
3. Use sandbox credentials in your `.env.local`

## Troubleshooting

### Error: "PayPal is not configured"
- Check that `PAYPAL_TEST_CLIENT_ID` and `PAYPAL_TEST_CLIENT_SECRET` are set
- Run the activation script
- Verify the gateway is active in the database

### Error: "Stripe is not configured"
- Check that `STRIPE_TEST_PUBLISHABLE_KEY` and `STRIPE_TEST_SECRET_KEY` are set
- Run the activation script
- Verify the gateway is active in the database

### Error: "Payment service temporarily unavailable"
- The gateway is not active in the database
- Run the activation script or activate manually

### Still Having Issues?

1. Check the browser console for detailed error messages
2. Check the server logs for API errors
3. Verify your credentials are correct
4. Make sure you're using the right mode (test vs production)
5. Check that the `payment_gateways` table exists in your database

## Production Checklist

Before going live:

- [ ] Replace test credentials with production credentials
- [ ] Update gateway mode to 'production' in the database
- [ ] Test a real payment with a small amount
- [ ] Set up webhook endpoints
- [ ] Configure webhook secrets
- [ ] Enable proper error monitoring (Sentry)
- [ ] Review security settings
- [ ] Test refund flows
- [ ] Document your payment flow

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [Project Payment System Documentation](./payment-system.md)
