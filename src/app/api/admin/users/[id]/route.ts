import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { UpdateUserProfileSchema } from '@/lib/models/definitions';
import { SubscriptionRepository } from '@/modules/multilevel/repositories/subscription-repository';
import { WalletService } from '@/modules/multilevel/services/wallet-service';
import { NetworkEarningsRepository } from '@/modules/multilevel/repositories/network-earnings-repository';
import type { PaymentGateway, SubscriptionStatus } from '@/modules/multilevel/domain/types';
import { extractStoragePathFromUrl } from '@/lib/utils';
import { SecurityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/security/audit-logger';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getAdminClient } from '@/lib/supabase/admin'; // ✅ SECURITY: Use centralized admin client

const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'unpaid'] as const satisfies readonly SubscriptionStatus[];
const PAYMENT_GATEWAYS = ['stripe', 'paypal', 'wallet'] as const satisfies readonly PaymentGateway[];

const SubscriptionUpdateSchema = z.object({
    subscriptionType: z.enum(['mlm', 'affiliate']).optional(),
    status: z.enum(SUBSCRIPTION_STATUSES),
    currentPeriodEnd: z.string().datetime().nullable().optional(),
    gateway: z.enum(PAYMENT_GATEWAYS).optional(),
    planId: z.string().uuid().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
});

const WalletUpdateSchema = z.object({
    targetBalanceCents: z.number().int(),
    note: z.string().max(500).optional(),
});

const NetworkEarningsUpdateSchema = z.object({
    targetAmountCents: z.number().int().min(0),
    note: z.string().max(500).optional(),
});

const PhaseUpdateSchema = z.object({
    phase: z.number().int().min(0).max(3),
    ecommerce_commission: z.number().min(0).max(1).optional(),
});

const RewardsUpdateSchema = z.object({
    phase: z.number().int().min(1).max(3),
    grantReward: z.boolean().optional(),
});

const AdminUpdateUserSchema = z
    .object({
        profile: z.record(z.unknown()).optional(),
        subscription: SubscriptionUpdateSchema.optional(),
        wallet: WalletUpdateSchema.optional(),
        networkEarnings: NetworkEarningsUpdateSchema.optional(),
        phase: PhaseUpdateSchema.optional(),
        rewards: RewardsUpdateSchema.optional(),
    })
    .refine((payload) => Boolean(payload.profile || payload.subscription || payload.wallet || payload.networkEarnings || payload.phase || payload.rewards), {
        message: 'No updates provided',
        path: ['profile'],
    });

async function ensureProfileExists(
    client: SupabaseClient,
    userId: string
): Promise<boolean> {
    const { data: existingProfile, error: existingError } = await client
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (existingError) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Supabase error (profile lookup):', existingError);
        }
        throw new Error(`Error verificando perfil: ${existingError.message}`);
    }

    if (existingProfile) {
        return true;
    }

    const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);

    if (authError) {
        if (authError.message?.includes('User not found')) {
            return false;
        }
        if (process.env.NODE_ENV !== 'production') {
            console.error('Supabase error (auth lookup):', authError);
        }
        throw new Error(`Error verificando usuario en auth: ${authError.message}`);
    }

    if (!authUser?.user) {
        return false;
    }

    const userEmail = authUser.user.email ?? `placeholder-${userId}@internal.local`;
    const userName =
        (typeof authUser.user.user_metadata?.name === 'string' && authUser.user.user_metadata.name.trim().length > 0
            ? authUser.user.user_metadata.name.trim()
            : userEmail);

    const { error: insertError } = await client
        .from('profiles')
        .insert({
            id: userId,
            name: userName,
            email: userEmail,
            status: 'active',
            role: 'member',
        })
        .select('id')
        .single();

    if (insertError) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Supabase error (profile create):', insertError);
        }
        throw new Error(`No se pudo crear el perfil del patrocinador: ${insertError.message}`);
    }

    return true;
}

/**
 * PUT /api/admin/users/[id]
 * Update user details
 * Requires: manage_users permission
 */
