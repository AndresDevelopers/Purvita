/**
 * Script to check if a user's sponsor has reached their team capacity limit
 * 
 * Usage:
 * npx tsx scripts/check-sponsor-capacity.ts <user-id>
 * 
 * Example:
 * npx tsx scripts/check-sponsor-capacity.ts ce4494a0-72b6-42ca-a93b-7adb8d8fdce7
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSponsorCapacity(userId: string) {
  console.log('='.repeat(80));
  console.log('SPONSOR CAPACITY CHECK');
  console.log('='.repeat(80));
  console.log(`User ID: ${userId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log();

  // 1. Get user's network info
  console.log('1. USER NETWORK INFO');
  console.log('-'.repeat(80));
  const { data: network, error: networkError } = await supabase
    .from('networks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (networkError) {
    console.error('❌ Error fetching network info:', networkError.message);
    return;
  }

  if (!network) {
    console.log('⚠️  User has no network record (not part of MLM structure)');
    console.log('   This user can subscribe without sponsor capacity restrictions');
    return;
  }

  console.log('✅ Network record found:');
  console.log(`   Sponsor ID: ${network.sponsor_id || 'None (root user)'}`);
  console.log(`   Level: ${network.level}`);
  console.log(`   Created: ${network.created_at}`);
  console.log();

  if (!network.sponsor_id) {
    console.log('✅ User has no sponsor (root user)');
    console.log('   No capacity restrictions apply');
    return;
  }

  // 2. Get sponsor's subscription
  console.log('2. SPONSOR SUBSCRIPTION');
  console.log('-'.repeat(80));
  const { data: sponsorSub, error: sponsorSubError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', network.sponsor_id)
    .maybeSingle();

  if (sponsorSubError) {
    console.error('❌ Error fetching sponsor subscription:', sponsorSubError.message);
    return;
  }

  if (!sponsorSub) {
    console.log('⚠️  Sponsor has no subscription');
    console.log('   Default capacity limits may apply');
  } else {
    console.log('✅ Sponsor subscription found:');
    console.log(`   Status: ${sponsorSub.status}`);
    console.log(`   Gateway: ${sponsorSub.gateway || 'N/A'}`);
    console.log(`   Period End: ${sponsorSub.current_period_end || 'N/A'}`);
  }
  console.log();

  // 3. Get sponsor's phase
  console.log('3. SPONSOR PHASE');
  console.log('-'.repeat(80));
  const { data: sponsorPhase, error: sponsorPhaseError } = await supabase
    .from('phases')
    .select('*')
    .eq('user_id', network.sponsor_id)
    .maybeSingle();

  if (sponsorPhaseError) {
    console.error('❌ Error fetching sponsor phase:', sponsorPhaseError.message);
  } else if (!sponsorPhase) {
    console.log('⚠️  Sponsor has no phase record (Phase 0)');
  } else {
    console.log('✅ Sponsor phase found:');
    console.log(`   Phase: ${sponsorPhase.phase}`);
    console.log(`   Updated: ${sponsorPhase.updated_at}`);
  }
  console.log();

  // 4. Count sponsor's direct team members
  console.log('4. SPONSOR TEAM COUNT');
  console.log('-'.repeat(80));
  const { data: teamMembers, error: teamError } = await supabase
    .from('networks')
    .select('user_id, created_at')
    .eq('sponsor_id', network.sponsor_id);

  if (teamError) {
    console.error('❌ Error counting team members:', teamError.message);
  } else {
    const teamCount = teamMembers?.length || 0;
    console.log(`✅ Sponsor has ${teamCount} direct team member(s)`);
    
    if (teamMembers && teamMembers.length > 0) {
      console.log('   Team members:');
      teamMembers.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.user_id} (joined ${new Date(member.created_at).toLocaleDateString()})`);
      });
    }
  }
  console.log();

  // 5. Determine capacity limit
  console.log('5. CAPACITY ANALYSIS');
  console.log('-'.repeat(80));
  
  const currentPhase = sponsorPhase?.phase || 0;
  const teamCount = teamMembers?.length || 0;
  
  // Phase-based capacity limits (adjust these based on your business rules)
  const capacityLimits: Record<number, number> = {
    0: 2,   // Phase 0: max 2 direct members
    1: 5,   // Phase 1: max 5 direct members
    2: 10,  // Phase 2: max 10 direct members
    3: 20,  // Phase 3: max 20 direct members
    4: 50,  // Phase 4: max 50 direct members
    5: 100, // Phase 5: max 100 direct members
  };

  const maxAllowed = capacityLimits[currentPhase] || 2;
  const canAddMore = teamCount < maxAllowed;
  const remaining = maxAllowed - teamCount;

  console.log(`Sponsor Phase: ${currentPhase}`);
  console.log(`Current Team Size: ${teamCount}`);
  console.log(`Maximum Allowed: ${maxAllowed}`);
  console.log(`Remaining Slots: ${remaining}`);
  console.log();

  if (canAddMore) {
    console.log(`✅ CAPACITY AVAILABLE`);
    console.log(`   Your sponsor can accept ${remaining} more team member(s)`);
    console.log(`   You CAN subscribe and join their team`);
  } else {
    console.log(`❌ CAPACITY LIMIT REACHED`);
    console.log(`   Your sponsor has reached their team capacity limit`);
    console.log(`   You CANNOT subscribe until:`);
    console.log(`   1. Your sponsor upgrades to a higher phase, OR`);
    console.log(`   2. You change your sponsor (contact support)`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('END OF CAPACITY CHECK');
  console.log('='.repeat(80));
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/check-sponsor-capacity.ts <user-id>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/check-sponsor-capacity.ts ce4494a0-72b6-42ca-a93b-7adb8d8fdce7');
  process.exit(1);
}

checkSponsorCapacity(userId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

