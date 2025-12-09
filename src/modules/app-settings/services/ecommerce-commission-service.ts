import { getAppSettings } from './app-settings-service';

/**
 * Get the global e-commerce commission rate from app settings
 * @returns Commission rate as a decimal (0.08 = 8%)
 */
export async function getEcommerceCommissionRate(): Promise<number> {
  const settings = await getAppSettings();
  return settings.ecommerceCommissionRate;
}

/**
 * Calculate commission amount based on the global rate
 * @param amountCents - Amount in cents
 * @returns Commission amount in cents
 */
export async function calculateEcommerceCommission(amountCents: number): Promise<number> {
  const rate = await getEcommerceCommissionRate();
  return Math.round(amountCents * rate);
}
