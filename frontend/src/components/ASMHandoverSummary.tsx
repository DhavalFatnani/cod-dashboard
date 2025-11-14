import { formatCurrency } from '../utils/format'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  cod_amount: number
  money_state: string
  asm_non_collected_reason?: string | null
  asm_future_collection_possible?: boolean | null
  asm_expected_collection_date?: string | null
}

interface ASMHandoverSummaryProps {
  orders: Order[]
}

export function ASMHandoverSummary({ orders }: ASMHandoverSummaryProps) {
  // Pending: UNCOLLECTED + COLLECTED_BY_RIDER
  const pendingOrders = orders.filter(
    (o) => o.money_state === 'UNCOLLECTED' || o.money_state === 'COLLECTED_BY_RIDER'
  )
  
  // Collected: HANDOVER_TO_ASM (Collected by ASM)
  const collectedOrders = orders.filter(
    (o) => o.money_state === 'HANDOVER_TO_ASM'
  )
  
  // Not Collected: Orders explicitly marked as not collected (have asm_non_collected_reason)
  const notCollectedOrders = orders.filter(
    (o) => o.asm_non_collected_reason
  )

  const pendingAmount = pendingOrders.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  )
  const collectedAmount = collectedOrders.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  )
  const notCollectedAmount = notCollectedOrders.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  )

  const futureCollectionOrders = notCollectedOrders.filter(
    (o) => o.asm_future_collection_possible
  )
  const futureCollectionAmount = futureCollectionOrders.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  )

  // Group reasons
  const reasonCounts: Record<string, number> = {}
  notCollectedOrders.forEach((o) => {
    const reason = o.asm_non_collected_reason || 'Unknown'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">Collection Summary</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-yellow-800 uppercase tracking-wide mb-1">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {pendingOrders.length} {pendingOrders.length === 1 ? 'order' : 'orders'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-900">
                  {formatCurrency(pendingAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-800 uppercase tracking-wide mb-1">Collected</p>
                  <p className="text-2xl font-bold text-green-900">
                    {collectedOrders.length} {collectedOrders.length === 1 ? 'order' : 'orders'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(collectedAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-200 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-red-800 uppercase tracking-wide mb-1">Not Collected</p>
                  <p className="text-2xl font-bold text-red-900">
                    {notCollectedOrders.length} {notCollectedOrders.length === 1 ? 'order' : 'orders'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(notCollectedAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Future Collection */}
        {futureCollectionOrders.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-700" />
              </div>
              <p className="text-sm font-semibold text-blue-900">Future Collection Possible</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-blue-700">
                {futureCollectionOrders.length}
              </p>
              <p className="text-sm text-blue-600 font-medium">orders</p>
            </div>
            <p className="text-sm text-blue-700 font-semibold mt-1">
              {formatCurrency(futureCollectionAmount)}
            </p>
          </div>
        )}

        {/* Reasons Breakdown */}
        {Object.keys(reasonCounts).length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Reasons Breakdown</p>
            <div className="space-y-2">
              {Object.entries(reasonCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-gray-700 truncate flex-1 pr-2">{reason}</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-900 font-semibold rounded-full text-xs min-w-[2rem] text-center">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Orders</span>
            <span className="text-lg font-bold text-gray-900">{orders.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Amount</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(pendingAmount + collectedAmount + notCollectedAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

