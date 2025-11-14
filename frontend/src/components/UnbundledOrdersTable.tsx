import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/ordersService'
import { formatCurrency } from '../utils/format'
import { AlertTriangle, MessageSquare } from 'lucide-react'

interface UnbundledOrdersTableProps {
  asmId: string
  onAskJustification?: (orderId: string) => void
}

export default function UnbundledOrdersTable({ asmId, onAskJustification }: UnbundledOrdersTableProps) {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['asm-unbundled-orders', asmId],
    queryFn: async () => {
      if (!asmId) return { data: [], total: 0 }
      
      // Fetch orders in COLLECTED_BY_RIDER state without bundle_id
      // This would need to filter by ASM area
      const result = await ordersService.getOrders({
        payment_type: 'COD',
        cod_type: ['COD_HARD', 'COD_QR'],
        money_state: 'COLLECTED_BY_RIDER',
      })
      
      // Filter orders without bundle_id (would need to add this filter to service)
      return {
        data: result.data?.filter((o) => !o.bundle_id) || [],
        total: result.total || 0,
      }
    },
    enabled: !!asmId,
    refetchInterval: 5000,
  })

  const orders = ordersData?.data || []
  const totalUnbundled = orders.reduce(
    (sum, o) => sum + (o.collected_amount || o.cod_amount || 0),
    0
  )

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
    <div className="bg-white rounded-lg shadow border-2 border-red-200">
      <div className="p-6 border-b border-red-200 bg-red-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Unbundled Orders</h3>
              <p className="text-sm text-red-700">
                {orders.length} order{orders.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalUnbundled)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No unbundled orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Collected At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {order.rider_name || order.rider_id}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">
                      {formatCurrency(order.collected_amount || order.cod_amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.collected_at
                        ? new Date(order.collected_at).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onAskJustification?.(order.id)}
                        className="flex items-center gap-2 px-3 py-1 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Ask Justification
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
