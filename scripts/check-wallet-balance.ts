import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWalletBalance() {
  const userId = 'ce4494a0-72b6-42ca-a93b-7adb8d8fdce7';
  
  console.log(`Checking wallet balance for user: ${userId}`);
  
  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching wallet:', error);
    return;
  }
  
  if (!wallet) {
    console.log('No wallet found for user');
    return;
  }
  
  console.log('Wallet data:', wallet);
  console.log(`Balance: ${wallet.balance_cents} cents ($${wallet.balance_cents / 100})`);
  console.log(`Required: 6500 cents ($65)`);
  console.log(`Sufficient: ${wallet.balance_cents >= 6500 ? 'YES' : 'NO'}`);
}

checkWalletBalance().catch(console.error);

