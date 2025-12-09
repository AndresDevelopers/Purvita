import { TEST_AMOUNTS } from '../constants/test-constants';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class PaymentValidation {
  static validateAmount(amount: string): ValidationResult {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      return { isValid: false, error: 'Please enter a valid number' };
    }
    
    if (numAmount < TEST_AMOUNTS.MIN_ALLOWED) {
      return { isValid: false, error: `Minimum amount is $${TEST_AMOUNTS.MIN_ALLOWED}` };
    }

    if (numAmount > TEST_AMOUNTS.MAX_ALLOWED) {
      return { isValid: false, error: `Maximum amount is $${TEST_AMOUNTS.MAX_ALLOWED}` };
    }
    
    return { isValid: true };
  }

  static validateDescription(description: string): ValidationResult {
    const trimmed = description.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Description is required' };
    }
    
    if (trimmed.length < 3) {
      return { isValid: false, error: 'Description must be at least 3 characters' };
    }
    
    if (trimmed.length > 255) {
      return { isValid: false, error: 'Description must be less than 255 characters' };
    }
    
    return { isValid: true };
  }

  static validateCurrency(currency: string): ValidationResult {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    
    if (!validCurrencies.includes(currency.toUpperCase())) {
      return { isValid: false, error: 'Unsupported currency' };
    }
    
    return { isValid: true };
  }

  static validatePaymentForm(amount: string, description: string, currency: string): ValidationResult {
    const amountValidation = this.validateAmount(amount);
    if (!amountValidation.isValid) return amountValidation;
    
    const descriptionValidation = this.validateDescription(description);
    if (!descriptionValidation.isValid) return descriptionValidation;
    
    const currencyValidation = this.validateCurrency(currency);
    if (!currencyValidation.isValid) return currencyValidation;
    
    return { isValid: true };
  }
}