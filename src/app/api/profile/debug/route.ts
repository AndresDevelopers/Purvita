import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/auth/with-auth';

export const GET = withAdminAuth<any>(async (req: NextRequest) => {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId query parameter' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const client = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, any> = {};

    // Check profile
    try {
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        results.profile = { data, error: error?.message };
    } catch (err) {
        results.profile = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    // Check wallet
    try {
        const { data, error } = await client
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        results.wallet = { data, error: error?.message };
    } catch (err) {
        results.wallet = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    // Check phase
    try {
        const { data, error } = await client
            .from('phases')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        results.phase = { data, error: error?.message };
    } catch (err) {
        results.phase = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    // Check subscription
    try {
        const { data, error } = await client
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        results.subscription = { data, error: error?.message };
    } catch (err) {
        results.subscription = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    // Check network commissions
    try {
        const { data, error } = await client
            .from('network_commissions')
            .select('*')
            .eq('user_id', userId);
        results.networkCommissions = { data, error: error?.message, count: data?.length };
    } catch (err) {
        results.networkCommissions = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    // Check orders
    try {
        const { data, error } = await client
            .from('orders')
            .select('*')
            .eq('user_id', userId);
        results.orders = { data, error: error?.message, count: data?.length };
    } catch (err) {
        results.orders = { error: err instanceof Error ? err.message : 'Unknown error' };
    }

    return NextResponse.json({
        userId,
        timestamp: new Date().toISOString(),
        results,
    });
});
