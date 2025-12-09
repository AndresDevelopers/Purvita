import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionCommissionService } from '../subscription-commission-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionRecord } from '../../domain/types';

// Mock app settings
vi.mock('@/modules/app-settings/services/app-settings-service', () => ({
  getAppSettings: vi.fn().mockResolvedValue({
    maxMembersPerLevel: [
      { level: 1, maxMembers: 5 },
      { level: 2, maxMembers: 25 },
      { level: 3, maxMembers: 125 },
    ],
    currency: 'USD',
  }),
}));

// Mock Sentry logger
vi.mock('../../../observability/services/sentry-logger', () => ({
  SentryLogger: {
    captureCommissionError: vi.fn(),
  },
}));

describe('SubscriptionCommissionService', () => {
  let service: SubscriptionCommissionService;
  let mockClient: SupabaseClient;

  beforeEach(() => {
    // Create mock Supabase client
    mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    } as unknown as SupabaseClient;

    service = new SubscriptionCommissionService(mockClient);
  });

  describe('processSubscriptionCommission', () => {
    it('should skip processing if subscription is not active', async () => {
      const subscription: any = {
        id: 'sub-1',
        user_id: 'user-1',
        status: 'unpaid',
        current_period_end: null,
        gateway: 'stripe',
        cancel_at_period_end: false,
        created_at: '2025-01-01T00:00:00Z',
        default_payment_method_id: null,
      };

      const result = await service.processSubscriptionCommission(subscription, false);

      expect(result).toEqual([]);
    });

    it('should skip processing if subscription was already active', async () => {
      const subscription: any = {
        id: 'sub-1',
        user_id: 'user-1',
        status: 'active',
        current_period_end: null,
        gateway: 'stripe',
        cancel_at_period_end: false,
        created_at: '2025-01-01T00:00:00Z',
        default_payment_method_id: null,
      };

      const result = await service.processSubscriptionCommission(subscription, true);

      expect(result).toEqual([]);
    });

    it('should process commissions for active subscription with upline', async () => {
      const subscription: any = {
        id: 'sub-1',
        user_id: 'user-1',
        status: 'active',
        current_period_end: null,
        gateway: 'stripe',
        cancel_at_period_end: false,
        created_at: '2025-01-01T00:00:00Z',
        default_payment_method_id: null,
      };

      // Mock upline chain: user-1 -> sponsor-1 -> sponsor-2
      mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (value === 'user-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-1' },
                    error: null,
                  }),
                };
              }
              if (value === 'sponsor-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-2' },
                    error: null,
                  }),
                };
              }
              if (value === 'sponsor-2') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: null },
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          };
        }
        
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              // Both sponsors have active subscriptions
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: 'active' },
                  error: null,
                }),
              };
            }),
          };
        }
        
        if (table === 'network_commissions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'commission-1' },
              error: null,
            }),
          };
        }
        
        return mockClient;
      });

      const result = await service.processSubscriptionCommission(subscription, false);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'sponsor-1',
        memberId: 'user-1',
        level: 1,
        amountCents: 1500,
      });
      expect(result[1]).toEqual({
        userId: 'sponsor-2',
        memberId: 'user-1',
        level: 2,
        amountCents: 1000,
      });
    });

    it('should skip sponsors without active subscriptions', async () => {
      const subscription: any = {
        id: 'sub-1',
        user_id: 'user-1',
        status: 'active',
        current_period_end: null,
        gateway: 'stripe',
        cancel_at_period_end: false,
        created_at: '2025-01-01T00:00:00Z',
        default_payment_method_id: null,
      };

      // Mock upline chain where sponsor-2 doesn't have active subscription
      mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (value === 'user-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-1' },
                    error: null,
                  }),
                };
              }
              if (value === 'sponsor-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-2' },
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          };
        }
        
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (value === 'sponsor-1') {
                // sponsor-1 has active subscription
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: 'active' },
                    error: null,
                  }),
                };
              }
              if (value === 'sponsor-2') {
                // sponsor-2 doesn't have active subscription
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: 'unpaid' },
                    error: null,
                  }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          };
        }
        
        if (table === 'network_commissions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'commission-1' },
              error: null,
            }),
          };
        }
        
        return mockClient;
      });

      const result = await service.processSubscriptionCommission(subscription, false);

      // Only sponsor-1 should receive commission
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: 'sponsor-1',
        memberId: 'user-1',
        level: 1,
        amountCents: 1500,
      });
    });

    it('should skip sponsors who have reached member limits', async () => {
      const subscription: any = {
        id: 'sub-1',
        user_id: 'user-1',
        status: 'active',
        current_period_end: null,
        gateway: 'stripe',
        cancel_at_period_end: false,
        created_at: '2025-01-01T00:00:00Z',
        default_payment_method_id: null,
      };

      // Mock upline chain where sponsor-1 has reached member limit
      mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (value === 'user-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-1' },
                    error: null,
                  }),
                };
              }
              if (value === 'sponsor-1') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { sponsor_id: 'sponsor-2' },
                    error: null,
                  }),
                };
              }
              // For member counting - sponsor-1 has 5/5 members (limit reached)
              if (field === 'sponsor_id' && value === 'sponsor-1') {
                return {
                  select: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockReturnThis(),
                  count: 5, // Has reached the limit of 5 members
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
            in: vi.fn().mockReturnThis(),
          };
        }

        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              // Both sponsors have active subscriptions
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: 'active' },
                  error: null,
                }),
              };
            }),
          };
        }

        return mockClient;
      });

      // Mock the member counting to return 5 (at limit)
      const countSpy = vi.spyOn(mockClient, 'from').mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            count: vi.fn().mockResolvedValue({ count: 5, error: null }), // At limit
          } as any;
        }
        return mockClient.from(table);
      });

      const result = await service.processSubscriptionCommission(subscription, false);

      // No commissions should be created due to member limits
      expect(result).toHaveLength(0);
    });
  });

  describe('wasSubscriptionPreviouslyActive', () => {
    it('should return true if user has recent subscription commissions', async () => {
      mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'network_commissions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'commission-1' },
              error: null,
            }),
          };
        }
        return mockClient;
      });

      const result = await service.wasSubscriptionPreviouslyActive('user-1');

      expect(result).toBe(true);
    });

    it('should return false if user has no recent subscription commissions', async () => {
      mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'network_commissions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return mockClient;
      });

      const result = await service.wasSubscriptionPreviouslyActive('user-1');

      expect(result).toBe(false);
    });
  });
});
