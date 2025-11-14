#!/usr/bin/env ts-node
/**
 * Demo flow script to simulate a complete COD order lifecycle
 * Usage: ts-node scripts/demo-flow.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function demoFlow() {
  console.log('🎬 Starting demo flow...\n')

  // 1. Create order
  console.log('1. Creating order...')
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: `ORD-DEMO-${Date.now()}`,
      store_id: 'STORE-DEMO',
      store_name: 'Demo Store',
      customer_name: 'Demo Customer',
      customer_phone: '+911234567890',
      payment_type: 'COD',
      cod_type: 'COD_HARD',
      order_amount: 2000.00,
      cod_amount: 2000.00,
      money_state: 'UNCOLLECTED',
      is_test: true,
      test_tag: 'demo-flow',
    })
    .select()
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    return
  }
  console.log(`✅ Order created: ${order.order_number}\n`)

  // 2. Rider collects
  console.log('2. Rider collecting cash...')
  const { data: riderEvent, error: riderError } = await supabase
    .from('rider_events')
    .insert({
      order_id: order.id,
      rider_id: 'RIDER-DEMO',
      rider_name: 'Demo Rider',
      event_type: 'COLLECTED',
      amount: order.cod_amount,
      notes: 'Cash collected from customer',
    })
    .select()
    .single()

  if (riderError) {
    console.error('Error creating rider event:', riderError)
    return
  }
  console.log(`✅ Cash collected by rider\n`)

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // 3. ASM handover
  console.log('3. ASM receiving handover...')
  const { data: asmEvent, error: asmError } = await supabase
    .from('asm_events')
    .insert({
      order_id: order.id,
      asm_id: 'ASM-DEMO',
      asm_name: 'Demo ASM',
      event_type: 'HANDOVER_TO_ASM',
      amount: order.cod_amount,
      notes: 'Hard cash received from rider',
    })
    .select()
    .single()

  if (asmError) {
    console.error('Error creating ASM event:', asmError)
    return
  }
  console.log(`✅ Cash handed over to ASM\n`)

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // 4. Create deposit
  console.log('4. Creating deposit...')
  const depositNumber = `DEP-DEMO-${Date.now()}`
  const { data: deposit, error: depositError } = await supabase
    .from('deposits')
    .insert({
      deposit_number: depositNumber,
      asm_id: 'ASM-DEMO',
      asm_name: 'Demo ASM',
      total_amount: order.cod_amount,
      deposit_date: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      metadata: { test_tag: 'demo-flow' },
    })
    .select()
    .single()

  if (depositError) {
    console.error('Error creating deposit:', depositError)
    return
  }

  // Link order to deposit
  await supabase.from('deposit_orders').insert({
    deposit_id: deposit.id,
    order_id: order.id,
    amount: order.cod_amount,
  })

  // Create deposit event
  await supabase.from('asm_events').insert({
    order_id: order.id,
    asm_id: 'ASM-DEMO',
    asm_name: 'Demo ASM',
    event_type: 'DEPOSITED',
    amount: order.cod_amount,
    notes: `Deposited via ${depositNumber}`,
    metadata: { deposit_id: deposit.id },
  })

  console.log(`✅ Deposit created: ${depositNumber}\n`)

  // 5. Verify final state
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order.id)
    .single()

  console.log('📊 Final Order State:')
  console.log(`   Order Number: ${finalOrder?.order_number}`)
  console.log(`   Money State: ${finalOrder?.money_state}`)
  console.log(`   Amount: ₹${finalOrder?.cod_amount}`)
  console.log(`   Rider: ${finalOrder?.rider_name}`)
  console.log(`   ASM: ${finalOrder?.asm_name}`)

  // Get timeline
  const { data: timeline } = await supabase.rpc('get_order_timeline', {
    p_order_id: order.id,
  })

  console.log(`\n📅 Timeline Events: ${timeline?.length || 0}`)

  console.log('\n✨ Demo flow completed!')
}

demoFlow().catch(console.error)

