import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ordersService, OrderFilters } from '../services/ordersService'
import { formatCurrency, formatDate } from '../utils/format'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface OrdersTableProps {
  filters?: OrderFilters
  showSearch?: boolean
  title?: string
}

export default function OrdersTable({ filters = {}, showSearch = false, title }: OrdersTableProps) {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Get current filter params from URL to preserve them in order detail links
  const getOrderDetailUrl = (orderId: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const paramsString = currentParams.toString()
    return `/orders/${orderId}${paramsString ? `?${paramsString}` : ''}`
  }

  const stableFilters = useMemo(() => {
    const cleanFilters: OrderFilters = {}
    if (filters.payment_type) cleanFilters.payment_type = filters.payment_type
    if (filters.cod_type) cleanFilters.cod_type = filters.cod_type
    if (filters.money_state) cleanFilters.money_state = filters.money_state
    if (filters.rider_id) cleanFilters.rider_id = filters.rider_id
    if (filters.asm_id) cleanFilters.asm_id = filters.asm_id
    if (filters.store_id) cleanFilters.store_id = filters.store_id
    if (filters.start_date) cleanFilters.start_date = filters.start_date
    if (filters.end_date) cleanFilters.end_date = filters.end_date
    return cleanFilters
  }, [
    filters.payment_type,
    filters.cod_type,
    filters.money_state,
    filters.rider_id,
    filters.asm_id,
    filters.store_id,
    filters.start_date,
    filters.end_date,
  ])

  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(stableFilters)

  useEffect(() => {
    setAppliedFilters(stableFilters)
    setPage(1)
  }, [stableFilters])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const queryFilters = useMemo(() => {
    const merged = { ...appliedFilters }
    if (debouncedSearch) {
      merged.search = debouncedSearch
    }
    return merged
  }, [appliedFilters, debouncedSearch])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, queryFilters],
    queryFn: () => ordersService.getOrders(queryFilters, page, 50),
  })

  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          refetch()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [refetch])

  const getMoneyStateBadge = (state: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      UNCOLLECTED: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
      COLLECTED_BY_RIDER: { bg: 'bg-blue-50', text: 'text-blue-700' },
      HANDOVER_TO_ASM: { bg: 'bg-purple-50', text: 'text-purple-700' },
      PENDING_TO_DEPOSIT: { bg: 'bg-orange-50', text: 'text-orange-700' },
      DEPOSITED: { bg: 'bg-green-50', text: 'text-green-700' },
      RECONCILED: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-700' },
      RTO: { bg: 'bg-gray-50', text: 'text-gray-700' },
    }
    const color = colors[state] || { bg: 'bg-gray-50', text: 'text-gray-700' }
    return (
      <span className={`badge ${color.bg} ${color.text}`}>
        {state.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">View and manage order details</p>
          </div>
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-80 pl-10"
              />
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4">Loading orders...</p>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {Object.keys(appliedFilters).length > 0 || debouncedSearch
                ? 'Try adjusting your filters or search terms'
                : 'No orders in the system yet. Use the simulator to create test orders.'
              }
            </p>
            {(Object.keys(appliedFilters).length > 0 || debouncedSearch) && (
              <button
                onClick={() => {
                  setSearch('')
                  setDebouncedSearch('')
                }}
                className="btn btn-secondary text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Payment Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      State
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Rider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((order) => (
                    <tr 
                      key={order.id} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {order.order_number}
                          {order.is_test && (
                            <span className="badge bg-purple-50 text-purple-700 text-xs" title="Test Order">
                              TEST
                            </span>
                          )}
                          {order.is_partial_collection && (
                            <span className="badge bg-orange-50 text-orange-700 text-xs" title="Partial Collection">
                              PARTIAL
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.customer_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="badge badge-primary">
                          {order.payment_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {order.payment_type === 'COD' ? (
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(order.cod_amount)}
                            </div>
                            {order.is_partial_collection && order.collected_amount !== null && (
                              <div className="text-xs text-orange-600 mt-0.5">
                                Collected: {formatCurrency(order.collected_amount)}
                                {order.collection_discrepancy > 0 && (
                                  <span className="text-red-600 ml-1">
                                    (-{formatCurrency(order.collection_discrepancy)})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(order.order_amount)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getMoneyStateBadge(order.money_state)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.rider_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={getOrderDetailUrl(order.id)}
                          className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((page - 1) * 50) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * 50, data.count)}</span> of{' '}
                  <span className="font-medium">{data.count}</span> orders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-700 px-4 py-2 bg-white rounded-lg border border-gray-200">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
