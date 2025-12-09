import type { CheckoutProfile, CheckoutProfileUpdateInput } from '../models/checkout-profile';

export interface CheckoutRepository {
  getCurrentProfile(): Promise<CheckoutProfile | null>;
  saveProfile(input: CheckoutProfileUpdateInput): Promise<CheckoutProfile>;
}
