import { useQuery } from '@tanstack/react-query'
import { kpiService } from '../services/kpiService'
import { formatCurrency } from '../utils/format'
import { Package, DollarSign, CreditCard, QrCode, ShoppingCart, XCircle, RotateCcw } from 'lucide-react'
import OrderLifecycleFlow from './OrderLifecycleFlow'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import LifecycleMetrics from './LifecycleMetrics'
import { supabase } from '../lib/supabase'

interface DashboardOverviewProps {
  onFilterChange?: (filters: { money_state?: string; cod_type?: string; payment_type?: string }) => void
}

export default function DashboardOverview({ onFilterChange }: DashboardOverviewProps) {
  const [searchParams] = useSearchParams()
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedStat, setSelectedStat] = useState<string | null>(null)

  // Sync selected stat and stage with URL params
  useEffect(() => {
    const paymentType = searchParams.get('payment_type')
    const codType = searchParams.get('cod_type')
    const moneyState = searchParams.get('money_state')

    // Determine selected stat from URL params
    if (!paymentType && !codType && !moneyState) {
      setSelectedStat(null)
      setSelectedStage(null)
    } else if (paymentType === 'PREPAID') {
      setSelectedStat('total_prepaid')
      setSelectedStage(null)
    } else if (paymentType === 'COD') {
      if (codType === 'COD_HARD') {
        setSelectedStat('total_hard_cash')
        setSelectedStage(moneyState || null)
      } else if (codType === 'COD_QR') {
        setSelectedStat('total_qr')
        setSelectedStage(moneyState || null)
      } else if (codType) {
        // Other COD types
        setSelectedStat('total_cod')
        setSelectedStage(null)
      } else {
        setSelectedStat('total_cod')
        setSelectedStage(moneyState || null)
      }
    } else if (codType === 'CANCELLED') {
      setSelectedStat('total_cancelled')
      setSelectedStage(null)
    } else if (codType === 'RTO') {
      setSelectedStat('total_rto')
      setSelectedStage(null)
    }
  }, [searchParams])
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['kpi-metrics', {}],
    queryFn: () => kpiService.getKPIMetrics({}),
    refetchInterval: 5000,
  })

  // Get the cod_type based on selected stat
  const codType = useMemo(() => {
    if (selectedStat === 'total_hard_cash') return 'COD_HARD'
    if (selectedStat === 'total_qr') return 'COD_QR'
    return null
  }, [selectedStat])

  // Determine if we should fetch lifecycle counts (for COD stats)
  const shouldFetchLifecycleCounts = selectedStat === 'total_cod' || selectedStat === 'total_hard_cash' || selectedStat === 'total_qr'

  // Fetch filtered order counts for lifecycle stages
  const { data: filteredCounts } = useQuery({
    queryKey: ['lifecycle-counts', selectedStat, codType],
    queryFn: async () => {
      if (!shouldFetchLifecycleCounts) {
        return {
          uncollected: 0,
          collected: 0,
          handover: 0,
          deposited: 0,
          reconciled: 0,
        }
      }

      // Build base query - filter by payment_type = COD
      // MECE Principle: Total COD = Total Hard Cash + Total QR Code
      // So we only count active COD orders (COD_HARD and COD_QR), excluding CANCELLED and RTO
      // IMPORTANT: Must match the KPI function logic exactly
      const baseQuery = (state: string) => {
        let query = supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('payment_type', 'COD')
          .eq('money_state', state) // Filter by specific state
          .eq('is_test', false) // Exclude test orders
        
        // Exclude cancelled orders (state filter already handles this, but be explicit)
        // Exclude RTO orders
        query = query.neq('cod_type', 'RTO')
        
        // If codType is specified (Hard Cash or QR), filter by it
        if (codType) {
          query = query.eq('cod_type', codType)
        } else {
          // For total_cod, only count active COD orders (COD_HARD and COD_QR)
          // This ensures MECE: Total COD = Hard Cash + QR Code
          query = query.in('cod_type', ['COD_HARD', 'COD_QR'])
        }
        
        return query
      }

      // Fetch counts for each lifecycle stage
      // Note: PENDING_TO_DEPOSIT is removed from UI - flow goes directly from HANDOVER_TO_ASM to DEPOSITED
      // But we still query PENDING_TO_DEPOSIT and combine it with HANDOVER_TO_ASM for backward compatibility
      const [uncollected, collected, handover, pendingDeposit, deposited, reconciled, reconciliationException] = await Promise.all([
        // UNCOLLECTED
        baseQuery('UNCOLLECTED'),
        
        // COLLECTED_BY_RIDER
        baseQuery('COLLECTED_BY_RIDER'),
        
        // HANDOVER_TO_ASM
        baseQuery('HANDOVER_TO_ASM'),
        
        // PENDING_TO_DEPOSIT (combined with HANDOVER_TO_ASM in the return value)
        baseQuery('PENDING_TO_DEPOSIT'),
        
        // DEPOSITED
        baseQuery('DEPOSITED'),
        
        // RECONCILED
        baseQuery('RECONCILED'),
        
        // RECONCILIATION_EXCEPTION
        baseQuery('RECONCILIATION_EXCEPTION'),
      ])

      // Combine HANDOVER_TO_ASM and PENDING_TO_DEPOSIT into handover count
      // (PENDING_TO_DEPOSIT is essentially the same stage as HANDOVER_TO_ASM)
      const totalHandoverCount = (handover.count || 0) + (pendingDeposit.count || 0)
      
      // Sum all lifecycle stages - this should equal the COD card count
      const totalLifecycle = 
        (uncollected.count || 0) +
        (collected.count || 0) +
        totalHandoverCount +
        (deposited.count || 0) +
        (reconciled.count || 0) +
        (reconciliationException.count || 0)

      return {
        uncollected: uncollected.count || 0,
        collected: collected.count || 0,
        handover: totalHandoverCount, // Combined HANDOVER_TO_ASM + PENDING_TO_DEPOSIT
        deposited: deposited.count || 0,
        reconciled: reconciled.count || 0,
        reconciliationException: reconciliationException.count || 0,
        total: totalLifecycle, // Total for verification
      }
    },
    enabled: shouldFetchLifecycleCounts,
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  const codMetrics = metrics.cod || { count: 0, amount: 0, hard: { count: 0, amount: 0 }, qr: { count: 0, amount: 0 } }
  const cancelledMetrics = metrics.cancelled || { count: 0, amount: 0, cod_count: 0, cod_amount: 0, prepaid_count: 0, prepaid_amount: 0 }
  const rtoMetrics = metrics.rto || { count: 0, amount: 0, cod_count: 0, cod_amount: 0, prepaid_count: 0, prepaid_amount: 0 }
  
  // Show lifecycle for Total COD, Hard Cash, and QR
  const showLifecycle = selectedStat === 'total_cod' || selectedStat === 'total_hard_cash' || selectedStat === 'total_qr'
  
  // Use filtered counts if available, otherwise use general COD counts
  // Note: The simplified KPI function doesn't include lifecycle stages, so we rely on filteredCounts
  // IMPORTANT: The sum of all lifecycle stages should equal the COD card count
  // Note: PENDING_TO_DEPOSIT is removed from UI - handover includes both HANDOVER_TO_ASM and PENDING_TO_DEPOSIT
  const orderCounts = showLifecycle && filteredCounts ? {
    uncollected: filteredCounts.uncollected || 0,
    collected: filteredCounts.collected || 0,
    handover: filteredCounts.handover || 0, // Already includes PENDING_TO_DEPOSIT
    deposited: filteredCounts.deposited || 0,
    reconciled: filteredCounts.reconciled || 0,
    reconciliationException: filteredCounts.reconciliationException || 0,
  } : {
    uncollected: codMetrics.pending_to_collect?.count || 0,
    collected: codMetrics.collected_by_rider?.count || 0,
    handover: codMetrics.pending_to_deposit?.count || 0,
    deposited: codMetrics.deposited?.count || 0,
    reconciled: codMetrics.reconciled?.count || 0,
    reconciliationException: 0,
  }

  const handleStageClick = (stageKey: string | null) => {
    setSelectedStage(stageKey)
    
    if (onFilterChange) {
      if (stageKey) {
        // Map stage keys to money_state
        // Note: PENDING_TO_DEPOSIT is removed from UI, but we still handle it in the mapping for backward compatibility
        const stateMap: Record<string, string> = {
          'UNCOLLECTED': 'UNCOLLECTED',
          'COLLECTED_BY_RIDER': 'COLLECTED_BY_RIDER',
          'HANDOVER_TO_ASM': 'HANDOVER_TO_ASM',
          'DEPOSITED': 'DEPOSITED',
          'RECONCILED': 'RECONCILED',
          'RECONCILIATION_EXCEPTION': 'RECONCILIATION_EXCEPTION',
        }
        
        // Multi-level filter: Combine cod_type (from selected stat) + money_state (from lifecycle stage)
        const codTypeValue = codType || undefined
        const moneyState = stateMap[stageKey] || undefined
        
        onFilterChange({
          payment_type: 'COD',
          cod_type: codTypeValue,
          money_state: moneyState,
        })
      } else {
        // Reset to just the stat filter (no lifecycle stage selected)
        onFilterChange({
          payment_type: 'COD',
          cod_type: codType || undefined,
        })
      }
    }
  }

  const handleStatClick = (statType: string) => {
    if (onFilterChange) {
      // Toggle: if clicking the same stat, deselect it
      if (selectedStat === statType) {
        setSelectedStat(null)
        setSelectedStage(null)
        onFilterChange({})
      } else {
        setSelectedStat(statType)
        setSelectedStage(null) // Clear stage selection when stat is selected
        
        switch (statType) {
          case 'total_orders':
            onFilterChange({})
            break
          case 'total_cod':
            // COD: payment_type = COD, cod_type IN (COD_HARD, COD_QR), money_state != CANCELLED
            // Since we can't easily filter by multiple cod_types in the frontend,
            // we'll use an or() filter to show both COD_HARD and COD_QR
            // The service will handle this by using or() filter
            onFilterChange({ 
              payment_type: 'COD',
              cod_type: ['COD_HARD', 'COD_QR'] as ('COD_HARD' | 'COD_QR')[],
              exclude_money_state: 'CANCELLED'
            })
            break
          case 'total_hard_cash':
            // Hard Cash: payment_type = COD, cod_type = COD_HARD, money_state != CANCELLED
            onFilterChange({ 
              payment_type: 'COD', 
              cod_type: 'COD_HARD',
              exclude_money_state: 'CANCELLED'
            })
            break
          case 'total_qr':
            // QR: payment_type = COD, cod_type = COD_QR, money_state != CANCELLED
            onFilterChange({ 
              payment_type: 'COD', 
              cod_type: 'COD_QR',
              exclude_money_state: 'CANCELLED'
            })
            break
          case 'total_prepaid':
            // Prepaid: payment_type = PREPAID, exclude cancelled and RTO
            onFilterChange({ 
              payment_type: 'PREPAID',
              exclude_money_state: 'CANCELLED',
              exclude_cod_type: 'RTO'
            })
            break
          case 'total_cancelled':
            // Cancelled: money_state = 'CANCELLED' AND cod_type != 'RTO'
            // We can't easily do this with the current filter system, so we'll use a workaround:
            // Filter by money_state = 'CANCELLED' and let the service handle RTO exclusion
            // The service will use neq() which should work, but we need to ensure NULL values are included
            onFilterChange({ 
              money_state: 'CANCELLED',
              exclude_cod_type: 'RTO'
            })
            break
          case 'total_rto':
            // RTO: cod_type = 'RTO'
            onFilterChange({ cod_type: 'RTO' })
            break
          default:
            onFilterChange({})
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* 1. Total Orders - All Orders */}
        <button
          onClick={() => handleStatClick('total_orders')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_orders' 
              ? 'border-gray-400 bg-gray-100 shadow-lg ring-2 ring-gray-300 ring-offset-2' 
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.all_orders?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(metrics.all_orders?.amount || 0)}
          </p>
        </button>

        {/* 2. Cancelled - All Cancelled (Prepaid + COD) */}
        <button
          onClick={() => handleStatClick('total_cancelled')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_cancelled' 
              ? 'border-red-400 bg-red-50 shadow-lg ring-2 ring-red-300 ring-offset-2' 
              : 'border-red-200 bg-white hover:border-red-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_cancelled' ? 'bg-red-100' : 'bg-red-50'}`}>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Cancelled</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.cancelled?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(metrics.cancelled?.amount || 0)}
          </p>
        </button>

        {/* 3. RTO - All RTO (Prepaid + COD) */}
        <button
          onClick={() => handleStatClick('total_rto')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_rto' 
              ? 'border-gray-400 bg-gray-50 shadow-lg ring-2 ring-gray-300 ring-offset-2' 
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_rto' ? 'bg-gray-100' : 'bg-gray-50'}`}>
              <RotateCcw className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">RTO</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.rto?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(metrics.rto?.amount || 0)}
          </p>
        </button>

        {/* 4. Prepaid - All Prepaid */}
        <button
          onClick={() => handleStatClick('total_prepaid')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_prepaid' 
              ? 'border-orange-400 bg-orange-50 shadow-lg ring-2 ring-orange-300 ring-offset-2' 
              : 'border-orange-200 bg-white hover:border-orange-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_prepaid' ? 'bg-orange-100' : 'bg-orange-50'}`}>
              <ShoppingCart className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Prepaid</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.prepaid?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(metrics.prepaid?.amount || 0)}
          </p>
        </button>

        {/* 5. COD - All COD (COD HARD CASH + COD QR) */}
        <button
          onClick={() => handleStatClick('total_cod')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_cod' 
              ? 'border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-300 ring-offset-2' 
              : 'border-blue-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_cod' ? 'bg-blue-100' : 'bg-blue-50'}`}>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">COD</p>
          <p className="text-2xl font-bold text-gray-900">{codMetrics?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(codMetrics?.amount || 0)}
          </p>
        </button>

        {/* 6. COD HARD CASH - All Hard Cash */}
        <button
          onClick={() => handleStatClick('total_hard_cash')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_hard_cash' 
              ? 'border-green-400 bg-green-50 shadow-lg ring-2 ring-green-300 ring-offset-2' 
              : 'border-green-200 bg-white hover:border-green-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_hard_cash' ? 'bg-green-100' : 'bg-green-50'}`}>
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">COD HARD CASH</p>
          <p className="text-2xl font-bold text-gray-900">{codMetrics?.hard?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(codMetrics?.hard?.amount || 0)}
          </p>
        </button>

        {/* 7. COD QR - All QR */}
        <button
          onClick={() => handleStatClick('total_qr')}
          className={`
            relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
            ${selectedStat === 'total_qr' 
              ? 'border-purple-400 bg-purple-50 shadow-lg ring-2 ring-purple-300 ring-offset-2' 
              : 'border-purple-200 bg-white hover:border-purple-300 hover:shadow-md cursor-pointer'
            }
          `}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${selectedStat === 'total_qr' ? 'bg-purple-100' : 'bg-purple-50'}`}>
              <QrCode className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">COD QR</p>
          <p className="text-2xl font-bold text-gray-900">{codMetrics?.qr?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(codMetrics?.qr?.amount || 0)}
          </p>
        </button>
      </div>

      {/* Interactive Order Lifecycle Flow - Only for Hard Cash and QR */}
      {showLifecycle && (
        <OrderLifecycleFlow 
          currentState={selectedStage || undefined}
          orderCounts={orderCounts}
          onStageClick={handleStageClick}
        />
      )}

      {/* Hierarchical Metrics Based on Selected Stage */}
      <LifecycleMetrics 
        selectedStage={selectedStage}
        onFilterChange={onFilterChange}
      />
    </div>
  )
}
