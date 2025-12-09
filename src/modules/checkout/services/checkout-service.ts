import {
  CheckoutProfileUpdateSchema,
  type CheckoutProfile,
  type CheckoutProfileUpdateInput,
} from '../domain/models/checkout-profile';
import { createCheckoutModule, type CheckoutModule } from '../factories/checkout-module';

let checkoutModule: CheckoutModule | null = null;

const getModule = (): CheckoutModule => {
  if (!checkoutModule) {
    checkoutModule = createCheckoutModule();
  }
  return checkoutModule;
};

export const setCheckoutModule = (module: CheckoutModule | null) => {
  checkoutModule = module;
};

export const getCheckoutEventBus = () => getModule().eventBus;

export const getCheckoutProfile = async (): Promise<CheckoutProfile | null> => {
  const { repository, eventBus } = getModule();

  try {
    const profile = await repository.getCurrentProfile();
    eventBus.emit({ type: 'profile_loaded', payload: profile });
    return profile;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to load checkout profile');
    eventBus.emit({ type: 'profile_load_failed', error: err });
    throw err;
  }
};

export const saveCheckoutProfile = async (
  input: CheckoutProfileUpdateInput,
): Promise<CheckoutProfile> => {
  const { repository, eventBus } = getModule();
  const payload = CheckoutProfileUpdateSchema.parse(input);

  eventBus.emit({ type: 'profile_save_started', payload });

  try {
    const profile = await repository.saveProfile(payload);
    eventBus.emit({ type: 'profile_saved', payload: profile });
    return profile;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to save checkout profile');
    eventBus.emit({ type: 'profile_save_failed', error: err });
    throw err;
  }
};
