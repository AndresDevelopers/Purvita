'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import AuthGuard from '@/components/auth-guard';
import { usePaymentProviders } from '@/modules/payments/hooks/use-payment-gateways';
import { useCart } from '@/contexts/cart-context';
import { useCheckoutProfile } from '@/modules/checkout/hooks/use-checkout-profile';
import type { CheckoutPaymentProvider } from '@/modules/checkout/domain/models/checkout-profile';
import { PAYMENT_CONSTANTS } from '@/modules/payments/constants/payment-constants';
import { PaymentService } from '@/modules/payments/services/payment-service';
import { PaymentFlowService } from '@/modules/payments/services/payment-flow-service';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';
import { cn } from '@/lib/utils';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';
import { useCurrentUserCountry } from '@/modules/profile/hooks/use-current-user-country';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import type { Locale } from '@/i18n/config';
import type { AppDictionary } from '@/i18n/dictionaries';

const PAYMENT_PROVIDER_ICONS: Record<string, string> = {
  paypal: '🅿️',
  stripe: '💳',
  wallet: '👛',
  manual: '📝',
  authorize_net: '🛡️',
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  stripe: 'Stripe',
  wallet: 'Wallet Balance',
  manual: 'Manual Payment',
  authorize_net: 'Authorize.net',
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
  return normalized === 'paypal' || normalized === 'stripe' || normalized === 'wallet' || normalized === 'authorize_net'
    ? (normalized as CheckoutPaymentProvider)
    : null;
};

interface AffiliateCheckoutClientProps {
  lang: Locale;
  sponsor: {
    id: string;
    name: string;
    // email is intentionally excluded for security (not exposed to client)
    referralCode: string;
  };
  dictionary: AppDictionary;
  customization: {
    storeTitle: string | null;
    bannerUrl: string | null;
    logoUrl: string | null;
  };
  referralCode: string;
}

