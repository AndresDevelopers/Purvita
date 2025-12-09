'use client';

import { use, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import AuthGuard from '@/components/auth-guard';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import { useCart } from '@/contexts/cart-context';
import { useReferralTracking } from '@/contexts/referral-tracking-context';
import { useCheckoutProfile } from '@/modules/checkout/hooks/use-checkout-profile';
import type { CheckoutPaymentProvider } from '@/modules/checkout/domain/models/checkout-profile';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { PaymentService } from '@/modules/payments/services/payment-service';
import { PaymentFlowService } from '@/modules/payments/services/payment-flow-service';
import { cn } from '@/lib/utils';
import { getWalletMetadata } from '@/modules/payments/utils/payment-provider-metadata';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';

const PAYMENT_PROVIDER_ICONS: Record<string, string> = {
  paypal: '🅿️',
  stripe: '💳',
  wallet: '👛',
  manual: '📝',
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  stripe: 'Stripe',
  wallet: 'Wallet Balance',
  manual: 'Manual Payment',
};

const LOCAL_STORAGE_KEY = 'checkout.preferredProvider';

type FormField = 'fullName' | 'addressLine1' | 'city' | 'state' | 'postalCode' | 'country' | 'phone';

const INITIAL_FORM_ERRORS: Record<FormField, boolean> = {
  fullName: false,
  addressLine1: false,
  city: false,
  state: false,
  postalCode: false,
  country: false,
  phone: false,
};

const toPaymentProvider = (value: string | null | undefined): CheckoutPaymentProvider | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'paypal' || normalized === 'stripe' || normalized === 'wallet'
    ? (normalized as CheckoutPaymentProvider)
    : null;
};

