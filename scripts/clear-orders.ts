#!/usr/bin/env ts-node
/**
 * Clear all orders from the database
 * Usage: ts-node scripts/clear-orders.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearOrders() {
  console.log('🗑️  Clearing all orders...')

  // Delete in order of dependencies
  const { error: riderEventsError } = await supabase
    .from('rider_events')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (riderEventsError) {
    console.error('Error deleting rider_events:', riderEventsError)
  } else {
    console.log('✅ Cleared rider_events')
  }

  const { error: asmEventsError } = await supabase
    .from('asm_events')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (asmEventsError) {
    console.error('Error deleting asm_events:', asmEventsError)
  } else {
    console.log('✅ Cleared asm_events')
  }

  const { error: depositOrdersError } = await supabase
    .from('deposit_orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (depositOrdersError) {
    console.error('Error deleting deposit_orders:', depositOrdersError)
  } else {
    console.log('✅ Cleared deposit_orders')
  }

  const { error: depositsError } = await supabase
    .from('deposits')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (depositsError) {
    console.error('Error deleting deposits:', depositsError)
  } else {
    console.log('✅ Cleared deposits')
  }

  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (ordersError) {
    console.error('Error deleting orders:', ordersError)
    process.exit(1)
  }

  console.log('✅ Cleared all orders')
  console.log('✨ Database cleared successfully!')
}

clearOrders().catch(console.error)

