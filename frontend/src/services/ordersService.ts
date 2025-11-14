import { supabase } from '../lib/supabase'

export interface Order {
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

export interface OrderFilters {
  payment_type?: 'COD' | 'PREPAID'
  cod_type?: 'COD_HARD' | 'COD_QR' | 'CANCELLED' | 'RTO' | ('COD_HARD' | 'COD_QR' | 'CANCELLED' | 'RTO')[]
  money_state?: string
  exclude_money_state?: string  // Exclude orders with this money_state
  exclude_cod_type?: string  // Exclude orders with this cod_type
  rider_id?: string
  asm_id?: string
  store_id?: string
  search?: string
  start_date?: string
  end_date?: string
  // Allow filtering by cod_type without payment_type (for cancelled/RTO which can be both COD and PREPAID)
}

export const ordersService = {
  async getOrders(filters: OrderFilters = {}, page = 1, pageSize = 50) {
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // Note: We include test orders in the orders table so simulator orders are visible
    // KPIs/metrics still filter out test orders to keep them clean

    // Handle cod_type filter FIRST (for CANCELLED/RTO which can be both COD and PREPAID)
    // Support array of cod_types for filtering multiple types (e.g., ['COD_HARD', 'COD_QR'])
    // NOTE: React Query may stringify arrays when serializing query keys, so handle both cases
    if (filters.cod_type) {
      let codTypeArray: string[] | null = null
      
      if (Array.isArray(filters.cod_type)) {
        // It's an array - use it directly
        codTypeArray = filters.cod_type as string[]
      } else if (typeof filters.cod_type === 'string') {
        // It's a string - check if it's comma-separated (happens when array gets stringified)
        if (filters.cod_type.includes(',')) {
          codTypeArray = filters.cod_type.split(',').map(s => s.trim())
        } else {
          // Single value
          query = query.eq('cod_type', filters.cod_type)
        }
      }
      
      // Handle array case
      if (codTypeArray && codTypeArray.length > 1) {
        // Multiple values - use .or() filter
        // Format: cod_type.eq.COD_HARD,cod_type.eq.COD_QR
        const orConditions = codTypeArray.map(ct => `cod_type.eq.${ct}`).join(',')
        query = query.or(orConditions)
      } else if (codTypeArray && codTypeArray.length === 1) {
        // Single value from array
        query = query.eq('cod_type', codTypeArray[0])
      }
    }
    // Then apply payment_type filter if specified
    if (filters.payment_type) {
      query = query.eq('payment_type', filters.payment_type)
      
      // For prepaid orders, exclude test orders, cancelled, and RTO to match KPI logic
      if (filters.payment_type === 'PREPAID') {
        query = query.eq('is_test', false)
        // Exclude cancelled money_state
        query = query.neq('money_state', 'CANCELLED')
        // Exclude RTO and legacy CANCELLED cod_type while including NULL
        // KPI logic: cod_type IS DISTINCT FROM 'RTO' AND (cod_type IS DISTINCT FROM 'CANCELLED' OR cod_type IS NULL)
        // We need: (cod_type != 'RTO' OR cod_type IS NULL) AND (cod_type != 'CANCELLED' OR cod_type IS NULL)
        // Since PostgREST filters are ANDed, we can use .neq() for both exclusions
        // But .neq() might exclude NULL, so we use .or() to explicitly include NULL
        // Use a single .or() that excludes both RTO and CANCELLED while including NULL
        // Format: (cod_type != 'RTO' OR cod_type != 'CANCELLED' OR cod_type IS NULL)
        // But this is OR logic, not AND. We need AND.
        // Let's try: exclude RTO with NULL, then exclude CANCELLED
        // First ensure NULL is included and RTO is excluded
        query = query.or('cod_type.neq.RTO,cod_type.is.null')
        // Then also exclude CANCELLED - if .neq() excludes NULL, the previous .or() should preserve it
        // But to be safe, let's also add NULL to this filter
        // Actually, since filters are ANDed, we can't easily combine OR and AND
        // Let's try a different approach: use .neq() for both and add NULL explicitly
        query = query.or('cod_type.neq.CANCELLED,cod_type.is.null')
      }
    }
    if (filters.money_state) {
      query = query.eq('money_state', filters.money_state)
      
      // For cancelled orders, exclude test orders and RTO to match KPI logic
      if (filters.money_state === 'CANCELLED') {
        query = query.eq('is_test', false)
        // Exclude RTO orders: cod_type != 'RTO' OR cod_type IS NULL
        // This matches KPI logic: cod_type IS DISTINCT FROM 'RTO'
        // PostgREST syntax: (cod_type.neq.RTO OR cod_type.is.null)
        // But .neq() might exclude NULL, so we use .or() to explicitly include NULL
        query = query.or('cod_type.neq.RTO,cod_type.is.null')
      }
    }
    
    // Apply exclude filters AFTER other filters to ensure proper filtering
    // Support excluding certain money_states (e.g., exclude cancelled from COD)
    // Only apply if money_state is not already set (to avoid conflicts)
    // Note: For prepaid orders, cancelled exclusion is handled above, so skip here
    if (filters.exclude_money_state && !filters.money_state && filters.payment_type !== 'PREPAID') {
      query = query.neq('money_state', filters.exclude_money_state)
    }
    // Support excluding certain cod_types (e.g., exclude RTO from cancelled)
    // Only apply if cod_type is not already set as an array (to avoid conflicts)
    // Note: For cancelled and prepaid orders, exclusion is handled above, so skip here
    if (filters.exclude_cod_type && !Array.isArray(filters.cod_type) && filters.money_state !== 'CANCELLED' && filters.payment_type !== 'PREPAID') {
      // Exclude orders where cod_type equals the excluded value (e.g., RTO)
      // Use .neq() which will exclude the value and include NULL values
      // This matches SQL: cod_type IS DISTINCT FROM 'RTO' (handles NULL correctly)
      query = query.neq('cod_type', filters.exclude_cod_type)
    }
    if (filters.rider_id) {
      query = query.eq('rider_id', filters.rider_id)
    }
    if (filters.asm_id) {
      query = query.eq('asm_id', filters.asm_id)
    }
    if (filters.store_id) {
      query = query.eq('store_id', filters.store_id)
    }
    if (filters.search) {
      query = query.or(
        `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`
      )
    }
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date)
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    return {
      data: data as Order[],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  },

  async getOrder(id: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Order
  },

  async getOrderTimeline(orderId: string) {
    const { data, error } = await supabase.rpc('get_order_timeline', {
      p_order_id: orderId,
    })

    if (error) throw error
    return data as any[]
  },

  async markHardCashCollected(
    orderId: string,
    asmId: string,
    asmName: string,
    collectedAmount?: number
  ) {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order || order.payment_type !== 'COD') {
      throw new Error('Invalid order or not a COD order')
    }

    const finalAmount = collectedAmount ?? order.cod_amount
    const isPartial = collectedAmount !== undefined && collectedAmount < order.cod_amount

    if (collectedAmount !== undefined && (collectedAmount < 0 || collectedAmount > order.cod_amount)) {
      throw new Error('Collected amount must be between 0 and COD amount')
    }

    // Create ASM event with collected amount
    const { data: event, error: eventError } = await supabase
      .from('asm_events')
      .insert({
        order_id: orderId,
        asm_id: asmId,
        asm_name: asmName,
        event_type: 'HANDOVER_TO_ASM',
        amount: order.cod_amount,
        collected_amount: finalAmount,
        notes: isPartial
          ? `Partial hard cash collected by ASM: ${finalAmount} of ${order.cod_amount}`
          : 'Hard cash collected by ASM',
      })
      .select()
      .single()

    if (eventError) throw eventError

    return event
  },

