import { supabase } from '../lib/supabase'

export interface KPIMetrics {
  all_orders: {
    count: number
    amount: number
    today: {
      count: number
      amount: number
    }
    this_week: {
      count: number
      amount: number
    }
    this_month: {
      count: number
      amount: number
    }
  }
  cod: {
    count: number
    amount: number
    total_collected: {
      count: number
      amount: number
    }
    collection_rate: number
    deposit_rate: number
    reconciliation_rate: number
    hard: {
      count: number
      amount: number
    }
    qr: {
      count: number
      amount: number
    }
    pending_to_collect: {
      count: number
      amount: number
    }
    collected_by_rider: {
      count: number
      amount: number
    }
    pending_to_deposit: {
      count: number
      amount: number
    }
    deposited: {
      count: number
      amount: number
    }
    reconciled: {
      count: number
      amount: number
    }
    exceptions: {
      count: number
      amount: number
    }
    null_cod_type?: {
      count: number
      amount: number
    }
  }
  cancelled: {
    count: number
    amount: number
    cod_count: number
    cod_amount: number
    prepaid_count: number
    prepaid_amount: number
  }
  rto: {
    count: number
    amount: number
    cod_count: number
    cod_amount: number
    prepaid_count: number
    prepaid_amount: number
  }
  prepaid: {
    count: number
    amount: number
    today: {
      count: number
      amount: number
    }
    this_week: {
      count: number
      amount: number
    }
    this_month: {
      count: number
      amount: number
    }
  }
  riders: {
    total_riders: number
    total_collected: {
      count: number
      amount: number
    }
    avg_per_rider: number
  }
  asms: {
    total_asms: number
    total_deposited: {
      count: number
      amount: number
    }
    avg_per_asm: number
  }
  stores: {
    total_stores: number
    total_orders: number
    total_amount: number
  }
}

export interface KPIFilters {
  start_date?: string
  end_date?: string
  store_id?: string
  rider_id?: string
  asm_id?: string
}

export const kpiService = {
  async getKPIMetrics(filters: KPIFilters = {}): Promise<KPIMetrics> {
    const { data, error } = await supabase.rpc('get_kpi_metrics', {
      p_start_date: filters.start_date || null,
      p_end_date: filters.end_date || null,
      p_store_id: filters.store_id || null,
      p_rider_id: filters.rider_id || null,
      p_asm_id: filters.asm_id || null,
    })

    if (error) throw error
    return data as KPIMetrics
  },
}