export const PUT = withAdminPermission('manage_users', async (request, context) => {
    // ✅ SECURITY: Validate CSRF token
    const { requireCsrfToken } = await import('@/lib/security/csrf-protection');
    const csrfError = await requireCsrfToken(request);
    if (csrfError) {
        return csrfError;
    }

    try {
        const { id: userId } = await context!.params;

        // ✅ SECURITY: Validate UUID format to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        const rawBody = await request.json();

        const parsedBody = AdminUpdateUserSchema.parse(rawBody);

        const supabaseAdmin = getAdminClient();

        let profileUpdates: Record<string, unknown> | undefined;
        let resetReferredBy = false;

        if (parsedBody.profile) {
            const draftProfile = { ...parsedBody.profile };

            if ('referred_by' in draftProfile) {
                const value = draftProfile.referred_by;
                if (typeof value === 'string' && value.trim().length > 0) {
                    const trimmedReferrer = value.trim();

                    if (trimmedReferrer === userId) {
                        return NextResponse.json(
                            { error: 'El usuario no puede patrocinarse a sí mismo.' },
                            { status: 400 }
                        );
                    }

                    const { data: referrerRecord, error: referrerError } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('id', trimmedReferrer)
                        .maybeSingle();

                    if (referrerError) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.error('Supabase error (referrer lookup):', referrerError);
                        }
                        return NextResponse.json(
                            { error: `Error verificando patrocinador: ${referrerError.message}` },
                            { status: 400 }
                        );
                    }

                    let referrerExists = Boolean(referrerRecord);

                    if (!referrerExists) {
                        try {
                            referrerExists = await ensureProfileExists(supabaseAdmin, trimmedReferrer);
                        } catch (error) {
                            if (error instanceof Error) {
                                return NextResponse.json(
                                    { error: error.message },
                                    { status: 400 }
                                );
                            }
                            return NextResponse.json(
                                { error: 'No se pudo verificar el patrocinador.' },
                                { status: 400 }
                            );
                        }
                    }

                    if (!referrerExists) {
                        return NextResponse.json(
                            { error: 'El patrocinador indicado no existe.' },
                            { status: 400 }
                        );
                    }

                    draftProfile.referred_by = trimmedReferrer;
                } else {
                    resetReferredBy = true;
                    delete draftProfile.referred_by;
                }
            }

            const validatedProfile = UpdateUserProfileSchema.parse(draftProfile);
            profileUpdates = { ...validatedProfile };

            if (resetReferredBy) {
                profileUpdates.referred_by = null;
            }
        }

        // Parse subscription updates
        const subscriptionUpdates = parsedBody.subscription
            ? SubscriptionUpdateSchema.parse(parsedBody.subscription)
            : undefined;

        // Update pay status based on subscription (both MLM and Affiliate give access to store)
        if (subscriptionUpdates) {
            const hasActiveSubscription = subscriptionUpdates.status === 'active';
            profileUpdates = {
                ...(profileUpdates ?? {}),
                pay: hasActiveSubscription,
            };
        }

        const walletUpdates = parsedBody.wallet ? WalletUpdateSchema.parse(parsedBody.wallet) : undefined;

        const networkEarningsUpdates = parsedBody.networkEarnings
            ? NetworkEarningsUpdateSchema.parse(parsedBody.networkEarnings)
            : undefined;

        if (profileUpdates) {
            const { error } = await supabaseAdmin
                .from('profiles')
                .update(profileUpdates)
                .eq('id', userId);

            if (error) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Supabase error:', error);
                }
                return NextResponse.json(
                    { error: `Error updating user: ${error.message}` },
                    { status: 400 }
                );
            }

            // If commission_rate was updated, sync it to phases.ecommerce_commission
            if ('commission_rate' in profileUpdates && typeof profileUpdates.commission_rate === 'number') {
                const { error: phaseError } = await supabaseAdmin
                    .from('phases')
                    .upsert(
                        {
                            user_id: userId,
                            ecommerce_commission: profileUpdates.commission_rate,
                            phase: 0,
                            phase1_granted: false,
                            phase2_granted: false,
                            phase3_granted: false,
                        },
                        {
                            onConflict: 'user_id',
                            ignoreDuplicates: false
                        }
                    );

                if (phaseError && process.env.NODE_ENV !== 'production') {
                    console.warn('Warning: Could not sync commission_rate to phases:', phaseError);
                }
            }
        }

        // Handle subscription (MLM and Affiliate are mutually exclusive)
        if (subscriptionUpdates) {
            const repository = new SubscriptionRepository(supabaseAdmin);
            const currentPeriodEnd =
                subscriptionUpdates.currentPeriodEnd !== undefined
                    ? subscriptionUpdates.currentPeriodEnd
                    : null;

            try {
                await repository.upsertSubscription({
                    userId,
                    subscriptionType: subscriptionUpdates.subscriptionType ?? 'mlm',
                    status: subscriptionUpdates.status,
                    periodEnd: currentPeriodEnd,
                    gateway: subscriptionUpdates.gateway ?? 'wallet',
                    planId: subscriptionUpdates.planId,
                    cancelAtPeriodEnd: subscriptionUpdates.cancelAtPeriodEnd,
                });
            } catch (e) {
                console.error('[AdminUsers][subscription upsert] Error:', e);
                const message = e instanceof Error ? e.message : JSON.stringify(e);
                return NextResponse.json(
                    { error: `Error updating subscription: ${message}` },
                    { status: 400 }
                );
            }
        }

        if (walletUpdates) {
            const walletService = new WalletService(supabaseAdmin);
            const currentWallet = await walletService.getBalance(userId);
            const currentBalance = currentWallet?.balance_cents ?? 0;
            const delta = walletUpdates.targetBalanceCents - currentBalance;

            if (delta !== 0) {
                await walletService.addFunds(userId, delta, 'admin_adjustment', undefined, walletUpdates.note, {
                    source: 'admin-user-edit',
                    target_balance_cents: walletUpdates.targetBalanceCents,
                });
            }
        }

        if (networkEarningsUpdates) {
            const networkEarningsRepo = new NetworkEarningsRepository(supabaseAdmin);
            await networkEarningsRepo.adminAdjustEarnings(
                userId,
                networkEarningsUpdates.targetAmountCents,
                networkEarningsUpdates.note
            );
        }

        if (parsedBody.phase) {
            const phaseUpdates = PhaseUpdateSchema.parse(parsedBody.phase);

            // Use admin_set_user_phase to properly handle manual_phase_override
            const { data: phaseResult, error: phaseError } = await supabaseAdmin
                .rpc('admin_set_user_phase', {
                    p_user_id: userId,
                    p_new_phase: phaseUpdates.phase,
                    p_admin_id: request.user.id,
                });

            if (phaseError) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('Phase update error:', phaseError);
                }
                return NextResponse.json(
                    { error: `Error updating phase: ${phaseError.message}` },
                    { status: 400 }
                );
            }

            const result = phaseResult as { success: boolean; error?: string };
            if (!result.success) {
                return NextResponse.json(
                    { error: result.error || 'Failed to update phase' },
                    { status: 400 }
                );
            }
        }

        if (parsedBody.rewards) {
            const rewardsUpdates = RewardsUpdateSchema.parse(parsedBody.rewards);

            if (rewardsUpdates.grantReward) {
                // Grant monthly phase reward
                const { error: rewardError } = await supabaseAdmin
                    .rpc('grant_phase_reward', {
                        p_user_id: userId,
                        p_phase: rewardsUpdates.phase
                    });

                if (rewardError) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('Reward grant error:', rewardError);
                    }
                    return NextResponse.json(
                        { error: `Error granting reward: ${rewardError.message}` },
                        { status: 400 }
                    );
                }

                // Also update the phase_granted flag
                const phaseColumn = `phase${rewardsUpdates.phase}_granted` as const;
                await supabaseAdmin
                    .from('phases')
                    .update({ [phaseColumn]: true })
                    .eq('user_id', userId);
            }
        }

        // Reuse repository instances for final fetch
        const subscriptionRepo = new SubscriptionRepository(supabaseAdmin);
        const walletSvc = new WalletService(supabaseAdmin);
        const networkEarningsRepo = new NetworkEarningsRepository(supabaseAdmin);

        const [{ data: profile, error: fetchProfileError }, subscription, wallet, networkEarnings, phase, rewards] = await Promise.all([
            supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
            subscriptionRepo.findByUserId(userId),
            walletSvc.getBalance(userId),
            networkEarningsRepo.fetchAvailableSummary(userId),
            supabaseAdmin.from('phases').select('*').eq('user_id', userId).maybeSingle(),
            supabaseAdmin.rpc('get_active_phase_rewards', { p_user_id: userId }),
        ]);

        if (fetchProfileError) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Supabase error:', fetchProfileError);
            }
            return NextResponse.json(
                { error: `Error fetching updated user: ${fetchProfileError.message}` },
                { status: 400 }
            );
        }

        if (!profile) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // ✅ SECURITY: Audit log for user update
        await SecurityAuditLogger.log(
            SecurityEventType.ADMIN_ACTION,
            SecurityEventSeverity.WARNING,
            'Admin updated user profile',
            {
                adminId: request.user.id,
                targetUserId: userId,
                updatedFields: Object.keys(parsedBody),
                hasProfileUpdate: !!parsedBody.profile,
                hasSubscriptionUpdate: !!parsedBody.subscription,
                hasWalletUpdate: !!parsedBody.wallet,
                hasPhaseUpdate: !!parsedBody.phase,
            },
            false
        );

        return NextResponse.json({
            profile,
            subscription,
            wallet,
            networkEarnings,
            phase: phase.data,
            rewards: rewards.data && rewards.data.length > 0 ? rewards.data[0] : null,
        });
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('API error:', error);
        }
        // Provide clearer feedback when admin env is not configured
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
            return NextResponse.json(
                { error: 'Environment configuration missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
});

