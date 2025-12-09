import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentWalletService } from '@/modules/payment-wallets/services/payment-wallet-service';
import { requireCsrfToken } from '@/lib/security/csrf-protection';
import { z } from 'zod';

// ✅ SECURITY: Validate payment proof request with strict schema
const PaymentProofSchema = z.object({
  proofUrl: z
    .string()
    .url('Invalid URL format')
    .min(1, 'Proof URL is required')
    .max(2048, 'URL is too long')
    .refine(
      (url) => {
        // ✅ SECURITY: Block dangerous protocols
        const dangerousPatterns = [
          /^javascript:/i,
          /^data:/i,
          /^vbscript:/i,
          /^file:/i,
          /^about:/i,
        ];
        return !dangerousPatterns.some((pattern) => pattern.test(url));
      },
      { message: 'Invalid URL protocol. Only HTTP(S) URLs are allowed.' }
    )
    .refine(
      (url) => {
        // ✅ SECURITY: Ensure URL is properly formatted and uses HTTP(S)
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL must use HTTP or HTTPS protocol.' }
    )
    .transform((url) => {
      // ✅ SECURITY: Sanitize URL by reconstructing it
      try {
        const urlObj = new URL(url.trim());
        // Reconstruct to remove potential XSS in fragments
        return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
      } catch {
        return url.trim();
      }
    }),
  transactionHash: z.string().max(256).optional(),
});

/**
 * PATCH /api/payment-requests/[id]/proof
 * Upload payment proof for a request
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ SECURITY: Validate CSRF token to prevent CSRF attacks
    const csrfError = await requireCsrfToken(req);
    if (csrfError) {
      return csrfError;
    }

    const { id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // ✅ SECURITY: Validate and sanitize payment proof data
    const validatedData = PaymentProofSchema.parse(body);
    const { proofUrl, transactionHash } = validatedData;

    const service = new PaymentWalletService(supabase);
    const request = await service.updatePaymentProof(
      id,
      user.id,
      proofUrl,
      transactionHash
    );

    return NextResponse.json({ request });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to update payment proof:', error);
    }

    // ✅ SECURITY: Handle validation errors with specific messages
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to update payment proof';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
