import { useQuery } from '@tanstack/react-query'
import { bundleService } from '../services/bundleService'
import { formatCurrency, formatDate } from '../utils/format'
import { AlertCircle, Clock, User, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

interface UnbundledOrdersTableProps {
  asmId: string
  riderId?: string | null
  onRequestJustification?: (orderId: string) => void
}

export function UnbundledOrdersTable({
  asmId,
  riderId,
  onRequestJustification,
}: UnbundledOrdersTableProps) {
  const [requestingJustification, setRequestingJustification] = useState<
    string | null
  >(null)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['unbundled-orders', asmId, riderId],
    queryFn: () => bundleService.getUnbundledOrders(asmId, riderId || undefined),
    enabled: !!asmId,
    refetchInterval: 5000,
  })

  const handleRequestJustification = async (orderId: string) => {
    setRequestingJustification(orderId)
    try {
      await bundleService.requestJustification(orderId)
      onRequestJustification?.(orderId)
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to request justification'}`)
    } finally {
      setRequestingJustification(null)
    }
  }

  // Calculate SLA violations (orders unbundled > 60 minutes)
  const now = new Date()
  const slaThresholdMinutes = 60
  const slaViolations = orders.filter((order) => {
    if (!order.collected_at) return false
    const collectedAt = new Date(order.collected_at)
    const minutesDiff = (now.getTime() - collectedAt.getTime()) / (1000 * 60)
    return minutesDiff > slaThresholdMinutes
  })

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-red-200 bg-red-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Unbundled Orders
            </h2>
            <p className="text-sm text-red-700 mt-1">
              {orders.length} unbundled order{orders.length !== 1 ? 's' : ''}
              {slaViolations.length > 0 && (
                <span className="ml-2 font-semibold">
                  ({slaViolations.length} SLA violation
                  {slaViolations.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {orders.length === 0 ? (
          <div className="text-center py-12 px-6">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">All orders are bundled</p>
            <p className="text-sm text-gray-500 mt-1">
              No unbundled orders found
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rider
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Collected At
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => {
                const collectedAt = order.collected_at
                  ? new Date(order.collected_at)
                  : null
                const minutesDiff = collectedAt
                  ? (now.getTime() - collectedAt.getTime()) / (1000 * 60)
                  : 0
                const isSlaViolation = minutesDiff > slaThresholdMinutes

                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-red-50/50 transition-colors ${
                      isSlaViolation ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {order.order_number}
                      </div>
                      {order.customer_name && (
                        <div className="text-xs text-gray-500">
                          {order.customer_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-900">
                            {order.rider_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.rider_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(order.cod_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {collectedAt ? (
                          <>
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {formatDate(collectedAt.toISOString())}
                              </div>
                              <div className="text-xs text-gray-500">
                                {Math.round(minutesDiff)} min ago
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isSlaViolation ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          SLA Violation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleRequestJustification(order.id)}
                        disabled={requestingJustification === order.id}
                        className="btn btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        {requestingJustification === order.id
                          ? 'Requesting...'
                          : 'Ask Justification'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
