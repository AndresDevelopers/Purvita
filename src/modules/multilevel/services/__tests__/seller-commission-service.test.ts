import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SellerCommissionService } from '../seller-commission-service';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock dependencies
vi.mock('@/lib/helpers/settings-helper', () => ({
  getPhaseCommissionRate: vi.fn((phase: number) => {
    const rates: Record<number, number> = {
      0: 0.08,
      1: 0.15,
      2: 0.30,
      3: 0.40,
    };
    return Promise.resolve(rates[phase] ?? 0);
  }),
}));

vi.mock('../wallet-service', () => ({
  WalletService: vi.fn().mockImplementation(() => ({
    addFunds: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('SellerCommissionService', () => {
  let mockClient: SupabaseClient;
  let service: SellerCommissionService;

  beforeEach(() => {
    // Create mock Supabase client
    mockClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    } as any as SupabaseClient;

    service = new SellerCommissionService(mockClient);
  });

  describe('calculateAndApplySellerCommission', () => {
    it('should calculate and apply commission for Phase 2 seller', async () => {
      // Mock seller phase data
      (mockClient.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { phase: 2 },
          error: null,
        }),
      });

      // Mock active subscription
      const fromSpy = vi.spyOn(mockClient, 'from');
      fromSpy.mockImplementation((table: string) => {
        if (table === 'phases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phase: 2 },
              error: null,
            }),
          } as any;
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'active', waitlisted: false },
              error: null,
            }),
          } as any;
        }
        return mockClient;
      });

      const affiliateId = 'seller-123';
      const totalCents = 10000; // $100
      const orderId = 'order-456';

      const commissionCents = await service.calculateAndApplySellerCommission(
        affiliateId,
        totalCents,
        orderId
      );

      // Phase 2 commission rate is 30%
      expect(commissionCents).toBe(3000); // $30
    });

    it('should return 0 for seller without active subscription', async () => {
      const fromSpy = vi.spyOn(mockClient, 'from');
      fromSpy.mockImplementation((table: string) => {
        if (table === 'phases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phase: 2 },
              error: null,
            }),
          } as any;
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'unpaid', waitlisted: false },
              error: null,
            }),
          } as any;
        }
        return mockClient;
      });

      const commissionCents = await service.calculateAndApplySellerCommission(
        'seller-123',
        10000,
        'order-456'
      );

      expect(commissionCents).toBe(0);
    });

    it('should return 0 for waitlisted seller', async () => {
      const fromSpy = vi.spyOn(mockClient, 'from');
      fromSpy.mockImplementation((table: string) => {
        if (table === 'phases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { phase: 2 },
              error: null,
            }),
          } as any;
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'active', waitlisted: true },
              error: null,
            }),
          } as any;
        }
        return mockClient;
      });

      const commissionCents = await service.calculateAndApplySellerCommission(
        'seller-123',
        10000,
        'order-456'
      );

      expect(commissionCents).toBe(0);
    });

    it('should return 0 for invalid parameters', async () => {
      const commissionCents1 = await service.calculateAndApplySellerCommission(
        '',
        10000,
        'order-456'
      );
      expect(commissionCents1).toBe(0);

      const commissionCents2 = await service.calculateAndApplySellerCommission(
        'seller-123',
        0,
        'order-456'
      );
      expect(commissionCents2).toBe(0);

      const commissionCents3 = await service.calculateAndApplySellerCommission(
        'seller-123',
        -100,
        'order-456'
      );
      expect(commissionCents3).toBe(0);
    });

    it('should calculate correct commission for different phases', async () => {
      const testCases = [
        { phase: 0, expectedRate: 0.08, expectedCommission: 800 },  // 8%
        { phase: 1, expectedRate: 0.15, expectedCommission: 1500 }, // 15%
        { phase: 2, expectedRate: 0.30, expectedCommission: 3000 }, // 30%
        { phase: 3, expectedRate: 0.40, expectedCommission: 4000 }, // 40%
      ];

      for (const testCase of testCases) {
        const fromSpy = vi.spyOn(mockClient, 'from');
        fromSpy.mockImplementation((table: string) => {
          if (table === 'phases') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { phase: testCase.phase },
                error: null,
              }),
            } as any;
          }
          if (table === 'subscriptions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { status: 'active', waitlisted: false },
                error: null,
              }),
            } as any;
          }
          return mockClient;
        });

        const commissionCents = await service.calculateAndApplySellerCommission(
          'seller-123',
          10000, // $100
          'order-456'
        );

        expect(commissionCents).toBe(testCase.expectedCommission);
      }
    });

    it('should handle database errors gracefully', async () => {
      const fromSpy = vi.spyOn(mockClient, 'from');
      fromSpy.mockImplementation((table: string) => {
        if (table === 'phases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          } as any;
        }
        return mockClient;
      });

      const commissionCents = await service.calculateAndApplySellerCommission(
        'seller-123',
        10000,
        'order-456'
      );

      expect(commissionCents).toBe(0);
    });
  });
});

