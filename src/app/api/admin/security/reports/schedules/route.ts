/**
 * Security Report Schedules API
 *
 * Manage scheduled security reports
 */

import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/security/reports/schedules
 * Get all active security report schedules
 * Requires: manage_security permission
 */
export const GET = withAdminPermission('manage_security', async () => {
  try {
    const supabase = createAdminClient();

    const { data: schedules, error } = await supabase
      .from('security_report_schedules')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ schedules: [] });
      }
      console.error('[SecurityReportsAPI] Error fetching schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedules: schedules || [] });
  } catch (error) {
    console.error('[SecurityReportsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
});
