import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersService, OrderFilters } from '../services/ordersService'
import { formatCurrency, formatDate } from '../utils/format'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Orders() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<OrderFilters>({})
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, filters],
    queryFn: () => ordersService.getOrders(filters, page, 50),
  })

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (search) {
        setFilters((prev) => ({ ...prev, search }))
      } else {
        setFilters((prev) => {
          const { search: _, ...rest } = prev
          return rest
        })
      }
      setPage(1)
    }, 300)

    return () => clearTimeout(debounce)
  }, [search])

  // Subscribe to realtime updates
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
    const colors: Record<string, string> = {
      UNCOLLECTED: 'bg-yellow-100 text-yellow-800',
      COLLECTED_BY_RIDER: 'bg-blue-100 text-blue-800',
      HANDOVER_TO_ASM: 'bg-purple-100 text-purple-800',
      PENDING_TO_DEPOSIT: 'bg-orange-100 text-orange-800',
      DEPOSITED: 'bg-green-100 text-green-800',
      RECONCILED: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-red-100 text-red-800',
      RTO: 'bg-gray-100 text-gray-800',
    }
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          colors[state] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {state.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-64"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Payment Type</label>
            <select
              value={filters.payment_type || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_type: e.target.value as 'COD' | 'PREPAID' | undefined,
                }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="COD">COD</option>
              <option value="PREPAID">Prepaid</option>
            </select>
          </div>
          <div>
            <label className="label">Money State</label>
            <select
              value={filters.money_state || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  money_state: e.target.value || undefined,
                }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="UNCOLLECTED">Uncollected</option>
              <option value="COLLECTED_BY_RIDER">Collected by Rider</option>
              <option value="HANDOVER_TO_ASM">Handover to ASM</option>
              <option value="PENDING_TO_DEPOSIT">Pending to Deposit</option>
              <option value="DEPOSITED">Deposited</option>
              <option value="RECONCILED">Reconciled</option>
            </select>
          </div>
          <div>
            <label className="label">COD Type</label>
            <select
              value={filters.cod_type || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  cod_type: e.target.value as any || undefined,
                }))
              }
              className="input"
            >
              <option value="">All</option>
              <option value="COD_HARD">COD Hard</option>
              <option value="COD_QR">COD QR</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RTO">RTO</option>
            </select>
          </div>
          <div>
            <button
              onClick={() => {
                setFilters({})
                setSearch('')
              }}
              className="btn btn-secondary mt-6"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Order Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.data.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.customer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="px-2 py-1 rounded text-xs">
                          {order.payment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {formatCurrency(
                          order.payment_type === 'COD'
                            ? order.cod_amount
                            : order.order_amount
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getMoneyStateBadge(order.money_state)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.rider_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.count)} of{' '}
                  {data.count} orders
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="btn btn-secondary disabled:opacity-50"
                  >
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

