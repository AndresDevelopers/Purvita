'use client';

import { use, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import AuthGuard from '@/components/auth-guard';
import { useCart } from '@/contexts/cart-context';
import { useReferralTracking } from '@/contexts/referral-tracking-context';
import Image from 'next/image';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getDiscountedUnitPrice } from '@/modules/products/utils/product-pricing';


export default function CartPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = use(params);
  const dict = useAppDictionary();
  const {
    items,
    removeItem,
    updateQuantity,
    getTotal,
    getSubtotal,
    getProductDiscount,
    getRewardDiscount,
    getDiscount,
    phaseReward,
    setPhaseReward,
    phaseGroupGain,
    setPhaseGroupGain,
  } = useCart();
  const { referralCode: _referralCode } = useReferralTracking();
  const [loadingRewards, setLoadingRewards] = useState(true);
  const router = useRouter();

  // Load phase rewards and affiliate team earnings context
  useEffect(() => {
    const loadPhaseRewards = async () => {
      try {
        setLoadingRewards(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          console.log('[Cart] No user session found');
          setPhaseReward(null);
          setPhaseGroupGain(null);
          setLoadingRewards(false);
          return;
        }

        const [rewardsResponse, summaryResponse, groupGainResponse] = await Promise.all([
          fetch('/api/profile/rewards', {
            cache: 'no-store',
            credentials: 'same-origin', // Include cookies for authentication
          }),
          fetch('/api/profile/summary', {
            cache: 'no-store',
            credentials: 'same-origin', // Include cookies for authentication
          }).catch((summaryError) => {
            console.error('[Cart] Failed to request profile summary:', summaryError);
            return null;
          }),
          fetch('/api/products/user-discount', {
            cache: 'no-store',
          }).catch((groupGainError) => {
            console.error('[Cart] Failed to request group gain info:', groupGainError);
            return null;
          }),
        ]);

        let membershipPhase: number | null = null;

        if (summaryResponse) {
          if (summaryResponse.ok) {
            try {
              const summaryData = await summaryResponse.json();
              membershipPhase = summaryData?.membership?.phase?.phase ?? null;
              console.log('[Cart] Loaded membership phase:', membershipPhase);
            } catch (summaryParseError) {
              console.error('[Cart] Failed to parse profile summary response:', summaryParseError);
            }
          } else {
            console.error(
              '[Cart] Failed to load profile summary:',
              summaryResponse.status,
              summaryResponse.statusText,
            );
          }
        }

        if (rewardsResponse.ok) {
          const data = await rewardsResponse.json();
          const reward = data.reward;
          const configurations = Array.isArray(data.configurations) ? data.configurations : [];
          const configurationMap = new Map<number, { creditCents: number; freeProductValueCents: number }>();

          configurations.forEach((item: any) => {
            if (typeof item?.phase === 'number') {
              configurationMap.set(item.phase, {
                creditCents: Number.isFinite(item.creditCents) ? Number(item.creditCents) : 0,
                freeProductValueCents: Number.isFinite(item.freeProductValueCents)
                  ? Number(item.freeProductValueCents)
                  : item.phase === 1
                    ? 6500
                    : 0,
              });
            }
          });

          console.log('[Cart] Loaded phase reward:', reward);
          console.log('[Cart] User membership phase:', membershipPhase);

          if (reward && typeof membershipPhase === 'number' && membershipPhase > 0) {
            const userPhase = membershipPhase;
            const phaseConfiguration = configurationMap.get(userPhase);

            if (userPhase === 1 && reward.has_free_product && !reward.free_product_used) {
              const freeProductValueCents = phaseConfiguration?.freeProductValueCents ?? (reward.credit_total_cents ?? 6500);
              setPhaseReward({
                type: 'free_product',
                amountCents: freeProductValueCents,
                phase: userPhase,
              });
            } else if (userPhase >= 2 && reward.credit_remaining_cents > 0) {
              const configuredCredit = phaseConfiguration?.creditCents;
              const creditCapCents =
                typeof configuredCredit === 'number' && configuredCredit > 0
                  ? configuredCredit
                  : reward.credit_total_cents ?? reward.credit_remaining_cents;
              const creditAmountCents = Math.max(
                0,
                Math.min(reward.credit_remaining_cents, creditCapCents),
              );

              setPhaseReward({
                type: 'store_credit',
                amountCents: creditAmountCents,
                phase: userPhase,
              });
            } else {
              setPhaseReward(null);
            }
          } else {
            setPhaseReward(null);
          }
        } else {
          console.error('[Cart] Failed to load rewards:', rewardsResponse.status, rewardsResponse.statusText);
          setPhaseReward(null);
        }

        if (groupGainResponse && groupGainResponse.ok) {
          try {
            const gainData = await groupGainResponse.json();
            if (gainData?.gainPercentage > 0) {
              setPhaseGroupGain({
                userPhase: gainData.userPhase,
                gainRate: gainData.gainRate,
                gainPercentage: gainData.gainPercentage,
              });
              console.log('[Cart] Loaded phase group gain info:', gainData);
            } else {
              setPhaseGroupGain(null);
            }
          } catch (groupGainParseError) {
            console.error('[Cart] Failed to parse group gain response:', groupGainParseError);
            setPhaseGroupGain(null);
          }
        } else {
          setPhaseGroupGain(null);
        }
      } catch (err) {
        console.error('Failed to load phase rewards:', err);
        setPhaseReward(null);
        setPhaseGroupGain(null);
      } finally {
        setLoadingRewards(false);
      }
    };

    loadPhaseRewards();
  }, [setPhaseReward, setPhaseGroupGain]);
  const subtotal = useMemo(() => getSubtotal(), [getSubtotal]);
  const productDiscount = useMemo(() => getProductDiscount(), [getProductDiscount]);
  const rewardDiscount = useMemo(() => getRewardDiscount(), [getRewardDiscount]);
  const subtotalAfterProductDiscount = useMemo(
    () => Math.max(0, subtotal - productDiscount),
    [subtotal, productDiscount],
  );
  const groupGainAmount = useMemo(() => {
    if (!phaseGroupGain || phaseGroupGain.gainRate <= 0) {
      return 0;
    }
    return subtotalAfterProductDiscount * phaseGroupGain.gainRate;
  }, [phaseGroupGain, subtotalAfterProductDiscount]);
  const totalDiscount = useMemo(() => getDiscount(), [getDiscount]);
  const total = useMemo(() => getTotal(), [getTotal]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-MX', {
        style: 'currency',
        currency: 'USD',
      }),
    [lang],
  );
  const canProceed = items.length > 0 && total >= 0;

  const handleCheckout = () => {
    if (!canProceed) {
      return;
    }

    // Always redirect to the main checkout page
    router.push(`/${lang}/checkout`);
  };

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-8">{dict.cart.title}</h2>

          {/* Group gain information banner */}
          {!loadingRewards && phaseGroupGain && phaseGroupGain.gainPercentage > 0 && items.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/80">
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  💼
                </span>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    {lang === 'en'
                      ? `You earn ${phaseGroupGain.gainPercentage}% on every sale completed through your affiliate store as a Phase ${phaseGroupGain.userPhase} member.`
                      : `Ganas ${phaseGroupGain.gainPercentage}% en cada venta realizada desde tu página de afiliado como miembro Fase ${phaseGroupGain.userPhase}.`}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-200">
                    {lang === 'en'
                      ? 'These affiliate earnings are added to your network balance without changing the shopper\'s total.'
                      : 'Estas ganancias de afiliado se suman a tu balance de red sin modificar el total del comprador.'}
                  </p>
                  {groupGainAmount > 0 && (
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-100">
                      {lang === 'en'
                        ? `Estimated affiliate earnings on this cart: ${currencyFormatter.format(groupGainAmount)}`
                        : `Ganancia estimada del afiliado en este carrito: ${currencyFormatter.format(groupGainAmount)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold mb-4 border-b border-border-light dark:border-border-dark pb-2">
                {dict.cart.products}
              </h3>
              {items.length === 0 ? (
                <p className="text-center py-8">{dict.cart.emptyCart}</p>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => {
                    const pricing = getDiscountedUnitPrice(item.product);
                    const hasProductDiscount = pricing.discountAmount > 0;

                    return (
                      <div
                        key={item.product.id}
                        className="flex flex-col md:flex-row items-start gap-6 p-4 rounded-lg bg-subtle-light/30 dark:bg-subtle-dark/30"
                      >
                        <div className="w-full md:w-1/3 h-48 md:h-auto rounded-lg overflow-hidden">
                          <Image
                            src={item.product.images[0]?.url || '/placeholder-image.svg'}
                            alt={item.product.name}
                            width={300}
                            height={200}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold">{item.product.name}</h4>
                          <p className="text-text-light/80 dark:text-text-dark/80 mt-1">
                            {item.product.description.substring(0, 100)}...
                          </p>
                          <div className="mt-4 space-y-1">
                            <p className="text-lg font-bold text-primary">
                              ${pricing.finalUnitPrice.toFixed(2)}
                            </p>
                            {hasProductDiscount && (
                              <div className="flex flex-col text-sm text-muted-foreground">
                                <span className="line-through">${pricing.unitPrice.toFixed(2)}</span>
                                {pricing.discount?.label ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {pricing.discount.label}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <span>{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            >
                              +
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(item.product.id)}
                            >
                              {dict.cart.remove}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <div className="mt-12 space-y-4">
              {/* Discount Banner - Shown prominently if reward is available */}
              {!loadingRewards && phaseReward && rewardDiscount > 0 && (
                <div className={`rounded-lg p-4 ${phaseReward.type === 'free_product'
                    ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 dark:from-emerald-950 dark:to-green-950 dark:border-emerald-700'
                    : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 dark:from-blue-950 dark:to-cyan-950 dark:border-blue-700'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${phaseReward.type === 'free_product'
                          ? 'bg-emerald-200 dark:bg-emerald-800'
                          : 'bg-blue-200 dark:bg-blue-800'
                        }`}>
                        <span className="text-2xl">🎁</span>
                      </div>
                      <div>
                        <p className={`font-bold text-lg ${phaseReward.type === 'free_product'
                            ? 'text-emerald-900 dark:text-emerald-100'
                            : 'text-blue-900 dark:text-blue-100'
                          }`}>
                          {phaseReward.type === 'free_product'
                            ? dict.cart.freeProductDiscount || 'Free Product Reward'
                            : dict.cart.storeCreditDiscount || 'Store Credit'}
                        </p>
                        <p className={`text-sm ${phaseReward.type === 'free_product'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-blue-700 dark:text-blue-300'
                          }`}>
                          Phase {phaseReward.phase} Monthly Reward Applied
                        </p>
                      </div>
                    </div>
                    <div className={`text-right ${phaseReward.type === 'free_product'
                        ? 'text-emerald-900 dark:text-emerald-100'
                        : 'text-blue-900 dark:text-blue-100'
                      }`}>
                      <p className="text-2xl font-bold">-${rewardDiscount.toFixed(2)}</p>
                      <p className="text-xs font-medium">Discount Applied</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="rounded-lg border border-border-light dark:border-border-dark bg-card p-6 space-y-4">
                <h3 className="text-lg font-bold">Order Summary</h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">{dict.cart.subtotal || 'Subtotal'}:</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>

                  {productDiscount > 0 && (
                    <div className="flex justify-between text-base font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="flex items-center gap-2">
                        <span>💸</span>
                        <span>{dict.cart.productDiscount || 'Product discounts'}</span>
                      </span>
                      <span>-${productDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {!loadingRewards && phaseReward && rewardDiscount > 0 && (
                    <div className={`flex justify-between text-base font-semibold ${phaseReward.type === 'free_product'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                      }`}>
                      <span className="flex items-center gap-2">
                        <span>🎁</span>
                        <span>
                          {phaseReward.type === 'free_product'
                            ? dict.cart.freeProductDiscount || 'Free Product Reward'
                            : dict.cart.storeCreditDiscount || 'Store Credit'}
                        </span>
                      </span>
                      <span>-{rewardDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="h-px bg-border-light dark:bg-border-dark" />

                  <div className="flex justify-between text-xl font-bold">
                    <span>{dict.cart.total}:</span>
                    <span className={totalDiscount > 0 ? 'text-primary' : ''}>${total.toFixed(2)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {dict.cart.totalSavings
                        ? dict.cart.totalSavings.replace('{{amount}}', totalDiscount.toFixed(2))
                        : `You saved $${totalDiscount.toFixed(2)}!`} 🎉
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full bg-primary text-background-dark font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canProceed}
                  onClick={handleCheckout}
                >
                  {dict.cart.proceedToCheckout}
                </Button>
                
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
