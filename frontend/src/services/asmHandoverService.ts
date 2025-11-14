import { supabase } from '../lib/supabase'

export interface OrderCollectionReason {
  order_id: string
  non_collected_reason?: string
  future_collection_possible?: boolean
  expected_collection_date?: string
}

export interface BulkOrderCollectionData {
  order_number: string
  collection_status: 'COLLECTED' | 'NOT_COLLECTED'
  non_collection_reason?: string
  future_collection_possible?: boolean
  expected_collection_date?: string
}

export interface ASMHandoverData {
  id: string
  asm_id: string
  sm_id: string | null
  handover_date: string
  expected_amount: number
  actual_amount_received: number | null
  handover_data_file_url: string | null
  status: 'PENDING' | 'VALIDATED' | 'SUBMITTED'
  metadata: Record<string, any>
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

const HANDOVER_DATA_BUCKET = 'order-documents'

export const asmHandoverService = {
  /**
   * Update collection reason for a single order
   */
  async updateOrderCollectionReason(
    orderId: string,
    reason: OrderCollectionReason
  ) {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-handover/update-order-reason`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          non_collected_reason: reason.non_collected_reason,
          future_collection_possible: reason.future_collection_possible,
          expected_collection_date: reason.expected_collection_date,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to update order reason')
    }

    return response.json()
  },

  /**
   * Bulk update collection reasons from CSV/XLSX file
   */
  async bulkUpdateCollectionReasons(file: File) {
    const session = await getSession()

    // Parse file
    const { read, utils } = await import('xlsx')
    const data = await file.arrayBuffer()
    const workbook = read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

    // Map to expected format
    const orders: BulkOrderCollectionData[] = json.map((row) => ({
      order_number: (row.order_number || row.order || row['Order'] || row['Order Number'] || '').toString().trim(),
      collection_status: (row.collection_status || row.status || 'COLLECTED').toString().toUpperCase() as 'COLLECTED' | 'NOT_COLLECTED',
      non_collection_reason: row.non_collection_reason || row.reason || undefined,
      future_collection_possible: row.future_collection_possible === true || row.future_collection_possible === 'true' || row.future_collection_possible === 'TRUE',
      expected_collection_date: row.expected_collection_date || undefined,
    })).filter((o) => o.order_number)

    if (orders.length === 0) {
      throw new Error('No valid orders found in file')
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-handover/bulk-update-reasons`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to bulk update reasons')
    }

    return response.json()
  },

  /**
   * Upload handover data file (CSV/XLSX)
   */
  async uploadHandoverDataFile(file: File, userId: string): Promise<string> {
    const path = `handover-data/${userId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error } = await supabase.storage
      .from(HANDOVER_DATA_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw error
    }

    const { data } = supabase.storage
      .from(HANDOVER_DATA_BUCKET)
      .getPublicUrl(path)

    if (!data?.publicUrl) {
      throw new Error('Failed to get file URL')
    }

    return data.publicUrl
  },

  /**
   * Submit handover data to SM
   */
  async submitHandoverDataToSM(
    asmId: string,
    handoverDate: string,
    expectedAmount: number,
    fileUrl?: string,
    collectedOrderIds?: string[]
  ): Promise<ASMHandoverData> {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-handover/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asm_id: asmId,
          handover_date: handoverDate,
          expected_amount: expectedAmount,
          handover_data_file_url: fileUrl,
          collected_order_ids: collectedOrderIds || [],
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to submit handover data')
    }

    const result = await response.json()
    return result.handover_data
  },

  /**
   * Fetch ASM handover data
   */
  async fetchASMHandoverData(asmId: string): Promise<ASMHandoverData[]> {
    const session = await getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-handover/data/${asmId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to fetch handover data')
    }

    const result = await response.json()
    return result.handover_data || []
  },
}

