import { useQuery } from '@tanstack/react-query'
import { riderBundlesService } from '../services/riderBundlesService'
import { formatCurrency } from '../utils/format'
import { Package, CheckCircle, Clock } from 'lucide-react'

interface BundledOrdersPanelProps {
  asmId: string
  onBundleClick?: (bundleId: string) => void
}

export default function BundledOrdersPanel({ asmId, onBundleClick }: BundledOrdersPanelProps) {
  const { data: bundles, isLoading } = useQuery({
    queryKey: ['asm-bundles', asmId],
    queryFn: async () => {
      // Fetch bundles assigned to this ASM
      // This would need a proper API endpoint or RPC function
      // For now, using a simplified approach
      return []
    },
    enabled: !!asmId,
  })

  // Simplified: fetch from orders with bundle_id
  const { data: ordersData } = useQuery({
    queryKey: ['asm-bundled-orders', asmId],
    queryFn: async () => {
      // Fetch orders that have bundle_id and are in this ASM's area
      return []
    },
    enabled: !!asmId,
  })

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

  const bundledOrders = ordersData || []

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Bundled Orders</h3>
        <span className="text-sm text-gray-500">
          {bundledOrders.length} order{bundledOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {bundledOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p>No bundled orders</p>
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
                  Bundle ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bundledOrders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3">
                    {order.bundle_id ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200"
                        onClick={() => onBundleClick?.(order.bundle_id)}
                      >
                        <Package className="w-3 h-3" />
                        {order.bundle_id.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(order.collected_amount || order.cod_amount || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                        order.money_state === 'READY_FOR_HANDOVER'
                          ? 'bg-yellow-100 text-yellow-800'
                          : order.money_state === 'BUNDLED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {order.money_state === 'READY_FOR_HANDOVER' ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      {order.money_state.replace(/_/g, ' ')}
                    </span>
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