/**
 * DELETE /api/admin/users/[id]
 * Delete user account
 * Requires: manage_users permission
 */
export const DELETE = withAdminPermission('manage_users', async (request, context) => {
    try {
        // ✅ SECURITY: Validate CSRF token
        const csrfError = await requireCsrfToken(request);
        if (csrfError) return csrfError;

        const { id: userId } = await context!.params;

        // ✅ SECURITY: Validate UUID format to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        // Use admin client to bypass RLS
        const supabaseAdmin = getAdminClient();

        // First, get user profile to find avatar URL
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        // Delete avatar from storage if exists
        if (profile?.avatar_url) {
            const storagePath = extractStoragePathFromUrl(profile.avatar_url);
            if (storagePath) {
                const { error: storageError } = await supabaseAdmin.storage
                    .from('avatars')
                    .remove([storagePath]);

                if (storageError && process.env.NODE_ENV !== 'production') {
                    console.warn('Avatar delete warning:', storageError);
                }
            }
        }

        // Delete related data (cascading deletes should handle most, but we'll be explicit)
        // Note: Supabase RLS and foreign key constraints should handle cascading deletes
        // for subscriptions, wallet_transactions, network_earnings, etc.

        // Delete from profiles table
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Profile delete error:', profileError);
            }
            return NextResponse.json(
                { error: `Error deleting profile: ${profileError.message}` },
                { status: 400 }
            );
        }

        // Delete from auth (this will also trigger any auth-related cascades)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Auth delete error:', authError);
            }
            return NextResponse.json(
                { error: `Error deleting user: ${authError.message}` },
                { status: 400 }
            );
        }

        // ✅ SECURITY: Audit log for user deletion (CRITICAL action)
        await SecurityAuditLogger.log(
            SecurityEventType.ADMIN_ACTION,
            SecurityEventSeverity.CRITICAL,
            'Admin deleted user account',
            {
                deletedUserId: userId,
                hadAvatar: !!profile?.avatar_url,
            },
            false
        );

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('API error:', error);
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
});