export default function CheckoutPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = getDictionary(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerParam = toPaymentProvider(searchParams?.get('provider'));

  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseUser();
  const { providers: allProviders, isLoading: providersLoading, error: providersError } = usePaymentProviders();

  // Filtrar proveedores que tienen funcionalidad de pago (payment o both) y están disponibles en tienda principal
  const providers = allProviders.filter((provider) => {
    const supportsPayment = provider.functionality === 'payment' || provider.functionality === 'both';
    const availableOnMainStore = provider.availableOnMainStore !== false;
    return supportsPayment && availableOnMainStore;
  });

  const {
    items,
    getTotal,
    getSubtotal,
    getProductDiscount,
    getRewardDiscount,
    getDiscount,
    phaseReward,
    phaseGroupGain,
    setPhaseGroupGain,
    clearCart,
  } = useCart();
  const { referralCode, affiliateId } = useReferralTracking();
  const {
    profile,
    isLoading: profileLoading,
    isSaving: profileSaving,
    error: profileError,
    save: persistProfile,
  } = useCheckoutProfile();
  const {
    country: userCountryCode,
    isLoading: countryLoading,
  } = useCurrentUserCountry({
    userId: user?.id ?? null,
    isAuthenticated,
    isAuthLoading: authLoading,
    autoDetect: true,
  });

  const [selectedProvider, setSelectedProvider] = useState<CheckoutPaymentProvider | null>(null);
  const [formValues, setFormValues] = useState<Record<FormField, string>>({
    fullName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<FormField, boolean>>(INITIAL_FORM_ERRORS);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Separate state for country display (editable by user but not saved)
  const [countryDisplayValue, setCountryDisplayValue] = useState<string>('');

  // Convert country code to full country name
  const regionDisplay = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [lang]);

  useEffect(() => {
    const getUserId = async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  // Update country display value when user country is detected
  useEffect(() => {
    if (userCountryCode) {
      const displayName = regionDisplay.of(userCountryCode) ?? userCountryCode;
      setCountryDisplayValue(displayName);
    }
  }, [userCountryCode, regionDisplay]);

  // Function to fill form with user's profile data
  const handleFillWithProfileData = () => {
    if (!profile) {
      return;
    }

    setFormValues({
      fullName: profile.fullName,
      addressLine1: profile.addressLine1,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      country: profile.country,
      phone: profile.phone,
    });

    // Set the display value for country if profile has a country code
    if (profile.country) {
      const displayName = regionDisplay.of(profile.country) ?? profile.country;
      setCountryDisplayValue(displayName);
    }
  };

  useEffect(() => {
    if (providersLoading || providers.length === 0) {
      return;
    }

    setSelectedProvider((current) => {
      if (current && providers.some((provider) => provider.provider === current)) {
        return current;
      }

      if (providerParam && providers.some((provider) => provider.provider === providerParam)) {
        return providerParam;
      }

      if (profile?.paymentProvider && providers.some((provider) => provider.provider === profile.paymentProvider)) {
        return profile.paymentProvider as CheckoutPaymentProvider;
      }

      if (typeof window !== 'undefined') {
        const stored = toPaymentProvider(window.localStorage.getItem(LOCAL_STORAGE_KEY));
        if (stored && providers.some((provider) => provider.provider === stored)) {
          return stored;
        }
      }

      return (providers[0]?.provider as CheckoutPaymentProvider | undefined) ?? null;
    });
  }, [providersLoading, providers, providerParam, profile?.paymentProvider]);

  useEffect(() => {
    if (!selectedProvider || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LOCAL_STORAGE_KEY, selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    if (!selectedProvider || providers.length === 0) {
      return;
    }

    if (providers.every((provider) => provider.provider !== selectedProvider)) {
      setSelectedProvider((providers[0]?.provider as CheckoutPaymentProvider | undefined) ?? null);
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    if (!user?.id) {
      setPhaseGroupGain(null);
      return;
    }

    if (phaseGroupGain) {
      return;
    }

    let ignore = false;

    const fetchGroupGain = async () => {
      try {
        const response = await fetch('/api/products/user-discount', {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!ignore) {
            setPhaseGroupGain(null);
          }
          return;
        }

        const data = await response.json();
        if (ignore) {
          return;
        }

        if (data?.gainPercentage > 0) {
          setPhaseGroupGain({
            userPhase: data.userPhase,
            gainRate: data.gainRate,
            gainPercentage: data.gainPercentage,
          });
        } else {
          setPhaseGroupGain(null);
        }
      } catch (error) {
        if (!ignore) {
          console.error('[Checkout] Failed to load group gain info:', error);
          setPhaseGroupGain(null);
        }
      }
    };

    fetchGroupGain();

    return () => {
      ignore = true;
    };
  }, [user?.id, phaseGroupGain, setPhaseGroupGain]);

  const _providerLabels = useMemo(
    () => ({
      paypal: dict.checkout.paypal,
      stripe: dict.checkout.stripe,
      wallet: dict.checkout.wallet,
    }),
    [dict.checkout.paypal, dict.checkout.stripe, dict.checkout.wallet],
  );

  const subtotal = getSubtotal();
  const productDiscount = getProductDiscount();
  const rewardDiscount = getRewardDiscount();
  const totalDiscount = getDiscount();
  const total = getTotal();
  const subtotalAfterProductDiscount = Math.max(0, subtotal - productDiscount);
  const groupGainAmount =
    phaseGroupGain && phaseGroupGain.gainRate > 0 ? subtotalAfterProductDiscount * phaseGroupGain.gainRate : 0;
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
      }),
    [lang],
  );
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const totalCents = Math.round(total * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS);
  const hasPositiveTotal = total > 0;
  const hasCartItems = items.length > 0;
  const hasProviders = providers.length > 0;
  const selectedProviderInfo = selectedProvider
    ? providers.find((provider) => provider.provider === selectedProvider)
    : null;
  const walletMetadata = selectedProviderInfo ? getWalletMetadata(selectedProviderInfo) : null;
  const walletBalanceLabel = walletMetadata
    ? new Intl.NumberFormat(lang, {
      style: 'currency',
      currency: walletMetadata.walletCurrency,
    }).format(walletMetadata.walletBalanceCents / 100)
    : null;
  const walletBalanceCents = walletMetadata?.walletBalanceCents;
  const walletInsufficient =
    selectedProvider === 'wallet' &&
    typeof walletBalanceCents === 'number' &&
    hasPositiveTotal &&
    walletBalanceCents < totalCents;

  const requiredFields: FormField[] = ['fullName', 'addressLine1', 'city', 'postalCode', 'country'];

  const handleInputChange = (field: FormField) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
    setFieldErrors((previous) => ({
      ...previous,
      [field]: false,
    }));
    setSubmissionError(null);
  };

  const validateForm = () => {
    const nextErrors: Record<FormField, boolean> = { ...INITIAL_FORM_ERRORS };

    requiredFields.forEach((field) => {
      // For country field, validate using the detected country code (not the display value)
      if (field === 'country') {
        nextErrors[field] = !userCountryCode;
      } else {
        nextErrors[field] = formValues[field].trim().length === 0;
      }
    });

    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some((value) => value);
  };

  const handleCompletePurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      setSubmissionError(dict.checkout.validationError);
      return;
    }

    if (!selectedProvider) {
      setSubmissionError(dict.checkout.selectPaymentMethod);
      return;
    }

    if (walletInsufficient) {
      setSubmissionError(dict.checkout.walletInsufficient);
      return;
    }

    setIsProcessingPayment(true);

    try {
      const payload = {
        fullName: formValues.fullName.trim(),
        addressLine1: formValues.addressLine1.trim(),
        city: formValues.city.trim(),
        state: formValues.state.trim(),
        postalCode: formValues.postalCode.trim(),
        // Use the detected country code, not the display name
        country: userCountryCode || formValues.country.trim(),
        phone: formValues.phone.trim(),
        paymentProvider: selectedProvider,
      };

      await persistProfile(payload);

      const providerInfo = providers.find((provider) => provider.provider === selectedProvider);

      const applyPhaseReward = async () => {
        if (!phaseReward || rewardDiscount <= 0) {
          return;
        }

        if (!userId) {
          console.warn('[Checkout] Skipping reward application because userId is missing');
          return;
        }

        try {
          const discountCents = Math.round(rewardDiscount * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS);
          const applyRewardResponse = await fetch('/api/orders/apply-rewards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            body: JSON.stringify({
              rewardType: phaseReward.type,
              discountCents,
            }),
          });

          if (!applyRewardResponse.ok) {
            console.error('[Checkout] Failed to apply phase reward:', await applyRewardResponse.text());
          }
        } catch (rewardError) {
          console.error('[Checkout] Error applying phase reward:', rewardError);
        }
      };

      // Prepare cart items for all payment providers
      const cartItems = items.map(item => {
        const pricing = getDiscountedUnitPrice(item.product);
        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          priceCents: Math.round(pricing.finalUnitPrice * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS),
        };
      });

      const metadata: Record<string, unknown> = {
        intent: 'checkout', // Required for payment validation
      };
      if (userId) {
        metadata.userId = userId;
      }
      if (phaseReward && rewardDiscount > 0) {
        metadata.phaseRewardType = phaseReward.type;
        metadata.phaseRewardDiscountCents = Math.round(
          rewardDiscount * PAYMENT_CONSTANTS.AMOUNTS.MULTIPLIER_CENTS,
        );
      }
      // ✅ SECURITY FIX: Validate affiliate referral tracking before including
      if (referralCode && affiliateId) {
        try {
          const validationResponse = await fetch('/api/affiliate/validate-referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode, affiliateId }),
          });

          const validationResult = await validationResponse.json();

          if (!validationResult.valid) {
            console.warn('[Checkout] Invalid affiliate referral data, skipping affiliate tracking');
          } else {
            metadata.affiliateReferralCode = referralCode;
            metadata.affiliateId = affiliateId;
            metadata.saleChannel = 'affiliate_store';
          }
        } catch (validationError) {
          console.error('[Checkout] Failed to validate affiliate referral:', validationError);
          // Continue without affiliate tracking if validation fails
        }
      }
      // Include cart items in metadata for all providers (for order creation)
      if (cartItems.length > 0) {
        metadata.cartItems = cartItems;
      }

      if (!hasPositiveTotal) {
        await applyPhaseReward();
        clearCart();
        setSuccessMessage(dict.checkout.successMessage || 'Order placed successfully!');
        return;
      }

      console.log('[Checkout] Creating payment with:', {
        provider: selectedProvider,
        amount: total,
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
        hasMetadata: Object.keys(metadata).length > 0,
        cartItemsCount: cartItems.length,
      });

      // Get the return URL from sessionStorage (set when adding from affiliate page)
      // or fallback to current URL
      let returnUrl: string | undefined;
      if (typeof window !== 'undefined') {
        try {
          const storedReturnUrl = sessionStorage.getItem('payment_return_url');
          returnUrl = storedReturnUrl || window.location.href;
          console.log('[Checkout] Using return URL:', returnUrl);
        } catch (error) {
          console.error('[Checkout] Failed to get return URL:', error);
          returnUrl = window.location.href;
        }
      }

      // ✅ SECURITY: Fetch CSRF token before making payment request
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });

      if (!csrfResponse.ok) {
        throw new Error('Failed to obtain CSRF token. Please refresh the page and try again.');
      }

      const { token: csrfToken } = await csrfResponse.json();

      const paymentResponse = await PaymentService.createPayment(
        selectedProvider,
        {
          amount: total,
          currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
          description: dict.checkout.paymentDescription,
          isTest: providerInfo?.mode === 'test' ? true : undefined,
          originUrl: returnUrl,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          cartItems: selectedProvider === 'wallet' ? cartItems : undefined,
        },
        {
          'X-CSRF-Token': csrfToken,
        }
      );

      console.log('[Checkout] Payment response:', paymentResponse);

      const paymentResult = PaymentFlowService.normalizeGatewayResponse(selectedProvider, paymentResponse);

      console.log('[Checkout] Payment result:', paymentResult);

      if (paymentResult.status === 'completed') {
        await applyPhaseReward();
        clearCart();

        // Redirect to order confirmation page if we have an order ID
        if (paymentResponse.orderId) {
          router.push(`/${lang}/orders?order_id=${paymentResponse.orderId}&status=success`);
        } else {
          setSuccessMessage(dict.checkout.walletPaymentSuccess);
        }
        return;
      }

      // Handle verification_required status from fraud detection
      if (paymentResult.status === 'verification_required') {
        console.log('[Checkout] Verification required:', paymentResult);
        setSubmissionError(
          paymentResult.verificationMessage ||
          dict.checkout.walletVerificationRequired ||
          'This transaction requires additional verification. Please contact support.'
        );
        return;
      }

      if (paymentResult.redirectUrl) {
        // Store metadata in sessionStorage for PayPal capture
        if (selectedProvider === 'paypal' && Object.keys(metadata).length > 0) {
          try {
            sessionStorage.setItem('paypal_payment_metadata', JSON.stringify(metadata));
          } catch (storageError) {
            console.error('[Checkout] Failed to store payment metadata:', storageError);
          }
        }

        window.location.href = paymentResult.redirectUrl;
        return;
      }

      setSubmissionError(dict.checkout.redirectError);
    } catch (error) {
      console.error('[Checkout] Payment error:', error);

      const message = error instanceof Error ? error.message : '';
      const normalized = message.toLowerCase();

      if (selectedProvider === 'wallet') {
        if (!message || normalized.includes('insufficient')) {
          setSubmissionError(dict.checkout.walletInsufficient);
          return;
        }

        // Show the actual error message for debugging
        console.error('[Checkout] Wallet payment error details:', {
          error,
          message,
          errorType: error?.constructor?.name,
        });

        setSubmissionError(message || dict.checkout.walletPaymentError);
        return;
      }

      // Check for specific error types and provide better messages
      if (normalized.includes('configuration') || normalized.includes('not configured')) {
        setSubmissionError(dict.checkout.paymentConfigurationError || dict.checkout.paymentError);
      } else if (normalized.includes('unavailable') || normalized.includes('503')) {
        setSubmissionError(dict.checkout.paymentServiceUnavailable || dict.checkout.paymentError);
      } else {
        setSubmissionError(message || dict.checkout.paymentError);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const submitDisabled =
    profileLoading ||
    providersLoading ||
    isProcessingPayment ||
    profileSaving ||
    !selectedProvider ||
    !hasCartItems ||
    !hasProviders ||
    (selectedProvider === 'wallet' && walletInsufficient);

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link href={`/${lang}/cart`} className="hover:text-primary">
                {dict.checkout.breadcrumbCart}
              </Link>
              <span>/</span>
              <span className="text-foreground">{dict.checkout.breadcrumbCheckout}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mt-2">{dict.checkout.title}</h1>
          </div>

          {/* Group gain banner */}
          {phaseGroupGain && phaseGroupGain.gainPercentage > 0 && items.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/80">
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  💼
                </span>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    {lang === 'en'
                      ? `You earn ${phaseGroupGain.gainPercentage}% of this order when it is placed through your affiliate store as a Phase ${phaseGroupGain.userPhase} member.`
                      : `Ganas ${phaseGroupGain.gainPercentage}% de esta orden cuando se realiza desde tu página de afiliado como miembro Fase ${phaseGroupGain.userPhase}.`}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-200">
                    {lang === 'en'
                      ? 'These affiliate earnings are credited to your network balance without affecting the shopper\'s payment amount.'
                      : 'Estas ganancias de afiliado se acreditan a tu balance de red sin afectar el monto que paga el comprador.'}
                  </p>
                  {groupGainAmount > 0 && (
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-100">
                      {lang === 'en'
                        ? `Estimated affiliate earnings from this checkout: ${formatCurrency(groupGainAmount)}`
                        : `Ganancia estimada del afiliado en esta compra: ${formatCurrency(groupGainAmount)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form className="grid grid-cols-1 gap-12 lg:grid-cols-2" onSubmit={handleCompletePurchase}>
            <div className="flex flex-col gap-8">
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">{dict.checkout.shippingInformation}</h2>
                  {profile && !profileLoading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFillWithProfileData}
                      disabled={isProcessingPayment || profileSaving}
                      className="flex items-center gap-2"
                    >
                      <span>📋</span>
                      {lang === 'en' ? 'Fill with my data' : 'Llenar con mis datos'}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{dict.checkout.saveForNextTime}</p>
                {profileError && (
                  <p className="mb-4 text-sm text-destructive">{dict.checkout.profileLoadError}</p>
                )}
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col">
                    <Label htmlFor="checkout-full-name" className="text-sm font-medium mb-1">
                      {dict.checkout.fullName}
                    </Label>
                    {profileLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <Input
                        id="checkout-full-name"
                        className={cn(
                          'h-12',
                          fieldErrors.fullName && 'border-destructive focus-visible:ring-destructive'
                        )}
                        autoComplete="off"
                        aria-invalid={fieldErrors.fullName}
                        value={formValues.fullName}
                        onChange={handleInputChange('fullName')}
                        disabled={isProcessingPayment || profileSaving}
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <Label htmlFor="checkout-address" className="text-sm font-medium mb-1">
                      {dict.checkout.address}
                    </Label>
                    {profileLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <Input
                        id="checkout-address"
                        className={cn(
                          'h-12',
                          fieldErrors.addressLine1 && 'border-destructive focus-visible:ring-destructive'
                        )}
                        autoComplete="off"
                        aria-invalid={fieldErrors.addressLine1}
                        value={formValues.addressLine1}
                        onChange={handleInputChange('addressLine1')}
                        disabled={isProcessingPayment || profileSaving}
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <Label htmlFor="checkout-city" className="text-sm font-medium mb-1">
                      {dict.checkout.city}
                    </Label>
                    {profileLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <Input
                        id="checkout-city"
                        className={cn(
                          'h-12',
                          fieldErrors.city && 'border-destructive focus-visible:ring-destructive'
                        )}
                        autoComplete="off"
                        aria-invalid={fieldErrors.city}
                        value={formValues.city}
                        onChange={handleInputChange('city')}
                        disabled={isProcessingPayment || profileSaving}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col">
                      <Label htmlFor="checkout-state" className="text-sm font-medium mb-1">
                        {dict.checkout.state}
                      </Label>
                      {profileLoading ? (
                        <Skeleton className="h-12 w-full" />
                      ) : (
                        <Input
                          id="checkout-state"
                          className="h-12"
                          autoComplete="off"
                          value={formValues.state}
                          onChange={handleInputChange('state')}
                          disabled={isProcessingPayment || profileSaving}
                        />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <Label htmlFor="checkout-postal" className="text-sm font-medium mb-1">
                        {dict.checkout.zipCode}
                      </Label>
                      {profileLoading ? (
                        <Skeleton className="h-12 w-full" />
                      ) : (
                        <Input
                          id="checkout-postal"
                          className={cn(
                            'h-12',
                            fieldErrors.postalCode && 'border-destructive focus-visible:ring-destructive'
                          )}
                          autoComplete="off"
                          aria-invalid={fieldErrors.postalCode}
                          value={formValues.postalCode}
                          onChange={handleInputChange('postalCode')}
                          disabled={isProcessingPayment || profileSaving}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <Label htmlFor="checkout-country" className="text-sm font-medium mb-1">
                      {dict.checkout.country}
                    </Label>
                    {profileLoading || countryLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <Input
                        id="checkout-country"
                        className={cn(
                          'h-12',
                          fieldErrors.country && 'border-destructive focus-visible:ring-destructive'
                        )}
                        autoComplete="off"
                        aria-invalid={fieldErrors.country}
                        value={countryDisplayValue}
                        onChange={(e) => setCountryDisplayValue(e.target.value)}
                        placeholder={dict.checkout.country}
                        disabled={isProcessingPayment || profileSaving}
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <Label htmlFor="checkout-phone" className="text-sm font-medium mb-1">
                      {dict.checkout.phoneNumber}
                    </Label>
                    {profileLoading ? (
                      <Skeleton className="h-12 w-full" />
                    ) : (
                      <Input
                        id="checkout-phone"
                        className="h-12"
                        autoComplete="off"
                        value={formValues.phone}
                        onChange={handleInputChange('phone')}
                        disabled={isProcessingPayment || profileSaving}
                      />
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">{dict.checkout.paymentMethod}</h2>
                {providersLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((item) => (
                      <Skeleton key={item} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : hasProviders ? (
                  <RadioGroup
                    value={selectedProvider || ''}
                    onValueChange={(value) => setSelectedProvider(toPaymentProvider(value))}
                    className="space-y-4"
                  >
                    {providers.map((provider) => {
                      const walletMeta = getWalletMetadata(provider);
                      const walletBalanceDisplay = walletMeta
                        ? new Intl.NumberFormat(lang, {
                          style: 'currency',
                          currency: walletMeta.walletCurrency,
                        }).format(walletMeta.walletBalanceCents / 100)
                        : null;
                      const providerWalletBalanceCents = walletMeta?.walletBalanceCents;
                      const providerWalletInsufficient =
                        provider.provider === 'wallet' &&
                        typeof providerWalletBalanceCents === 'number' &&
                        hasPositiveTotal &&
                        providerWalletBalanceCents < totalCents;

                      return (
                        <div
                          key={provider.provider}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border-light dark:border-border-dark cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                        >
                          <RadioGroupItem
                            value={provider.provider}
                            id={`checkout-provider-${provider.provider}`}
                            disabled={isProcessingPayment || profileSaving || providerWalletInsufficient}
                          />
                          <Label
                            htmlFor={`checkout-provider-${provider.provider}`}
                            className="text-md font-medium cursor-pointer flex flex-col gap-1"
                          >
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true">{PAYMENT_PROVIDER_ICONS[provider.provider] ?? '💳'}</span>
                              {PAYMENT_PROVIDER_LABELS[provider.provider] ?? provider.provider}
                            </span>
                            {walletMeta && (
                              <span className="text-xs text-muted-foreground">
                                {dict.checkout.walletBalanceLabel}: {walletBalanceDisplay}
                              </span>
                            )}
                            {providerWalletInsufficient && (
                              <span className="text-xs text-destructive">{dict.checkout.walletInsufficient}</span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <div className="rounded-md border border-dashed border-border-light dark:border-border-dark p-4 text-sm text-muted-foreground">
                    {dict.checkout.noPaymentMethods}
                  </div>
                )}
                {providersError && (
                  <p className="mt-3 text-sm text-destructive">{dict.checkout.paymentProvidersError}</p>
                )}
                {walletInsufficient && (
                  <p className="mt-3 text-sm text-destructive">{dict.checkout.walletInsufficient}</p>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-10 h-max space-y-4">
              {/* Discount Highlight Banner */}
              {phaseReward && rewardDiscount > 0 && (
                <div className={`rounded-lg p-4 ${phaseReward.type === 'free_product'
                    ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 dark:from-emerald-950 dark:to-green-950 dark:border-emerald-700'
                    : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 dark:from-blue-950 dark:to-cyan-950 dark:border-blue-700'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${phaseReward.type === 'free_product'
                        ? 'bg-emerald-200 dark:bg-emerald-800'
                        : 'bg-blue-200 dark:bg-blue-800'
                      }`}>
                      <span className="text-xl">🎁</span>
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold ${phaseReward.type === 'free_product'
                          ? 'text-emerald-900 dark:text-emerald-100'
                          : 'text-blue-900 dark:text-blue-100'
                        }`}>
                        {phaseReward.type === 'free_product'
                          ? dict.checkout.freeProductDiscount || 'Free Product Reward'
                          : dict.checkout.storeCreditDiscount || 'Store Credit'}
                      </p>
                      <p className={`text-sm mt-1 ${phaseReward.type === 'free_product'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-blue-700 dark:text-blue-300'
                        }`}>
                        Phase {phaseReward.phase} reward saving you{' '}
                        <span className="font-bold">{formatCurrency(rewardDiscount)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="rounded-lg border border-border bg-card shadow-lg">
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">{dict.checkout.orderSummary}</h2>

                  <div className="space-y-3">
                    {/* Product List */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {dict.checkout.subtotal}
                      </p>
                      {items.map((item) => {
                        const pricing = getDiscountedUnitPrice(item.product);
                        const hasProductDiscount = pricing.discountAmount > 0;
                        const lineTotal = pricing.finalUnitPrice * item.quantity;
                        const originalLineTotal = pricing.unitPrice * item.quantity;

                        return (
                          <div key={item.product.id} className="flex items-start justify-between text-sm">
                            <div className="text-muted-foreground">
                              <span>{item.product.name}</span>
                              {item.quantity > 1 && (
                                <span className="ml-2 text-xs font-medium text-muted-foreground">
                                  ×{item.quantity}
                                </span>
                              )}
                              {hasProductDiscount && pricing.discount?.label ? (
                                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  {pricing.discount.label}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <span className="block font-medium">
                                {formatCurrency(lineTotal)}
                              </span>
                              {hasProductDiscount && (
                                <span className="block text-xs text-muted-foreground line-through">
                                  {formatCurrency(originalLineTotal)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="h-px bg-border" />

                    {/* Subtotal */}
                    <div className="flex justify-between text-base font-medium">
                      <span className="text-muted-foreground">{dict.checkout.subtotalLabel || 'Subtotal'}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>

                    {productDiscount > 0 && (
                      <div className="flex justify-between text-base font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">💸</span>
                          <span>{dict.checkout.productDiscount || 'Product discounts'}</span>
                        </span>
                        <span>-{formatCurrency(productDiscount)}</span>
                      </div>
                    )}

                    {phaseGroupGain && phaseGroupGain.gainPercentage > 0 && groupGainAmount > 0 && (
                      <div className="flex justify-between items-center rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                        <span className="flex items-center gap-2">
                          <span className="text-lg" aria-hidden>
                            💼
                          </span>
                          <span>
                            {lang === 'en'
                              ? `Affiliate team earnings (${phaseGroupGain.gainPercentage}%)`
                              : `Ganancia de afiliado (${phaseGroupGain.gainPercentage}%)`}
                          </span>
                        </span>
                        <span>{formatCurrency(groupGainAmount)}</span>
                      </div>
                    )}

                    {phaseReward && rewardDiscount > 0 && (
                      <div className={`flex justify-between text-base font-bold rounded-lg p-3 -mx-3 ${phaseReward.type === 'free_product'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                        <span className="flex items-center gap-2">
                          <span className="text-lg">🎁</span>
                          <span>
                            {phaseReward.type === 'free_product'
                              ? dict.checkout.freeProductDiscount || 'Free Product Reward'
                              : dict.checkout.storeCreditDiscount || 'Store Credit'}
                          </span>
                        </span>
                        <span>-{formatCurrency(rewardDiscount)}</span>
                      </div>
                    )}

                    <div className="h-px bg-border" />

                    {/* Total */}
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-lg font-bold">{dict.checkout.total}</p>
                      <p className={`text-2xl font-bold ${totalDiscount > 0 ? 'text-primary' : ''}`}>
                        {formatCurrency(total)}
                      </p>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="text-center">
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {dict.checkout.totalSavings
                            ? dict.checkout.totalSavings.replace('{{amount}}', formatCurrency(totalDiscount))
                            : `🎉 You're saving ${formatCurrency(totalDiscount)}!`}
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="mt-4 w-full h-12 bg-primary text-primary-foreground hover:bg-primary/80 font-bold text-base"
                    disabled={submitDisabled}
                  >
                    {isProcessingPayment || profileSaving ? dict.checkout.processingPayment : dict.checkout.completePurchase}
                  </Button>

                  {submissionError && (
                    <p className="text-sm text-destructive">{submissionError}</p>
                  )}
                  {successMessage && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
                  )}
                  {selectedProvider === 'wallet' && walletMetadata && (
                    <p className="text-xs text-muted-foreground">
                      {dict.checkout.walletBalanceLabel}: {walletBalanceLabel}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}