export function AffiliateCheckoutClient({
  lang,
  sponsor,
  dictionary: dict,
  customization,
  referralCode,
}: AffiliateCheckoutClientProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseUser();
  const { providers: allProviders, isLoading: providersLoading } = usePaymentProviders();

  // Filtrar proveedores: excluir wallet, solo funcionalidad de pago, y disponibles en tienda de afiliados
  const providers = useMemo(() => {
    return allProviders.filter(p => {
      // Excluir wallet para checkout de afiliados
      if (p.provider === 'wallet') return false;
      // Solo proveedores con funcionalidad de pago
      const supportsPayment = p.functionality === 'payment' || p.functionality === 'both';
      // Solo proveedores disponibles en tienda de afiliados
      const availableOnAffiliate = p.availableOnAffiliateCheckout !== false;
      return supportsPayment && availableOnAffiliate;
    });
  }, [allProviders]);

  // Currency formatter
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
      }),
    [lang],
  );
  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const {
    items,
    getTotal,
    getSubtotal,
    getProductDiscount,
    getDiscount,
    clearCart,
  } = useCart();

  const {
    profile,
    isLoading: profileLoading,
    isSaving: profileSaving,
    error: profileError,
    save: _persistProfile,
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
  const [countryDisplayValue, setCountryDisplayValue] = useState<string>('');

  // Authorize.net Card Details State
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expirationDate: '',
    cvv: '',
  });

  const handleCardInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardDetails(prev => ({ ...prev, [name]: value }));
  };

  // Convert country code to full country name
  const regionDisplay = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [lang]);

  // Set preferred provider from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const provider = toPaymentProvider(stored);
      if (provider && providers.some(p => p.provider === provider)) {
        setSelectedProvider(provider);
      }
    }
  }, [providers]);

  // Update country display when user country changes
  useEffect(() => {
    if (userCountryCode) {
      try {
        const countryName = regionDisplay.of(userCountryCode);
        setCountryDisplayValue(countryName || userCountryCode);
        setFormValues(prev => ({
          ...prev,
          country: userCountryCode,
        }));
      } catch {
        setCountryDisplayValue(userCountryCode);
        setFormValues(prev => ({
          ...prev,
          country: userCountryCode,
        }));
      }
    }
  }, [userCountryCode, regionDisplay]);


  const cartItems = items || [];
  const hasCartItems = cartItems.length > 0;
  const subtotal = getSubtotal();
  const productDiscount = getProductDiscount();
  const totalDiscount = getDiscount();
  const total = getTotal();
  const hasPositiveTotal = total > 0;
  const hasProviders = providers.length > 0;

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

  const handleFillWithProfileData = () => {
    if (profile) {
      setFormValues(prev => ({
        ...prev,
        fullName: profile.fullName || '',
        addressLine1: profile.addressLine1 || '',
        city: profile.city || '',
        state: profile.state || '',
        postalCode: profile.postalCode || '',
        phone: profile.phone || '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<FormField, boolean> = { ...INITIAL_FORM_ERRORS };
    let isValid = true;

    for (const field of requiredFields) {
      if (!formValues[field]?.trim()) {
        errors[field] = true;
        isValid = false;
      }
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleCompletePurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm() || !selectedProvider || !hasCartItems || isProcessingPayment) {
      return;
    }

    setIsProcessingPayment(true);
    setSubmissionError(null);

    try {
      // Prepare metadata with affiliate information
      const metadata: Record<string, any> = {
        intent: 'checkout', // Required for payment validation
        affiliateReferralCode: referralCode,
        affiliateId: sponsor.id,
        saleChannel: 'affiliate_store',
      };

      if (cartItems.length > 0) {
        metadata.cartItems = cartItems;
      }

      // Authorize.net specific logic
      if (selectedProvider === 'authorize_net') {
        if (!cardDetails.cardNumber || !cardDetails.expirationDate || !cardDetails.cvv) {
          setSubmissionError(dict.checkout.fillAllFields || 'Please fill in all credit card details');
          setIsProcessingPayment(false);
          return;
        }
        metadata.cardNumber = cardDetails.cardNumber;
        metadata.expirationDate = cardDetails.expirationDate;
        metadata.cvv = cardDetails.cvv;

        // Also map billing info from formValues to metadata for AVS
        metadata.firstName = formValues.fullName.split(' ')[0];
        metadata.lastName = formValues.fullName.split(' ').slice(1).join(' ');
        metadata.address = formValues.addressLine1;
        metadata.city = formValues.city;
        metadata.state = formValues.state;
        metadata.zip = formValues.postalCode;
        metadata.country = formValues.country;
        metadata.customerEmail = user?.email;
      }

      if (!hasPositiveTotal) {
        clearCart();
        setSuccessMessage(dict.checkout.successMessage || 'Order placed successfully!');
        setTimeout(() => {
          router.push(`/${lang}/affiliate/${referralCode}`);
        }, 2000);
        return;
      }

      // Get current page URL for return after payment
      // Use window.location.href to capture the exact current URL including any query parameters
      const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;

      // ✅ SECURITY: Fetch CSRF token with timeout (5 seconds)
      const csrfResponse = await fetchWithTimeout('/api/csrf-token', {}, 5000);
      const { token: csrfToken } = await csrfResponse.json();

      const paymentResponse = await PaymentService.createPayment(
        selectedProvider,
        {
          amount: total,
          currency: PAYMENT_CONSTANTS.CURRENCIES.DEFAULT,
          description: dict.checkout.paymentDescription,
          originUrl: currentUrl,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
        {
          'X-CSRF-Token': csrfToken,
        }
      );

      if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Checkout] Payment response:', paymentResponse);

      const paymentResult = PaymentFlowService.normalizeGatewayResponse(selectedProvider, paymentResponse);

      if (process.env.NODE_ENV !== 'production') console.log('[Affiliate Checkout] Payment result:', paymentResult);

      if (paymentResult.status === 'completed') {
        clearCart();

        // Redirect to order confirmation page if we have an order ID
        if (paymentResponse.orderId) {
          router.push(`/${lang}/orders?order_id=${paymentResponse.orderId}&status=success`);
        } else {
          setSuccessMessage(dict.checkout.successMessage || 'Order placed successfully!');
          setTimeout(() => {
            router.push(`/${lang}/affiliate/${referralCode}`);
          }, 2000);
        }
        return;
      }

      if (paymentResult.redirectUrl) {
        // Store metadata in sessionStorage for PayPal capture
        if (selectedProvider === 'paypal' && Object.keys(metadata).length > 0) {
          try {
            sessionStorage.setItem('paypal_payment_metadata', JSON.stringify(metadata));
          } catch (storageError) {
            console.error('[Affiliate Checkout] Failed to store payment metadata:', storageError);
          }
        }

        // Save preferred provider
        localStorage.setItem(LOCAL_STORAGE_KEY, selectedProvider);

        window.location.href = paymentResult.redirectUrl;
        return;
      }

      setSubmissionError(dict.checkout.redirectError || 'Payment redirect failed');

    } catch (error) {
      console.error('[Affiliate Checkout] Payment error:', error);
      setSubmissionError(
        error instanceof Error ? error.message : 'An error occurred during payment processing'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const _providerLabels = useMemo(
    () => ({
      paypal: dict.checkout.paypal,
      stripe: dict.checkout.stripe,
      wallet: dict.checkout.wallet,
    }),
    [dict.checkout.paypal, dict.checkout.stripe, dict.checkout.wallet]
  );

  const submitDisabled =
    profileLoading ||
    providersLoading ||
    isProcessingPayment ||
    profileSaving ||
    !selectedProvider ||
    !hasCartItems ||
    !hasProviders;

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header with breadcrumb */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link href={`/${lang}/affiliate/${referralCode}`} className="hover:text-primary">
                {customization.storeTitle || sponsor.name}
              </Link>
              <span>/</span>
              <span className="text-foreground">{dict.checkout.breadcrumbCheckout}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mt-2">{dict.checkout.title}</h1>
          </div>

          {!hasCartItems ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">
                  {lang === 'en' ? 'Your cart is empty' : 'Tu carrito está vacío'}
                </p>
                <Button onClick={() => router.push(`/${lang}/affiliate/${referralCode}`)}>
                  {lang === 'en' ? 'Continue Shopping' : 'Continuar Comprando'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <form className="grid grid-cols-1 gap-12 lg:grid-cols-2" onSubmit={handleCompletePurchase}>
              {/* Left Column - Shipping & Payment */}
              <div className="flex flex-col gap-8">
                {/* Shipping Information */}
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

                {/* Payment Method */}
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
                      value={selectedProvider ?? undefined}
                      onValueChange={(value) => setSelectedProvider(toPaymentProvider(value))}
                      className="space-y-4"
                    >
                      {providers.map((provider) => (
                        <div key={provider.provider}>
                          <div
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-lg border border-border-light dark:border-border-dark cursor-pointer',
                              selectedProvider === provider.provider ? 'border-primary bg-primary/10' : ''
                            )}
                            onClick={() => setSelectedProvider(provider.provider)}
                          >
                            <RadioGroupItem
                              value={provider.provider}
                              id={`checkout-provider-${provider.provider}`}
                              disabled={isProcessingPayment || profileSaving}
                              checked={selectedProvider === provider.provider}
                            />
                            <Label
                              htmlFor={`checkout-provider-${provider.provider}`}
                              className="text-md font-medium cursor-pointer w-full"
                            >
                              <span className="flex items-center gap-2">
                                <span aria-hidden="true">{PAYMENT_PROVIDER_ICONS[provider.provider] ?? '💳'}</span>
                                {PAYMENT_PROVIDER_LABELS[provider.provider] ?? provider.provider}
                              </span>
                            </Label>
                          </div>

                          {/* Authorize.net Credit Card Form */}
                          {provider.provider === 'authorize_net' && selectedProvider === 'authorize_net' && (
                            <div className="mt-4 p-4 border rounded-md bg-card space-y-4 animate-in fade-in slide-in-from-top-2">
                              <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="cc-number">Card Number</Label>
                                  <Input
                                    id="cc-number"
                                    name="cardNumber"
                                    placeholder="0000 0000 0000 0000"
                                    value={cardDetails.cardNumber}
                                    onChange={handleCardInputChange}
                                    maxLength={19}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="cc-exp">Expiration (MM/YY)</Label>
                                    <Input
                                      id="cc-exp"
                                      name="expirationDate"
                                      placeholder="MM/YY"
                                      value={cardDetails.expirationDate}
                                      onChange={handleCardInputChange}
                                      maxLength={5}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="cc-cvv">CVV</Label>
                                    <Input
                                      id="cc-cvv"
                                      name="cvv"
                                      placeholder="123"
                                      value={cardDetails.cvv}
                                      onChange={handleCardInputChange}
                                      maxLength={4}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="rounded-md border border-dashed border-border-light dark:border-border-dark p-4 text-sm text-muted-foreground">
                      {dict.checkout.noPaymentMethods}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column - Order Summary */}
              <aside className="lg:sticky lg:top-10 h-max space-y-4">
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
                        {cartItems.map((item) => {
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
                  </div>
                </div>
              </aside>
            </form>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
