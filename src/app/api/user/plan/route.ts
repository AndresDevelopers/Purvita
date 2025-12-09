import { NextResponse } from 'next/server';
import { getUserPlan } from '@/lib/services/plan-service';
import { createClient } from '@/lib/supabase/server';
import { getUserPermissions } from '@/lib/services/permission-service';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const plan = await getUserPlan(user.id);
        
        // Fetch subscription type and status
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('subscription_type, status')
            .eq('user_id', user.id)
            .maybeSingle();

        // Check if user has admin access
        const userPermissions = await getUserPermissions(user.id);
        const isAdmin = userPermissions?.permissions.includes('access_admin_panel') ?? false;

        return NextResponse.json({ 
            plan,
            subscriptionType: subscription?.subscription_type ?? 'mlm',
            subscriptionStatus: subscription?.status ?? null,
            isAdmin,
        });
    } catch (error) {
        console.error('Error fetching user plan:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
