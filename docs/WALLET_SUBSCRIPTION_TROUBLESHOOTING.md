# Wallet Subscription Payment Troubleshooting

## Problem: Cannot Pay Subscription with Wallet Balance

If you're unable to pay for your subscription using your wallet balance, follow these troubleshooting steps.

---

## Quick Diagnostic Steps

### 1. Check Your Wallet Balance

1. Go to your **Profile** page
2. Look for your **Wallet Balance** section
3. Verify the amount shown

### 2. Check Subscription Price

1. Go to the **Subscription** page
2. Note the price of the plan you want to purchase
3. Compare it with your wallet balance

### 3. Common Issues

#### Issue A: Insufficient Balance
**Symptom**: Error message says "Your balance is not enough to activate the subscription"

**Solution**:
1. Go to your Profile page
2. Click on "Recharge Balance"
3. Select PayPal or Stripe as payment method
4. Add the required amount
5. Complete the payment
6. Wait for the balance to update (usually instant)
7. Try subscribing again

#### Issue B: Balance Not Updating
**Symptom**: You recharged but the balance doesn't show the new amount

**Solution**:
1. Refresh the page (F5 or Ctrl+R)
2. Log out and log back in
3. Clear your browser cache
4. Check your wallet transaction history to verify the recharge was processed

#### Issue C: Payment Provider Not Available
**Symptom**: Wallet option doesn't appear in payment methods

**Solution**:
1. Make sure you're logged in
2. Refresh the page
3. Contact support if the issue persists

---

## For Developers: Diagnostic Script

If you have access to the server, you can run the diagnostic script to check a user's wallet status:

```bash
npx tsx scripts/diagnose-wallet-subscription.ts <user-id>
```

This will show:
- Current wallet balance
- Recent transactions
- Available subscription plans
- Whether the user can afford each plan
- Recommendations

---

## Understanding Wallet Payments

### How Wallet Payments Work

1. **Balance Check**: System verifies you have sufficient balance
2. **Deduction**: Amount is deducted from your wallet
3. **Subscription Activation**: Your subscription is activated immediately
4. **No Refunds**: Wallet payments are instant and non-refundable

### Wallet Balance vs Subscription Price

- Wallet balance is stored in **cents** (e.g., $65.00 = 6500 cents)
- Subscription prices are also calculated in **cents**
- The system compares these values to determine if you can afford the subscription

### Example Calculation

```
Your Wallet Balance: $50.00 (5000 cents)
Subscription Price:  $65.00 (6500 cents)
Result: ❌ Insufficient balance
Needed: $15.00 more
```

---

## Recent Improvements

### Version 2024-01-XX

We've made the following improvements to help diagnose wallet payment issues:

1. **Auto-refresh Balance**: When you open the payment dialog, the system now automatically refreshes your wallet balance to ensure it's up-to-date

2. **Better Error Messages**: Error messages now show:
   - Your current balance
   - The required amount
   - How much more you need to add

3. **Enhanced Logging**: The system now logs detailed information about wallet validation for easier troubleshooting

4. **Diagnostic Script**: New script to check wallet status and subscription eligibility

---

## Frequently Asked Questions

### Q: Why does my balance show $0 even though I recharged?

**A**: This could be due to:
- The payment is still processing (check your email for confirmation)
- The webhook from the payment provider hasn't been received yet
- Browser cache showing old data (try refreshing)

### Q: Can I use wallet balance for partial payment?

**A**: No, currently wallet payments must cover the full subscription amount. You cannot combine wallet balance with another payment method.

### Q: What happens if I don't have enough balance?

**A**: The system will:
1. Show an error message with your current balance and required amount
2. Prevent the payment from being processed
3. Suggest recharging your wallet

### Q: How long does it take for a wallet recharge to appear?

**A**: Wallet recharges are usually instant once the payment provider confirms the payment. This typically takes:
- **PayPal**: 1-5 seconds
- **Stripe**: 1-5 seconds

If it takes longer than 1 minute, check your email for payment confirmation or contact support.

### Q: Can I get a refund if I accidentally paid with wallet?

**A**: Wallet payments are instant and non-refundable. However, you can:
- Cancel your subscription to prevent future charges
- Contact support for special cases

---

## Contact Support

If you've tried all the troubleshooting steps and still can't pay with your wallet balance:

1. Note your User ID (found in your profile)
2. Take a screenshot of the error message
3. Note your current wallet balance
4. Contact support with this information

---

## Technical Details (For Developers)

### Validation Flow

1. **Frontend Validation** (`subscription-content.tsx`):
   ```typescript
   const walletInsufficient = 
     walletMetadata.walletBalanceCents < planPriceCents;
   ```

2. **Backend Validation** (`wallet-service.ts`):
   ```typescript
   if (currentBalance < amountCents) {
     throw new Error('Insufficient wallet balance');
   }
   ```

### Key Files

- Frontend: `src/app/[lang]/subscription/subscription-content.tsx`
- Backend API: `src/app/api/subscription/checkout/route.ts`
- Wallet Service: `src/modules/multilevel/services/wallet-service.ts`
- Wallet Repository: `src/modules/multilevel/repositories/wallet-repository.ts`
- Diagnostic Script: `scripts/diagnose-wallet-subscription.ts`

### Database Tables

- `wallets`: Stores user wallet balances
- `wallet_txns`: Stores all wallet transactions
- `subscriptions`: Stores subscription status
- `plans`: Stores available subscription plans

---

## Changelog

### 2024-01-XX
- ✅ Added auto-refresh of wallet balance when opening payment dialog
- ✅ Improved error messages with specific amounts
- ✅ Added detailed logging for wallet validation
- ✅ Created diagnostic script for troubleshooting
- ✅ Enhanced backend error messages with balance details

---

**Last Updated**: 2024-01-XX

