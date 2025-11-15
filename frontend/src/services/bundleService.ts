import { supabase } from '../lib/supabase'

export interface RiderSummary {
  rider_id: string
  rider_name: string | null
  total_orders_collected: number
  total_amount_collected: number
  bundled_amount: number
  unbundled_amount: number
  pending_bundles_count: number
}

export interface Bundle {
  id: string
  bundle_number: string
  rider_id: string
  rider_name: string | null
  asm_id: string
  expected_amount: number
  denomination_breakdown: Record<string, number>
  status: string
  sealed_at: string | null
  created_at: string
  updated_at: string
}

export interface SuperBundle {
  id: string
  superbundle_number: string
  asm_id: string
  expected_amount: number
  denomination_breakdown: Record<string, number>
  status: string
  deposit_id: string | null
  created_at: string
  updated_at: string
}

const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    throw new Error('Authentication required')
  }
  return session
}

export const bundleService = {
  /**
   * Get rider summary for ASM (aggregated stats per rider)
   */
  async getRiderSummaries(asmId: string): Promise<RiderSummary[]> {
    // Query orders to calculate rider summaries
    const { data: orders, error } = await supabase
      .from('orders')
      .select('rider_id, rider_name, cod_amount, bundle_id, money_state')
      .eq('asm_id', asmId)
      .eq('payment_type', 'COD')
      .eq('cod_type', 'COD_HARD')
      .in('money_state', ['COLLECTED_BY_RIDER', 'BUNDLED', 'HANDOVER_TO_ASM', 'INCLUDED_IN_SUPERBUNDLE'])

    if (error) throw error

    // Group by rider
    const riderMap = new Map<string, RiderSummary>()

    for (const order of orders || []) {
      if (!order.rider_id) continue

      if (!riderMap.has(order.rider_id)) {
        riderMap.set(order.rider_id, {
          rider_id: order.rider_id,
          rider_name: order.rider_name,
          total_orders_collected: 0,
          total_amount_collected: 0,
          bundled_amount: 0,
          unbundled_amount: 0,
          pending_bundles_count: 0,
        })
      }

      const summary = riderMap.get(order.rider_id)!
      summary.total_orders_collected++
      summary.total_amount_collected += parseFloat(order.cod_amount?.toString() || '0')

      if (order.bundle_id) {
        summary.bundled_amount += parseFloat(order.cod_amount?.toString() || '0')
      } else if (order.money_state === 'COLLECTED_BY_RIDER') {
        summary.unbundled_amount += parseFloat(order.cod_amount?.toString() || '0')
      }
    }

    // Get pending bundles count per rider
    const { data: bundles } = await supabase
      .from('rider_bundles')
      .select('rider_id, status')
      .eq('asm_id', asmId)
      .in('status', ['READY_FOR_HANDOVER', 'HANDEDOVER_TO_ASM'])

    if (bundles) {
      for (const bundle of bundles) {
        const summary = riderMap.get(bundle.rider_id)
        if (summary) {
          summary.pending_bundles_count++
        }
      }
    }

    return Array.from(riderMap.values())
  },

  /**
   * Get bundles for ASM
   */
  async getBundles(asmId: string, status?: string): Promise<Bundle[]> {
    let query = supabase
      .from('rider_bundles')
      .select('*')
      .eq('asm_id', asmId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Bundle[]
  },

  /**
   * Accept a bundle
   */
  async acceptBundle(
    bundleId: string,
    denominationBreakdown: Record<string, number>
  ) {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-bundle-actions/${bundleId}/accept`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundle_id: bundleId,
          denomination_breakdown: denominationBreakdown,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to accept bundle')
    }

    return response.json()
  },

  /**
   * Reject a bundle
   */
  async rejectBundle(bundleId: string, rejectionReason: string) {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-bundle-actions/${bundleId}/reject`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundle_id: bundleId,
          rejection_reason: rejectionReason,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to reject bundle')
    }

    return response.json()
  },

  /**
   * Request justification for unbundled order
   */
  async requestJustification(orderId: string, reason?: string) {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-bundle-actions/${orderId}/request-justification`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          justification_request_reason: reason,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to request justification')
    }

    return response.json()
  },

  /**
   * Create superbundle
   */
  async createSuperBundle(
    bundleIds: string[],
    denominationBreakdown: Record<string, number>,
    asmId: string
  ) {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-bundle-actions/superbundles`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundle_ids: bundleIds,
          denomination_breakdown: denominationBreakdown,
          asm_id: asmId,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create superbundle')
    }

    return response.json()
  },

  /**
   * Get unbundled orders for ASM
   */
  async getUnbundledOrders(asmId: string, riderId?: string) {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('asm_id', asmId)
      .eq('payment_type', 'COD')
      .eq('cod_type', 'COD_HARD')
      .eq('money_state', 'COLLECTED_BY_RIDER')
      .is('bundle_id', null)
      .order('collected_at', { ascending: true })

    if (riderId) {
      query = query.eq('rider_id', riderId)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },
}
