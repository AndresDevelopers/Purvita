import { getSupabaseAdminClient } from '../infrastructure/supabase-admin-client';
import { WalletService } from '../services/wallet-service';

export const createWalletService = () => new WalletService(getSupabaseAdminClient());
