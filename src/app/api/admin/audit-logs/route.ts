import { NextRequest, NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { decryptIP } from '@/lib/security/ip-encryption';
import { z } from 'zod';

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filters and pagination
 * Requires: view_audit_logs permission
 */

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  user_id: z.string().uuid().optional(),
  search: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9_\-\s@.]*$/)
    .optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  decrypt_ips: z.enum(['true', 'false']).transform(val => val === 'true').default('false'),
});

export const GET = withAdminPermission('view_audit_logs', async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const queryResult = QuerySchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      action: searchParams.get('action') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      user_id: searchParams.get('user_id') || undefined,
      search: searchParams.get('search') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      decrypt_ips: searchParams.get('decrypt_ips') || 'false',
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.errors },
        { status: 400 }
      );
    }

    const { page, limit, action, entity_type, user_id, search, start_date, end_date, decrypt_ips } = queryResult.data;
    const offset = (page - 1) * limit;

    const supabase = getAdminClient();

    // Build query - fetch audit logs without JOIN first
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }

    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Search in action, entity_type, or metadata
    if (search) {
      query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('[API] Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    // Get unique user IDs from logs
    const userIds = [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])];

    // Fetch user profiles separately
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Merge profiles with logs
    let processedLogs = (logs || []).map(log => ({
      ...log,
      profiles: log.user_id ? profilesMap[log.user_id] || null : null,
    }));

    // Decrypt IPs if requested
    if (decrypt_ips && processedLogs.length > 0) {
      processedLogs = await Promise.all(
        processedLogs.map(async (log) => {
          if (log.ip_address) {
            const decryptedIP = await decryptIP(log.ip_address);
            return {
              ...log,
              ip_address: decryptedIP || log.ip_address,
            };
          }
          return log;
        })
      );
    }

    return NextResponse.json({
      logs: processedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('[API] Error in GET /api/admin/audit-logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

