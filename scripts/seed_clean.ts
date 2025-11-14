#!/usr/bin/env ts-node
/**
 * Clean seed script with correct data model
 * - Cancelled orders: money_state = 'CANCELLED', cod_type = NULL (or original if COD)
 * - RTO orders: cod_type = 'RTO', money_state = 'CANCELLED'
 * - Active COD: cod_type IN ('COD_HARD', 'COD_QR'), money_state != 'CANCELLED'
 */

import { createClient } from '@supabase/supabase-js'

// Try to load environment variables from .env file if dotenv is available
try {
  const dotenv = require('dotenv')
  dotenv.config() // Try root .env
  dotenv.config({ path: './frontend/.env' }) // Try frontend .env
  dotenv.config({ path: './frontend/.env.local' }) // Try frontend .env.local
} catch (e) {
  // dotenv not installed, skip
}

// Also try to read from .env files directly (root and frontend)
const fs = require('fs')
const path = require('path')
const envFiles = [
  path.join(__dirname, '../.env'), // Root .env
  path.join(__dirname, '../frontend/.env'), // Frontend .env
  path.join(__dirname, '../frontend/.env.local'), // Frontend .env.local
]

envFiles.forEach(envPath => {
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^#=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '') // Remove quotes
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
      })
    }
  } catch (e) {
    // Ignore errors reading .env file
  }
})

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required')
  console.error('\nPlease set it as an environment variable:')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('\nOr create a .env file with:')
  console.error('  SUPABASE_URL=your_supabase_url')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('\nFor local Supabase, get the key with:')
  console.error('  supabase status')
  process.exit(1)
}

console.log(`🔗 Connecting to: ${supabaseUrl}`)

const supabase = createClient(supabaseUrl, supabaseKey)

const ACTIVE_COD_STATES = [
  'UNCOLLECTED',
  'COLLECTED_BY_RIDER',
  'HANDOVER_TO_ASM',
  'PENDING_TO_DEPOSIT',
  'DEPOSITED',
  'RECONCILED',
  'RECONCILIATION_EXCEPTION',
] as const

const COD_TYPES = ['COD_HARD', 'COD_QR'] as const

