import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

export interface RiderBundle {
  id: string
  rider_id: string
  rider_name: string | null
  asm_id: string | null
  asm_name: string | null
  expected_amount: number
  denomination_breakdown: Record<string, number>
  validated_amount: number | null
  status: 'CREATED' | 'READY_FOR_HANDOVER' | 'HANDEDOVER_TO_ASM' | 'INCLUDED_IN_SUPERBUNDLE' | 'REJECTED'
  photo_proofs: string[]
  digital_signoff: boolean
  sealed_at: string | null
  handedover_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  rider_bundle_orders?: Array<{
    order_id: string
    orders: {
      id: string
      order_number: string
      cod_amount: number
      collected_amount: number | null
      money_state: string
    }
  }>
}

export interface CreateBundleRequest {
  order_ids: string[]
  denomination_breakdown: Record<string, number>
  photo_proofs: string[]
  digital_signoff: boolean
  asm_id?: string
}

export interface BundleListParams {
  rider_id?: string
  status?: string
}

class RiderBundlesService {
  async createBundle(data: CreateBundleRequest): Promise<RiderBundle> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${FUNCTIONS_URL}/rider-bundles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create bundle')
    }

    const result = await response.json()
    return result
  }

  async getBundles(params?: BundleListParams): Promise<RiderBundle[]> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const queryParams = new URLSearchParams()
    if (params?.rider_id) queryParams.append('rider_id', params.rider_id)
    if (params?.status) queryParams.append('status', params.status)

    const response = await fetch(`${FUNCTIONS_URL}/rider-bundles?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch bundles')
    }

    const result = await response.json()
    return result.bundles || []
  }

  async getBundle(bundleId: string): Promise<RiderBundle> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${FUNCTIONS_URL}/rider-bundles/${bundleId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch bundle')
    }

    const result = await response.json()
    return result.bundle
  }

  async markBundleReady(bundleId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const { error } = await supabase
      .from('rider_bundles')
      .update({ status: 'READY_FOR_HANDOVER' })
      .eq('id', bundleId)

    if (error) {
      throw new Error(error.message || 'Failed to mark bundle as ready')
    }
  }
}

export const riderBundlesService = new RiderBundlesService()
