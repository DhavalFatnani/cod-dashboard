import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/ordersService'
import { formatCurrency } from '../utils/format'
import { useUserStore } from '../stores/userStore'
import { Package, Plus } from 'lucide-react'

interface PendingCashBundlingProps {
  onSelectOrders: (orderIds: string[]) => void
}

export default function PendingCashBundling({ onSelectOrders }: PendingCashBundlingProps) {
  const { profile } = useUserStore()
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['pending-bundling-orders', profile?.rider_id],
    queryFn: async () => {
      if (!profile?.rider_id) return { data: [], total: 0 }
      const result = await ordersService.getOrders({
        payment_type: 'COD',
        cod_type: ['COD_HARD', 'COD_QR'],
        money_state: 'COLLECTED_BY_RIDER',
        rider_id: profile.rider_id,
      })
      return result
    },
    enabled: !!profile?.rider_id && profile.role === 'rider',
    refetchInterval: 5000,
  })

  const orders = data?.data || []

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleCreateBundle = () => {
    if (selectedOrders.size > 0) {
      onSelectOrders(Array.from(selectedOrders))
      setSelectedOrders(new Set())
    }
  }

  const totalSelectedAmount = orders
    .filter((o) => selectedOrders.has(o.id))
    .reduce((sum, o) => sum + (o.collected_amount || o.cod_amount || 0), 0)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pending Cash Bundling</h3>
          <p className="text-sm text-gray-500">
            {orders.length} order{orders.length !== 1 ? 's' : ''} ready for bundling
          </p>
        </div>
        {selectedOrders.size > 0 && (
          <button
            onClick={handleCreateBundle}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Bundle ({selectedOrders.size})
          </button>
        )}
      </div>

      {selectedOrders.size > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-900">
            Selected: {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} • Total: {formatCurrency(totalSelectedAmount)}
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p>No orders pending bundling</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(new Set(orders.map((o) => o.id)))
                      } else {
                        setSelectedOrders(new Set())
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Collected At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={selectedOrders.has(order.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrder(order.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(order.collected_amount || order.cod_amount || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {order.collected_at
                      ? new Date(order.collected_at).toLocaleString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
