import { NextResponse } from 'next/server';
import { createWalletService } from '@/modules/multilevel/factories/wallet-service-factory';
import { createProfileSummaryService } from '@/modules/profile/factories/profile-summary-service-factory';
import { withAuth } from '@/lib/auth/with-auth';

export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;
  const walletService = createWalletService();
  const profileService = createProfileSummaryService();

  try {
    const [balance, transactions, summary] = await Promise.all([
      walletService.getBalance(userId),
      walletService.listTransactions(userId, 100),
      profileService.getSummary(userId),
    ]);

    return NextResponse.json({ 
      balance, 
      transactions,
      networkEarnings: summary.networkEarnings,
      payoutAccount: summary.payoutAccount,
    });
  } catch (error) {
    console.error('Failed to load wallet transactions', error);
    return NextResponse.json({ error: 'Failed to load wallet transactions' }, { status: 500 });
  }
});
