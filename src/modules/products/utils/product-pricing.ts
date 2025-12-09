import type { Product } from '@/lib/models/definitions';

export type ProductDiscountInfo = {
  type: 'amount' | 'percentage';
  value: number;
  amount: number;
  label: string | null;
  percentageOff: number | null;
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const resolveDiscountValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  return null;
};

export const getProductDiscountInfo = (product: Product): ProductDiscountInfo | null => {
  const type = product.discount_type ?? null;
  if (type !== 'amount' && type !== 'percentage') {
    return null;
  }

  const rawValue = resolveDiscountValue(product.discount_value);
  if (rawValue === null) {
    return null;
  }

  const label = typeof product.discount_label === 'string' ? product.discount_label : null;
  const unitPrice = Number.isFinite(product.price) ? product.price : 0;

  if (type === 'amount') {
    const amount = clampNumber(rawValue, 0, Math.max(unitPrice, 0));
    if (amount <= 0) {
      return null;
    }
    const percentageOff = unitPrice > 0 ? clampNumber((amount / unitPrice) * 100, 0, 100) : null;
    return {
      type,
      value: amount,
      amount,
      label,
      percentageOff,
    };
  }

  // Percentage
  const percentage = clampNumber(rawValue, 0, 100);
  if (percentage <= 0) {
    return null;
  }
  const amount = unitPrice > 0 ? clampNumber((unitPrice * percentage) / 100, 0, unitPrice) : 0;
  return {
    type,
    value: percentage,
    amount,
    label,
    percentageOff: percentage,
  };
};

export const getDiscountedUnitPrice = (
  product: Product,
  phaseDiscountRate?: number
): {
  unitPrice: number;
  discountAmount: number;
  finalUnitPrice: number;
  discount: ProductDiscountInfo | null;
  phaseDiscountAmount: number;
  totalDiscountAmount: number;
} => {
  const unitPrice = Number.isFinite(product.price) ? product.price : 0;
  const discount = getProductDiscountInfo(product);
  const productDiscountAmount = discount ? clampNumber(discount.amount, 0, unitPrice) : 0;

  // Calculate phase discount (applies after product discount)
  const priceAfterProductDiscount = unitPrice - productDiscountAmount;
  const phaseDiscountAmount = phaseDiscountRate && phaseDiscountRate > 0
    ? clampNumber(priceAfterProductDiscount * phaseDiscountRate, 0, priceAfterProductDiscount)
    : 0;

  const totalDiscountAmount = productDiscountAmount + phaseDiscountAmount;
  const finalUnitPrice = clampNumber(unitPrice - totalDiscountAmount, 0, Number.MAX_SAFE_INTEGER);

  return {
    unitPrice,
    discountAmount: productDiscountAmount,
    finalUnitPrice,
    discount,
    phaseDiscountAmount,
    totalDiscountAmount,
  };
};