/**
 * GET /api/admin/users/[id]
 * Get user details by ID
 * Requires: manage_users permission
 */
export const GET = withAdminPermission('manage_users', async (_request, context) => {
    try {
        const { id: userId } = await context!.params;

        // ✅ SECURITY: Validate UUID format to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        // Use admin client to bypass RLS for fetching user data
        const supabaseAdmin = getAdminClient();

        const [{ data, error }, subscription, wallet, networkEarnings, phase, rewards, directReferralsResult] = await Promise.all([
            supabaseAdmin.from('profiles').select(`
                *,
                role_name:roles(name)
            `).eq('id', userId).single(),
            new SubscriptionRepository(supabaseAdmin).findByUserId(userId),
            new WalletService(supabaseAdmin).getBalance(userId),
            new NetworkEarningsRepository(supabaseAdmin).fetchAvailableSummary(userId),
            supabaseAdmin.from('phases').select('*').eq('user_id', userId).maybeSingle(),
            supabaseAdmin.rpc('get_active_phase_rewards', { p_user_id: userId }),
            // Count direct referrals for this user
            supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId),
        ]);

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'User not found' },
                    { status: 404 }
                );
            }
            // ✅ SECURITY: Don't expose internal error details in production
            console.error('[Admin Users] Error fetching user:', error);
            return NextResponse.json(
                { error: 'Error fetching user' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            profile: data,
            subscription,
            wallet,
            networkEarnings,
            phase: phase.data,
            rewards: rewards.data && rewards.data.length > 0 ? rewards.data[0] : null,
            directReferrals: directReferralsResult.count ?? 0,
        });
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('API error:', error);
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
});
