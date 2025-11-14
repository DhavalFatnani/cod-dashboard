import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

export interface AcceptBundleRequest {
  bundle_id: string
  validation_status: 'ACCEPTED' | 'REJECTED'
  actual_denominations?: Record<string, number>
  comments?: string
}

export interface CreateSuperBundleRequest {
  rider_bundle_ids: string[]
  denomination_breakdown: Record<string, number>
  digital_signoff: boolean
  sm_id?: string
}

export interface RiderLedger {
  rider_id: string
  rider_name: string | null
  collected_amount: number
  bundled_amount: number
  unbundled_amount: number
  bundled_count: number
  unbundled_count: number
  date_range_start: string
  date_range_end: string
}

export interface ASMLedger {
  asm_id: string
  asm_name: string | null
  bundles_pending_count: number
  bundles_pending_amount: number
  bundles_accepted_count: number
  bundles_accepted_amount: number
  bundles_rejected_count: number
  superbundles_pending_count: number
  superbundles_pending_amount: number
  superbundles_handedover_count: number
  superbundles_handedover_amount: number
  date_range_start: string
  date_range_end: string
}

class ASMBundleActionsService {
  async acceptBundle(data: AcceptBundleRequest): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${FUNCTIONS_URL}/asm-bundle-actions/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to accept/reject bundle')
    }

    return await response.json()
  }

  async createSuperBundle(data: CreateSuperBundleRequest): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${FUNCTIONS_URL}/asm-bundle-actions/superbundle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create superbundle')
    }

    return await response.json()
  }

  async getRiderLedger(riderId: string, startDate?: string, endDate?: string): Promise<RiderLedger | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase.rpc('get_rider_ledger', {
      p_rider_id: riderId,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    })

    if (error) {
      throw new Error(error.message || 'Failed to fetch rider ledger')
    }

    return data && data.length > 0 ? data[0] : null
  }

  async getASMLedger(asmId: string, startDate?: string, endDate?: string): Promise<ASMLedger | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase.rpc('get_asm_ledger', {
      p_asm_id: asmId,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    })

    if (error) {
      throw new Error(error.message || 'Failed to fetch ASM ledger')
    }

    return data && data.length > 0 ? data[0] : null
  }
}

export const asmBundleActionsService = new ASMBundleActionsService()
