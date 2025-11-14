import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import OrdersTable from '../components/OrdersTable'
import DashboardOverview from '../components/DashboardOverview'
import ExportDropdown from '../components/ExportDropdown'
import { OrderFilters, ordersService } from '../services/ordersService'
import { Calendar, Filter, X } from 'lucide-react'
import { useRealtimeKPIs } from '../hooks/useRealtimeKPIs'
import { useUserStore } from '../stores/userStore'
import { useQuery } from '@tanstack/react-query'
import { ContextualGuidance } from '../components/ContextualGuidance'

export default function Dashboard() {
  useRealtimeKPIs()
  const { profile } = useUserStore()
  const [searchParams, setSearchParams] = useSearchParams()

  // Fetch uncollected orders for riders
  const { data: uncollectedOrders } = useQuery({
    queryKey: ['rider-uncollected-orders', profile?.rider_id],
    queryFn: async () => {
      if (profile?.role !== 'rider' || !profile.rider_id) return []
      const result = await ordersService.getOrders({
        payment_type: 'COD',
        money_state: 'UNCOLLECTED',
        rider_id: profile.rider_id,
      })
      return result.data || []
    },
    enabled: profile?.role === 'rider' && !!profile.rider_id,
    refetchInterval: 5000,
  })
  
  // Initialize filters from URL params
  const orderFilters = useMemo<OrderFilters>(() => {
    const filters: OrderFilters = {}
    const paymentType = searchParams.get('payment_type')
    const codType = searchParams.get('cod_type')
    const moneyState = searchParams.get('money_state')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (paymentType === 'COD' || paymentType === 'PREPAID') {
      filters.payment_type = paymentType
    }
    if (codType) {
      filters.cod_type = codType as any
    }
    if (moneyState) {
      filters.money_state = moneyState as any
    }
    if (startDate) {
      filters.start_date = startDate
    }
    if (endDate) {
      filters.end_date = endDate
    }
    
    return filters
  }, [searchParams])

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: searchParams.get('start_date') || '',
    end: searchParams.get('end_date') || '',
  })
  const [allTime, setAllTime] = useState(!searchParams.get('start_date') && !searchParams.get('end_date'))

  // Sync dateRange state with URL params
  useEffect(() => {
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    if (startDate || endDate) {
      setDateRange({
        start: startDate || '',
        end: endDate || '',
      })
      setAllTime(false)
    }
  }, [searchParams])

  const updateURLParams = (filters: OrderFilters) => {
    const newParams = new URLSearchParams()
    
    if (filters.payment_type) {
      newParams.set('payment_type', filters.payment_type)
    }
    if (filters.cod_type) {
      newParams.set('cod_type', filters.cod_type)
    }
    if (filters.money_state) {
      newParams.set('money_state', filters.money_state)
    }
    if (filters.start_date) {
      newParams.set('start_date', filters.start_date)
    }
    if (filters.end_date) {
      newParams.set('end_date', filters.end_date)
    }
    
    setSearchParams(newParams, { replace: true })
  }

  const handleFilterChange = (filters: { money_state?: string; cod_type?: string; payment_type?: string }) => {
    const orderFilterUpdate: OrderFilters = { ...orderFilters }
    
    if (filters.payment_type) {
      orderFilterUpdate.payment_type = filters.payment_type as 'COD' | 'PREPAID'
    } else if (filters.payment_type === undefined && !filters.cod_type && !filters.money_state) {
      // If clearing filters, remove payment_type
      delete orderFilterUpdate.payment_type
    }
    
    if (filters.cod_type) {
      orderFilterUpdate.cod_type = filters.cod_type as any
    } else if (filters.cod_type === undefined && !filters.payment_type && !filters.money_state) {
      delete orderFilterUpdate.cod_type
    }
    
    if (filters.money_state) {
      orderFilterUpdate.money_state = filters.money_state as any
    } else if (filters.money_state === undefined && !filters.payment_type && !filters.cod_type) {
      delete orderFilterUpdate.money_state
    }
    
    // Preserve date filters
    if (orderFilters.start_date) {
      orderFilterUpdate.start_date = orderFilters.start_date
    }
    if (orderFilters.end_date) {
      orderFilterUpdate.end_date = orderFilters.end_date
    }
    
    updateURLParams(orderFilterUpdate)
  }

  const handleDateRangeChange = () => {
    const updatedFilters = { ...orderFilters }
    
    if (allTime) {
      delete updatedFilters.start_date
      delete updatedFilters.end_date
    } else {
      if (dateRange.start) {
        updatedFilters.start_date = dateRange.start
      } else {
        delete updatedFilters.start_date
      }
      if (dateRange.end) {
        updatedFilters.end_date = dateRange.end
      } else {
        delete updatedFilters.end_date
      }
    }
    
    updateURLParams(updatedFilters)
  }

  const clearAllFilters = () => {
    setDateRange({ start: '', end: '' })
    setAllTime(true)
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters = Object.keys(orderFilters).length > 0 || !allTime

  const getActiveFilterLabel = () => {
    if (orderFilters.payment_type === 'COD') {
      if (orderFilters.cod_type) {
        return `COD - ${orderFilters.cod_type.replace('_', ' ')}`
      }
      if (orderFilters.money_state) {
        return `COD - ${orderFilters.money_state.replace(/_/g, ' ')}`
      }
      return 'COD Orders'
    }
    if (orderFilters.payment_type === 'PREPAID') {
      return 'Prepaid Orders'
    }
    return 'All Orders'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track and manage cash-on-delivery orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Filter */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <input
                  type="checkbox"
                  id="all-time"
                  checked={allTime}
                  onChange={(e) => {
                    setAllTime(e.target.checked)
                    handleDateRangeChange()
                  }}
                  className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="all-time" className="text-sm font-medium text-gray-700 cursor-pointer">
                  All Time
                </label>
              </div>
              {!allTime && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, start: e.target.value }))
                      handleDateRangeChange()
                    }}
                    className="bg-transparent border-none text-sm text-gray-700 focus:outline-none"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                      handleDateRangeChange()
                    }}
                    className="bg-transparent border-none text-sm text-gray-700 focus:outline-none"
                  />
                </div>
              )}
              <ExportDropdown filters={orderFilters} />
            </div>
          </div>

          {/* Active Filters Bar */}
          {hasActiveFilters && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Active filters:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!allTime && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                    {dateRange.start} to {dateRange.end}
                  </span>
                )}
                {orderFilters.payment_type && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                    {getActiveFilterLabel()}
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8 space-y-8">
        {/* Rider-Specific Guidance */}
        {profile?.role === 'rider' && uncollectedOrders && uncollectedOrders.length > 0 && (
          <ContextualGuidance
            id="rider-uncollected-orders"
            title="Orders Pending Collection"
            message={`You have ${uncollectedOrders.length} order${uncollectedOrders.length > 1 ? 's' : ''} waiting to be collected from customers. Click on any order to mark it as collected.`}
            actionLabel="View Orders"
            actionUrl="/orders?money_state=UNCOLLECTED"
            variant="info"
            showForRoles={['rider']}
            priority="high"
          />
        )}

        {/* Overview Section with Interactive Lifecycle */}
        <DashboardOverview onFilterChange={handleFilterChange} />

        {/* Orders Table */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Orders</h2>
              <p className="text-sm text-gray-500">
                {hasActiveFilters 
                  ? `Showing filtered orders${orderFilters.payment_type ? ` (${getActiveFilterLabel()})` : ''}`
                  : 'All orders in the system'
                }
              </p>
            </div>
          </div>
          <OrdersTable
            filters={orderFilters}
            showSearch={true}
          />
        </div>
      </div>

    </div>
  )
}
