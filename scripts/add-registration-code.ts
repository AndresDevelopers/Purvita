import { getServiceRoleClient } from '@/lib/supabase'

async function addRegistrationCode() {
  const client = getServiceRoleClient()

  if (!client) {
    console.error('❌ Supabase service role client is unavailable')
    console.error('Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env.local')
    process.exit(1)
  }

  const code = process.argv[2] || 'PURVITA-2025'
  const daysValid = parseInt(process.argv[3] || '30', 10)

  const validFrom = new Date()
  const validTo = new Date()
  validTo.setDate(validTo.getDate() + daysValid)

  console.log('📝 Adding registration code...')
  console.log(`   Code: ${code}`)
  console.log(`   Valid from: ${validFrom.toISOString()}`)
  console.log(`   Valid to: ${validTo.toISOString()}`)

  const { data, error } = await client
    .from('registration_access_codes')
    .insert({
      code,
      valid_from: validFrom.toISOString(),
      valid_to: validTo.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  console.log('✅ Registration code added successfully!')
  console.log('   ID:', data.id)
  console.log('\n🎉 You can now use this code to register:', code)
}

addRegistrationCode()