  async uploadPaymentScreenshot(orderId: string, file: File, userId: string) {
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${orderId}-${Date.now()}.${fileExt}`
    const filePath = `payment-screenshots/${fileName}`

    const { error: uploadError, data } = await supabase.storage
      .from('order-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('order-documents')
      .getPublicUrl(filePath)

    // Update order with screenshot URL
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_screenshot_url: publicUrl,
        payment_screenshot_uploaded_at: new Date().toISOString(),
        payment_screenshot_uploaded_by: userId,
      })
      .eq('id', orderId)

    if (updateError) throw updateError

    return { url: publicUrl, path: filePath }
  },

  async markCashCollectedByRider(orderId: string, riderId: string, riderName: string) {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order || order.payment_type !== 'COD') {
      throw new Error('Invalid order or not a COD order')
    }

    if (order.money_state !== 'UNCOLLECTED') {
      throw new Error('Order is not in UNCOLLECTED state')
    }

    // Create rider event with COLLECTED type
    // This will trigger the update_order_money_state function which sets money_state to COLLECTED_BY_RIDER
    const { data: event, error: eventError } = await supabase
      .from('rider_events')
      .insert({
        order_id: orderId,
        rider_id: riderId,
        rider_name: riderName,
        event_type: 'COLLECTED',
        amount: order.cod_amount,
        notes: 'Cash collected from customer by rider',
      })
      .select()
      .single()

    if (eventError) throw eventError

    return event
  },

  async markQRPaymentCollected(
    orderId: string,
    asmId: string,
    asmName: string,
    screenshotFile: File,
    userId: string,
    collectedAmount?: number
  ) {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order || order.payment_type !== 'COD' || order.cod_type !== 'COD_QR') {
      throw new Error('Invalid order or not a COD QR order')
    }

    const finalAmount = collectedAmount ?? order.cod_amount
    const isPartial = collectedAmount !== undefined && collectedAmount < order.cod_amount

    if (collectedAmount !== undefined && (collectedAmount < 0 || collectedAmount > order.cod_amount)) {
      throw new Error('Collected amount must be between 0 and COD amount')
    }

    // Upload screenshot first
    const screenshot = await this.uploadPaymentScreenshot(orderId, screenshotFile, userId)

    // Create ASM event with collected amount
    const { data: event, error: eventError } = await supabase
      .from('asm_events')
      .insert({
        order_id: orderId,
        asm_id: asmId,
        asm_name: asmName,
        event_type: 'HANDOVER_TO_ASM',
        amount: order.cod_amount,
        collected_amount: finalAmount,
        notes: isPartial
          ? `Partial QR payment collected by ASM: ${finalAmount} of ${order.cod_amount}`
          : 'QR payment collected by ASM with screenshot',
        metadata: { screenshot_url: screenshot.url },
      })
      .select()
      .single()

    if (eventError) throw eventError

    return { event, screenshot }
  },
}