async function seed() {
  console.log('🌱 Starting clean seed...')

  const orders: any[] = []
  const stores = ['STORE-001', 'STORE-002', 'STORE-003']
  const riders = ['RIDER-001', 'RIDER-002']
  const asms = ['ASM-001', 'ASM-002']
  let orderCounter = 1

  const getOrderNumber = (prefix: string) => {
    const num = orderCounter++
    return `ORD-${prefix}-${num.toString().padStart(4, '0')}`
  }

  const getRandomDate = () => {
    const daysAgo = Math.floor(Math.random() * 30)
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  }

  const getRandomPhone = () => {
    const num = Math.floor(Math.random() * 9000000000) + 1000000000
    return '+91' + num.toString()
  }

  // 1. PREPAID orders (15 total)
  console.log('  Creating 15 PREPAID orders...')
  for (let i = 0; i < 15; i++) {
    orders.push({
      order_number: getOrderNumber('PREPAID'),
      store_id: stores[Math.floor(Math.random() * stores.length)],
      store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
      customer_name: `Prepaid Customer ${i + 1}`,
      customer_phone: getRandomPhone(),
      payment_type: 'PREPAID',
      cod_type: null,
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: 0,
      money_state: 'NOT_APPLICABLE',
      is_test: false,
      created_at: getRandomDate(),
    })
  }

  // 2. Active COD orders - COD_HARD and COD_QR in various states
  console.log('  Creating active COD orders...')
  for (const codType of COD_TYPES) {
    for (const state of ACTIVE_COD_STATES) {
      // Create 5 orders for each combination
      for (let i = 0; i < 5; i++) {
        const rider = riders[Math.floor(Math.random() * riders.length)]
        const asm = ['HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(state)
          ? asms[Math.floor(Math.random() * asms.length)]
          : null

        const createdAt = getRandomDate()
        orders.push({
          order_number: getOrderNumber(codType),
          store_id: stores[Math.floor(Math.random() * stores.length)],
          store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
          customer_name: `${codType} ${state} Customer ${i + 1}`,
          customer_phone: getRandomPhone(),
          payment_type: 'COD',
          cod_type: codType,  // Active COD type
          order_amount: Math.floor(Math.random() * 5000) + 100,
          cod_amount: Math.floor(Math.random() * 5000) + 100,
          money_state: state,
          rider_id: state !== 'UNCOLLECTED' ? rider : null,
          rider_name: state !== 'UNCOLLECTED' ? `Rider ${rider}` : null,
          asm_id: asm,
          asm_name: asm ? `ASM ${asm}` : null,
          collected_at: state !== 'UNCOLLECTED' ? createdAt : null,
          handover_to_asm_at: ['HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(state) ? createdAt : null,
          deposited_at: ['DEPOSITED', 'RECONCILED', 'RECONCILIATION_EXCEPTION'].includes(state) ? createdAt : null,
          reconciled_at: state === 'RECONCILED' ? createdAt : null,
          is_test: false,
          created_at: createdAt,
        })
      }
    }
  }

  // 3. Cancelled COD orders (61 total - mix of COD_HARD and COD_QR)
  console.log('  Creating 61 cancelled COD orders...')
  for (let i = 0; i < 61; i++) {
    const codType = COD_TYPES[Math.floor(Math.random() * COD_TYPES.length)]
    const createdAt = getRandomDate()
    orders.push({
      order_number: getOrderNumber('CANCELLED'),
      store_id: stores[Math.floor(Math.random() * stores.length)],
      store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
      customer_name: `Cancelled COD Customer ${i + 1}`,
      customer_phone: getRandomPhone(),
      payment_type: 'COD',
      cod_type: null,  // Set to NULL for cancelled (excluded from COD totals)
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: Math.floor(Math.random() * 5000) + 100,
      money_state: 'CANCELLED',  // New format: money_state = 'CANCELLED'
      cancelled_at: createdAt,
      is_test: false,
      created_at: createdAt,
    })
  }

  // 4. Cancelled PREPAID orders (10 total)
  console.log('  Creating 10 cancelled PREPAID orders...')
  for (let i = 0; i < 10; i++) {
    const createdAt = getRandomDate()
    orders.push({
      order_number: getOrderNumber('CANC-PREPAID'),
      store_id: stores[Math.floor(Math.random() * stores.length)],
      store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
      customer_name: `Cancelled Prepaid Customer ${i + 1}`,
      customer_phone: getRandomPhone(),
      payment_type: 'PREPAID',
      cod_type: null,
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: 0,
      money_state: 'CANCELLED',
      cancelled_at: createdAt,
      is_test: false,
      created_at: createdAt,
    })
  }

  // 5. RTO orders (56 total - mix of COD and PREPAID)
  console.log('  Creating 56 RTO orders...')
  for (let i = 0; i < 56; i++) {
    const isCOD = Math.random() < 0.7  // 70% COD, 30% PREPAID
    const createdAt = getRandomDate()
    orders.push({
      order_number: getOrderNumber('RTO'),
      store_id: stores[Math.floor(Math.random() * stores.length)],
      store_name: `Store ${stores[Math.floor(Math.random() * stores.length)]}`,
      customer_name: `RTO Customer ${i + 1}`,
      customer_phone: getRandomPhone(),
      payment_type: isCOD ? 'COD' : 'PREPAID',
      cod_type: 'RTO',  // RTO orders have cod_type = 'RTO'
      order_amount: Math.floor(Math.random() * 5000) + 100,
      cod_amount: isCOD ? Math.floor(Math.random() * 5000) + 100 : 0,
      money_state: 'CANCELLED',  // RTO orders have money_state = 'CANCELLED'
      rto_at: createdAt,
      is_test: false,
      created_at: createdAt,
    })
  }

  // Insert orders in batches
  console.log(`\n  Inserting ${orders.length} orders...`)
  const batchSize = 100
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const { error } = await supabase.from('orders').insert(batch)
    if (error) {
      console.error(`  ❌ Error inserting batch ${batchNum}:`, error)
    } else {
      console.log(`  ✅ Inserted batch ${batchNum} (${batch.length} orders)`)
    }
  }

  console.log('\n✨ Seed completed!')
  console.log('\n📊 Summary:')
  const prepaidCount = orders.filter(o => o.payment_type === 'PREPAID').length
  const codCount = orders.filter(o => o.payment_type === 'COD' && o.cod_type !== 'RTO').length
  const cancelledCount = orders.filter(o => o.money_state === 'CANCELLED' && o.cod_type !== 'RTO').length
  const rtoCount = orders.filter(o => o.cod_type === 'RTO').length
  const activeCodCount = orders.filter(o => o.payment_type === 'COD' && o.cod_type && ['COD_HARD', 'COD_QR'].includes(o.cod_type) && o.money_state !== 'CANCELLED').length
  
  console.log(`  - Total Orders: ${orders.length}`)
  console.log(`  - PREPAID: ${prepaidCount}`)
  console.log(`  - Active COD: ${activeCodCount}`)
  console.log(`  - Cancelled: ${cancelledCount} (${orders.filter(o => o.money_state === 'CANCELLED' && o.cod_type !== 'RTO' && o.payment_type === 'COD').length} COD + ${orders.filter(o => o.money_state === 'CANCELLED' && o.cod_type !== 'RTO' && o.payment_type === 'PREPAID').length} PREPAID)`)
  console.log(`  - RTO: ${rtoCount} (${orders.filter(o => o.cod_type === 'RTO' && o.payment_type === 'COD').length} COD + ${orders.filter(o => o.cod_type === 'RTO' && o.payment_type === 'PREPAID').length} PREPAID)`)
}

seed().catch(console.error)

