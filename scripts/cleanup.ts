#!/usr/bin/env ts-node
/**
 * Cleanup script to remove test data
 * Usage: ts-node scripts/cleanup.ts [test_tag]
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const testTag = process.argv[2]

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
  console.log('🧹 Starting cleanup...')

  // Build query
  let query = supabase
    .from('orders')
    .select('id')
    .eq('is_test', true)

  if (testTag) {
    query = query.eq('test_tag', testTag)
    console.log(`Cleaning up test data with tag: ${testTag}`)
  } else {
    console.log('Cleaning up ALL test data')
  }

  const { data: orders, error: ordersError } = await query

  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
    process.exit(1)
  }

  if (!orders || orders.length === 0) {
    console.log('No test orders found')
    return
  }

  const orderIds = orders.map((o) => o.id)
  console.log(`Found ${orderIds.length} test orders`)

  // Delete related records
  console.log('Deleting rider events...')
  await supabase.from('rider_events').delete().in('order_id', orderIds)

  console.log('Deleting ASM events...')
  await supabase.from('asm_events').delete().in('order_id', orderIds)

  console.log('Deleting deposit orders...')
  await supabase.from('deposit_orders').delete().in('order_id', orderIds)

  console.log('Deleting orders...')
  await supabase.from('orders').delete().in('id', orderIds)

  // Delete test deposits
  if (testTag) {
    const { data: deposits } = await supabase
      .from('deposits')
      .select('id')
      .contains('metadata', { test_tag: testTag })

    if (deposits && deposits.length > 0) {
      const depositIds = deposits.map((d) => d.id)
      console.log(`Deleting ${depositIds.length} test deposits...`)
      await supabase.from('deposit_orders').delete().in('deposit_id', depositIds)
      await supabase.from('deposits').delete().in('id', depositIds)
    }
  }

  console.log('✅ Cleanup completed!')
}

cleanup().catch(console.error)

