import { PAYMENT_CONSTANTS } from '../constants/payment-constants';

export class PaymentFormatters {
  /**
   * Formats amount for display with currency symbol
   */
  static formatAmount(amount: number, currency: string = PAYMENT_CONSTANTS.CURRENCIES.DEFAULT): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Converts amount to cents for Stripe API
   */
  static toCents(amount: number): number {
    return Math.round(amount * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS);
  }

  /**
   * Converts cents to amount
   */
  static fromCents(cents: number): number {
    return cents / PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS;
  }

  /**
   * Validates amount is within acceptable range
   */
  static isValidAmount(amount: number): boolean {
    return amount >= PAYMENT_CONSTANTS.AMOUNTS.MIN_AMOUNT && 
           amount <= 999999.99 && // Max reasonable amount
           Number.isFinite(amount);
  }

  /**
   * Sanitizes amount input string
   */
  static sanitizeAmountInput(input: string): string {
    // Remove non-numeric characters except decimal point
    const cleaned = input.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return cleaned;
  }
}