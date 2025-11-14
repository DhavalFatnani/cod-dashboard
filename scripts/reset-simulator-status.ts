import { createClient } from '@supabase/supabase-js'

// Load environment variables from process.env (set by user or .env file)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  console.error('Set it as an environment variable or in a .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function resetSimulatorStatus() {
  console.log('Resetting simulator status...')
  
  const { data, error } = await supabase
    .from('feature_flags')
    .upsert({
      flag_key: 'simulator_status',
      flag_value: {
        running: false,
        test_tag: null,
      },
    }, {
      onConflict: 'flag_key',
    })
    .select()

  if (error) {
    console.error('Error resetting simulator status:', error)
    process.exit(1)
  }

  console.log('✓ Simulator status reset to stopped')
  console.log('Updated flag:', JSON.stringify(data, null, 2))
  
  // Verify
  const { data: verify } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('flag_key', 'simulator_status')
    .single()

  console.log('\nVerified status:', JSON.stringify(verify, null, 2))
}

resetSimulatorStatus()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

