#!/usr/bin/env ts-node
/**
 * Seed script to create sample data for development
 * Usage: ts-node scripts/seed.ts
 * 
 * Creates users with phone numbers only and orders with proper distribution:
 * - At least 5 orders in each state/category combination
 * - Additional random orders above the minimum
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Define all possible states
const COD_MONEY_STATES = [
  'UNCOLLECTED',
  'COLLECTED_BY_RIDER',
  'HANDOVER_TO_ASM',
  'PENDING_TO_DEPOSIT',
  'DEPOSITED',
  'RECONCILED',
  'RECONCILIATION_EXCEPTION',
  'REFUNDED',
  'CANCELLED',
] as const

const COD_TYPES = ['COD_HARD', 'COD_QR', 'CANCELLED', 'RTO'] as const

async function seed() {
  console.log('🌱 Starting seed...')

  // Create test users with phone numbers only
  const users = [
    {
      phone: '+919999000001',
      role: 'admin' as const,
      full_name: 'Admin User',
    },
    {
      phone: '+919999000002',
      role: 'finance' as const,
      full_name: 'Finance User',
    },
    {
      phone: '+919999000003',
      role: 'asm' as const,
      asm_id: 'ASM-001',
      full_name: 'ASM User',
    },
    {
      phone: '+919999000004',
      role: 'sm' as const,
      sm_id: 'SM-001',
      full_name: 'Supply Manager',
    },
    {
      phone: '+919999000005',
      role: 'rider' as const,
      rider_id: 'RIDER-001',
      full_name: 'Rider User',
    },
    {
      phone: '+918980226979',
      role: 'asm' as const,
      asm_id: 'ASM-002',
      full_name: 'ASM Phone User',
    },
  ]

  console.log('👤 Creating users...')
  for (const userData of users) {
    try {
      // Create auth user with phone
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: userData.phone,
        phone_confirm: true,
      })

      if (authError && !authError.message.includes('already registered')) {
        // Try to find existing user by phone
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users.find((u: any) => u.phone === userData.phone)
        
        if (existingUser) {
          // Update public.users table
          await supabase.from('users').upsert({
            id: existingUser.id,
            email: null,
            phone: userData.phone,
            role: userData.role,
            full_name: userData.full_name,
            rider_id: userData.rider_id || null,
            asm_id: userData.asm_id || null,
            sm_id: userData.sm_id || null,
            store_id: null,
          })
          console.log('✅ Updated user: ' + userData.phone)
        } else {
          console.error('Error creating user ' + userData.phone + ':', authError)
        }
        continue
      }

      if (authData?.user) {
        await supabase.from('users').upsert({
          id: authData.user.id,
          email: null,
          phone: userData.phone,
          role: userData.role,
          full_name: userData.full_name,
          rider_id: userData.rider_id || null,
          asm_id: userData.asm_id || null,
          sm_id: userData.sm_id || null,
          store_id: null,
        })
        console.log('✅ Created user: ' + userData.phone + ' (' + userData.role + ')')
      }
    } catch (err: any) {
      console.error('Error processing user ' + userData.phone + ':', err.message)
    }
  }

  // Create orders with proper distribution
  console.log('📦 Creating orders with proper distribution...')
  const orders: any[] = []
  const stores = ['STORE-001', 'STORE-002', 'STORE-003']
  const riders = ['RIDER-001', 'RIDER-002', 'RIDER-003']
  const asms = ['ASM-001', 'ASM-002']
  let orderCounter = 1

  // Helper to generate order number
  const getOrderNumber = (prefix: string) => {
    const num = orderCounter++
    const padded = num.toString().padStart(4, '0')
    return 'ORD-' + prefix + '-' + padded
  }

  // Helper to get random date in last 30 days
  const getRandomDate = () => {
    const daysAgo = Math.floor(Math.random() * 30)
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  }

  // Helper to generate random phone
  const getRandomPhone = () => {
    const num = Math.floor(Math.random() * 9000000000) + 1000000000
    return '+91' + num.toString()
  }

  // 1. PREPAID orders (15 total)
  console.log('  Creating PREPAID orders...')
  for (let i = 0; i < 15; i++) {
    const storeIdx = Math.floor(Math.random() * stores.length)
    orders.push({
      order_number: getOrderNumber('PREPAID'),
      store_id: stores[storeIdx],
      store_name: 'Store ' + stores[storeIdx],
      customer_name: 'Prepaid Customer ' + (i + 1),
      customer_phone: getRandomPhone(),
      payment_type: 'PREPAID',
      cod_type: null,
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: 0,
      money_state: 'NOT_APPLICABLE',
      rider_id: null,
      rider_name: null,
      asm_id: null,
      asm_name: null,
      is_test: false,
      created_at: getRandomDate(),
    })
  }

  // 2. COD orders - at least 5 in each combination
  console.log('  Creating COD orders with proper distribution...')
  
  for (const codType of COD_TYPES) {
    for (const moneyState of COD_MONEY_STATES) {
      // Create 5 orders for this combination
      for (let i = 0; i < 5; i++) {
        const rider = riders[Math.floor(Math.random() * riders.length)]
        const asm = moneyState !== 'UNCOLLECTED' && moneyState !== 'COLLECTED_BY_RIDER'
          ? asms[Math.floor(Math.random() * asms.length)]
          : null
        
        const createdAt = getRandomDate()
        const collectedAt = moneyState !== 'UNCOLLECTED' ? createdAt : null
        const handoverAt = ['HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(moneyState)
          ? new Date(new Date(createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
          : null
        const depositedAt = ['DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(moneyState)
          ? new Date(new Date(handoverAt || createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
          : null
        const reconciledAt = ['RECONCILED'].includes(moneyState)
          ? new Date(new Date(depositedAt || createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
          : null
        const cancelledAt = ['CANCELLED', 'REFUNDED'].includes(moneyState)
          ? new Date(new Date(createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
          : null

        const storeIdx = Math.floor(Math.random() * stores.length)
        orders.push({
          order_number: getOrderNumber(codType),
          store_id: stores[storeIdx],
          store_name: 'Store ' + stores[storeIdx],
          customer_name: codType + ' ' + moneyState + ' Customer ' + (i + 1),
          customer_phone: getRandomPhone(),
          payment_type: 'COD',
          cod_type: codType,
          order_amount: Math.floor(Math.random() * 5000) + 100,
          cod_amount: Math.floor(Math.random() * 5000) + 100,
          money_state: moneyState,
          rider_id: moneyState !== 'UNCOLLECTED' ? rider : null,
          rider_name: moneyState !== 'UNCOLLECTED' ? ('Rider ' + rider) : null,
          asm_id: asm,
          asm_name: asm ? ('ASM ' + asm) : null,
          collected_at: collectedAt,
          handover_to_asm_at: handoverAt,
          deposited_at: depositedAt,
          reconciled_at: reconciledAt,
          cancelled_at: cancelledAt,
          is_test: false,
          created_at: createdAt,
        })
      }
    }
  }

  // 3. Add random COD orders (50 more)
  console.log('  Adding random COD orders...')
  for (let i = 0; i < 50; i++) {
    const codType = COD_TYPES[Math.floor(Math.random() * COD_TYPES.length)]
    const moneyState = COD_MONEY_STATES[Math.floor(Math.random() * COD_MONEY_STATES.length)]
    const rider = riders[Math.floor(Math.random() * riders.length)]
    const asm = moneyState !== 'UNCOLLECTED' && moneyState !== 'COLLECTED_BY_RIDER'
      ? asms[Math.floor(Math.random() * asms.length)]
      : null

    const createdAt = getRandomDate()
    const collectedAt = moneyState !== 'UNCOLLECTED' ? createdAt : null
    const handoverAt = ['HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(moneyState)
      ? new Date(new Date(createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
      : null
    const depositedAt = ['DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(moneyState)
      ? new Date(new Date(handoverAt || createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
      : null
    const reconciledAt = ['RECONCILED'].includes(moneyState)
      ? new Date(new Date(depositedAt || createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
      : null
    const cancelledAt = ['CANCELLED', 'REFUNDED'].includes(moneyState)
      ? new Date(new Date(createdAt).getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
      : null

    const storeIdx = Math.floor(Math.random() * stores.length)
    orders.push({
      order_number: getOrderNumber('RANDOM'),
      store_id: stores[storeIdx],
      store_name: 'Store ' + stores[storeIdx],
      customer_name: 'Random Customer ' + (i + 1),
      customer_phone: getRandomPhone(),
      payment_type: 'COD',
      cod_type: codType,
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: Math.floor(Math.random() * 5000) + 100,
      money_state: moneyState,
      rider_id: moneyState !== 'UNCOLLECTED' ? rider : null,
      rider_name: moneyState !== 'UNCOLLECTED' ? ('Rider ' + rider) : null,
      asm_id: asm,
      asm_name: asm ? ('ASM ' + asm) : null,
      collected_at: collectedAt,
      handover_to_asm_at: handoverAt,
      deposited_at: depositedAt,
      reconciled_at: reconciledAt,
      cancelled_at: cancelledAt,
      is_test: false,
      created_at: createdAt,
    })
  }

  // Insert orders in batches
  console.log('  Inserting ' + orders.length + ' orders...')
  const batchSize = 100
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const { error: ordersError } = await supabase.from('orders').insert(batch)
    if (ordersError) {
      console.error('Error creating orders batch ' + batchNum + ':', ordersError)
    } else {
      console.log('  ✅ Inserted batch ' + batchNum + ' (' + batch.length + ' orders)')
    }
  }

  console.log('✨ Seed completed!')
  console.log('\n📊 Summary:')
  console.log('  - Users: ' + users.length)
  console.log('  - Orders: ' + orders.length)
  const prepaidCount = orders.filter((o: any) => o.payment_type === 'PREPAID').length
  const codCount = orders.filter((o: any) => o.payment_type === 'COD').length
  console.log('    - PREPAID: ' + prepaidCount)
  console.log('    - COD: ' + codCount)
  console.log('\n📱 Login with phone numbers:')
  users.forEach((u: any) => {
    console.log('  ' + u.full_name + ': ' + u.phone)
  })
}

seed().catch(console.error)
