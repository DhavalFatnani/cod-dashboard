import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export interface SimulatorStatus {
  status: boolean
  test_tag: string | null
}

export interface SimulatorStartRequest {
  count: number
  rate_per_min?: number
  mix?: {
    cod_hard?: number
    cod_qr?: number
    prepaid?: number
  }
  rider_pool?: string[]
  asm_pool?: string[]
  test_tag?: string
}

export const simulatorService = {
  async getStatus(): Promise<SimulatorStatus> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulator/status`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) throw new Error('Failed to get simulator status')
    return response.json()
  },

  async start(request: SimulatorStartRequest) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulator/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start simulator')
    }

    return response.json()
  },

  async stop() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    console.log('Making stop request to:', `${SUPABASE_URL}/functions/v1/simulator/stop`)
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulator/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Stop response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stop response error:', errorText)
      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { error: errorText || 'Failed to stop simulator' }
      }
      throw new Error(error.error || 'Failed to stop simulator')
    }
    
    const result = await response.json()
    console.log('Stop response data:', result)
    return result
  },

  async bulkProcess(testTag: string, action: 'collect' | 'handover' | 'deposit' | 'reconcile') {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulator/bulk-process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test_tag: testTag, action }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to process bulk action')
    }

    return response.json()
  },

  async cleanup(testTag: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulator/cleanup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test_tag: testTag }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to cleanup')
    }

    return response.json()
  },
}

