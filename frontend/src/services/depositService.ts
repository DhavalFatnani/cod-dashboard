import { supabase } from '../lib/supabase'
import { Order } from './ordersService'

export interface PendingOrder extends Pick<Order,
  'id' | 'order_number' | 'cod_amount' | 'asm_id' | 'asm_name' | 'money_state' | 'cod_type' | 'payment_type' | 'store_name' | 'created_at' | 'asm_non_collected_reason' | 'collected_amount' | 'collection_discrepancy' | 'is_partial_collection'
> {}

export interface OrderCollectionData {
  order_id: string
  collection_status: 'COLLECTED' | 'NOT_COLLECTED'
  non_collection_reason?: string
  future_collection_date?: string
}

export interface CreateDepositPayload {
  asmId: string
  asmName: string | null
  orderIds: string[] | OrderCollectionData[]
  totalAmount: number
  expectedAmount?: number
  actualAmountReceived?: number
  depositDate: string
  bankAccount?: string
  referenceNumber?: string
  depositSlipFile: File
  smUserId: string
  smName: string | null
  asmHandoverDataId?: string
}

const DEPOSIT_SLIP_BUCKET = 'deposit-slips'

const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    throw new Error('Authentication required')
  }
  return session
}

const uploadDepositSlip = async (file: File, smUserId: string) => {
  const path = `${smUserId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const { error } = await supabase.storage
    .from(DEPOSIT_SLIP_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw error
  }

  const { data } = supabase.storage
    .from(DEPOSIT_SLIP_BUCKET)
    .getPublicUrl(path)

  if (!data?.publicUrl) {
    throw new Error('Failed to get deposit slip URL')
  }

  return data.publicUrl
}

export const depositService = {
  async fetchPendingOrders(): Promise<PendingOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, cod_amount, asm_id, asm_name, money_state, cod_type, payment_type, store_name, created_at, asm_non_collected_reason, collected_amount, collection_discrepancy, is_partial_collection')
      .eq('payment_type', 'COD')
      .eq('cod_type', 'COD_HARD') // Only COD Hard Cash orders
      .in('money_state', ['HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT'])
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data as PendingOrder[]) || []
  },

  async createDeposit(payload: CreateDepositPayload) {
    const session = await getSession()

    const depositSlipUrl = await uploadDepositSlip(payload.depositSlipFile, payload.smUserId)

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asm-deposit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asm_id: payload.asmId,
          asm_name: payload.asmName,
          order_ids: payload.orderIds,
          total_amount: payload.totalAmount,
          expected_amount: payload.expectedAmount,
          actual_amount_received: payload.actualAmountReceived,
          deposit_slip_url: depositSlipUrl,
          deposit_date: payload.depositDate,
          bank_account: payload.bankAccount,
          reference_number: payload.referenceNumber,
          sm_user_id: payload.smUserId,
          sm_name: payload.smName,
          asm_handover_data_id: payload.asmHandoverDataId,
          metadata: {
            source: 'sm-portal',
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create deposit')
    }

    return response.json()
  },

  /**
   * Fetch ASM handover data for a specific ASM
   */
  async fetchASMHandoverData(asmId: string) {
    const { data, error } = await supabase
      .from('asm_handover_data')
      .select('*')
      .eq('asm_id', asmId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  /**
   * Upload handover data file (CSV/XLSX)
   */
  async uploadHandoverDataFile(file: File, userId: string): Promise<string> {
    const path = `handover-data/${userId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error } = await supabase.storage
      .from('order-documents')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw error
    }

    const { data } = supabase.storage
      .from('order-documents')
      .getPublicUrl(path)

    if (!data?.publicUrl) {
      throw new Error('Failed to get file URL')
    }

    return data.publicUrl
  },
}


