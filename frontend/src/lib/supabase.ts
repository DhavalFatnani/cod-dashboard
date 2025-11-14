import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          full_name: string | null
          role: 'admin' | 'finance' | 'asm' | 'rider' | 'viewer' | 'sm'
          rider_id: string | null
          asm_id: string | null
          sm_id: string | null
          store_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          store_id: string
          store_name: string | null
          customer_name: string | null
          customer_phone: string | null
          payment_type: 'COD' | 'PREPAID'
          cod_type: 'COD_HARD' | 'COD_QR' | 'CANCELLED' | 'RTO' | null
          order_amount: number
          cod_amount: number
          money_state: string
          rider_id: string | null
          rider_name: string | null
          asm_id: string | null
          asm_name: string | null
          wms_order_id: string | null
          wms_created_at: string | null
          dispatched_at: string | null
          collected_at: string | null
          handover_to_asm_at: string | null
          deposited_at: string | null
          reconciled_at: string | null
          cancelled_at: string | null
          rto_at: string | null
          is_test: boolean
          test_tag: string | null
          payment_screenshot_url: string | null
          payment_screenshot_uploaded_at: string | null
          payment_screenshot_uploaded_by: string | null
          asm_non_collected_reason: string | null
          asm_future_collection_possible: boolean | null
          asm_expected_collection_date: string | null
          asm_collection_reason_updated_at: string | null
          collected_amount: number | null
          collection_discrepancy: number | null
          is_partial_collection: boolean | null
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

