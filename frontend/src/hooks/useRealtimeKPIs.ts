import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRealtimeKPIs() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('kpi-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Invalidate KPI queries when orders change
          queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
          queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_events',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
          queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asm_events',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
          queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [queryClient])
}

