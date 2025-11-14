import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kpiService, KPIFilters } from '../services/kpiService'
import { KPICard } from './KPICard'
import { ChevronDown, ChevronRight, X, Target, Info } from 'lucide-react'
import { formatCurrency } from '../utils/format'

interface KPIDashboardProps {
  filters?: KPIFilters
  onFilterChange?: (filters: Partial<KPIFilters>) => void
}

export default function KPIDashboard({ filters = {}, onFilterChange }: KPIDashboardProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    cod: false,
    performance: false,
  })

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['kpi-metrics', filters],
    queryFn: () => kpiService.getKPIMetrics(filters),
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleKPIClick = (filterKey: string, filterValue: any) => {
    if (onFilterChange) {
      if (filterValue === undefined) {
        onFilterChange({})
      } else {
        const newFilters: Partial<KPIFilters> = {}
        
        if (filterKey === 'payment_type') {
          newFilters.payment_type = filterValue
          newFilters.cod_type = undefined
          newFilters.money_state = undefined
        } else if (filterKey === 'cod_type') {
          newFilters.payment_type = 'COD'
          newFilters.cod_type = filterValue
          newFilters.money_state = undefined
        } else if (filterKey === 'money_state') {
          newFilters.payment_type = 'COD'
          newFilters.money_state = filterValue
        }
        
        onFilterChange(newFilters)
      }
    }
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className="space-y-6">
      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              if (onFilterChange) {
                onFilterChange({ payment_type: undefined, cod_type: undefined, money_state: undefined })
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear filters"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        </div>
      )}

      {/* Level 1: Top Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          label="Total Orders"
          value={metrics.all_orders.count}
          amount={metrics.all_orders.amount}
          onClick={() => handleKPIClick('payment_type', undefined)}
          isActive={!filters.payment_type}
          level={1}
        />
        <KPICard
          label="COD Orders"
          value={metrics.cod.count}
          amount={metrics.cod.amount}
          onClick={() => handleKPIClick('payment_type', 'COD')}
          isActive={filters.payment_type === 'COD' && !filters.cod_type && !filters.money_state}
          level={1}
        />
        <KPICard
          label="Prepaid Orders"
          value={metrics.prepaid.count}
          amount={metrics.prepaid.amount}
          onClick={() => handleKPIClick('payment_type', 'PREPAID')}
          isActive={filters.payment_type === 'PREPAID'}
          level={1}
        />
      </div>

      {/* Level 2: Performance Metrics */}
      {filters.payment_type === 'COD' && (
        <div className="card border border-gray-200">
          <button
            onClick={() => toggleExpanded('performance')}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${expanded.performance ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {expanded.performance ? (
                  <ChevronDown className="w-5 h-5 text-blue-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>Click to expand</span>
            </div>
          </button>

          {expanded.performance && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Performance rates</strong> show how efficiently orders move through the collection process. 
                  Higher rates indicate better operational efficiency.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard
                  label="Collection Rate"
                  value={metrics.cod.collection_rate}
                  amount={0}
                  level={2}
                  className="text-center"
                />
                <KPICard
                  label="Deposit Rate"
                  value={metrics.cod.deposit_rate}
                  amount={0}
                  level={2}
                  className="text-center"
                />
                <KPICard
                  label="Reconciliation Rate"
                  value={metrics.cod.reconciliation_rate}
                  amount={0}
                  level={2}
                  className="text-center"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KPICard
                  label="Total Collected"
                  value={metrics.cod.total_collected.count}
                  amount={metrics.cod.total_collected.amount}
                  level={3}
                />
                <KPICard
                  label="Reconciliation Exceptions"
                  value={metrics.cod.exceptions.count}
                  amount={metrics.cod.exceptions.amount}
                  level={3}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Level 2: COD Breakdown - Expandable Section */}
      {filters.payment_type === 'COD' && (
        <div className="card border border-gray-200">
          <button
            onClick={() => toggleExpanded('cod')}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${expanded.cod ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {expanded.cod ? (
                  <ChevronDown className="w-5 h-5 text-blue-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">COD Breakdown</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {metrics.cod.count} orders • {formatCurrency(metrics.cod.amount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>Click to expand</span>
            </div>
          </button>

          {expanded.cod && (
            <div className="space-y-6 pt-4 border-t border-gray-200">
              {/* Level 3: COD Types */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                  By Payment Method
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Breakdown of COD orders by payment type (Hard Cash, QR Code, Cancelled, RTO)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    label="COD Hard"
                    value={metrics.cod.hard.count}
                    amount={metrics.cod.hard.amount}
                    onClick={() => handleKPIClick('cod_type', 'COD_HARD')}
                    isActive={filters.cod_type === 'COD_HARD'}
                    level={3}
                  />
                  <KPICard
                    label="COD QR"
                    value={metrics.cod.qr.count}
                    amount={metrics.cod.qr.amount}
                    onClick={() => handleKPIClick('cod_type', 'COD_QR')}
                    isActive={filters.cod_type === 'COD_QR'}
                    level={3}
                  />
                  <KPICard
                    label="Cancelled"
                    value={metrics.cod.cancelled.count}
                    amount={metrics.cod.cancelled.amount}
                    onClick={() => handleKPIClick('cod_type', 'CANCELLED')}
                    isActive={filters.cod_type === 'CANCELLED'}
                    level={3}
                  />
                  <KPICard
                    label="RTO"
                    value={metrics.cod.rto.count}
                    amount={metrics.cod.rto.amount}
                    onClick={() => handleKPIClick('cod_type', 'RTO')}
                    isActive={filters.cod_type === 'RTO'}
                    level={3}
                  />
                </div>
              </div>

              {/* Level 4: Lifecycle States */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                  By Lifecycle State
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Current status of COD orders in the collection and deposit process
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <KPICard
                    label="Pending to Collect"
                    value={metrics.cod.pending_to_collect.count}
                    amount={metrics.cod.pending_to_collect.amount}
                    onClick={() => handleKPIClick('money_state', 'UNCOLLECTED')}
                    isActive={filters.money_state === 'UNCOLLECTED'}
                    level={4}
                  />
                  <KPICard
                    label="Collected by Rider"
                    value={metrics.cod.collected_by_rider.count}
                    amount={metrics.cod.collected_by_rider.amount}
                    onClick={() => handleKPIClick('money_state', 'COLLECTED_BY_RIDER')}
                    isActive={filters.money_state === 'COLLECTED_BY_RIDER'}
                    level={4}
                  />
                  <KPICard
                    label="Pending to Deposit"
                    value={metrics.cod.pending_to_deposit.count}
                    amount={metrics.cod.pending_to_deposit.amount}
                    onClick={() => handleKPIClick('money_state', 'HANDOVER_TO_ASM')}
                    isActive={filters.money_state === 'HANDOVER_TO_ASM'}
                    level={4}
                  />
                  <KPICard
                    label="Deposited"
                    value={metrics.cod.deposited.count}
                    amount={metrics.cod.deposited.amount}
                    onClick={() => handleKPIClick('money_state', 'DEPOSITED')}
                    isActive={filters.money_state === 'DEPOSITED'}
                    level={4}
                  />
                  <KPICard
                    label="Reconciled"
                    value={metrics.cod.reconciled.count}
                    amount={metrics.cod.reconciled.amount}
                    onClick={() => handleKPIClick('money_state', 'RECONCILED')}
                    isActive={filters.money_state === 'RECONCILED'}
                    level={4}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State when no COD selected */}
      {!filters.payment_type && (
        <div className="card bg-gray-50 border-gray-200">
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a category to explore</h3>
            <p className="text-sm text-gray-500">
              Click on "COD Orders" or "Prepaid Orders" above to see detailed breakdowns and filter orders
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
