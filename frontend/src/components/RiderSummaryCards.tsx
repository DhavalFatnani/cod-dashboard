import { useQuery } from '@tanstack/react-query'
import { asmBundleActionsService } from '../services/asmBundleActionsService'
import { formatCurrency } from '../utils/format'
import { User, Package, AlertTriangle } from 'lucide-react'

interface RiderSummaryCardsProps {
  asmId: string
}

export default function RiderSummaryCards({ asmId }: RiderSummaryCardsProps) {
  // Fetch all riders for this ASM area
  const { data: riders } = useQuery({
    queryKey: ['asm-riders', asmId],
    queryFn: async () => {
      // This would need to be implemented based on your user/area mapping
      // For now, we'll fetch from orders
      const { data } = await fetch('/api/riders-for-asm', {
        method: 'POST',
        body: JSON.stringify({ asm_id: asmId }),
      }).then((r) => r.json())
      return data || []
    },
    enabled: !!asmId,
  })

  // Fetch ledger for each rider
  const riderIds = riders?.map((r: any) => r.rider_id) || []
  
  const ledgerQueries = riderIds.map((riderId: string) =>
    useQuery({
      queryKey: ['rider-ledger', riderId],
      queryFn: () => asmBundleActionsService.getRiderLedger(riderId),
      enabled: !!riderId,
    })
  )

  // For demo purposes, let's create a simplified version that fetches from orders
  const { data: ordersData } = useQuery({
    queryKey: ['asm-rider-summary-orders', asmId],
    queryFn: async () => {
      // This would aggregate orders by rider
      // Implementation depends on your data structure
      return []
    },
    enabled: !!asmId,
  })

  // Simplified version: show summary cards with placeholder data
  // In production, this would use the ledger queries above
  const summaryData = [
    {
      rider_id: 'R001',
      rider_name: 'Rider 1',
      collected_amount: 50000,
      bundled_amount: 30000,
      unbundled_amount: 20000,
      bundled_count: 15,
      unbundled_count: 10,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {summaryData.map((rider) => (
        <div
          key={rider.rider_id}
          className={`p-4 rounded-lg border-2 ${
            rider.unbundled_amount > 0
              ? 'border-red-300 bg-red-50'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">{rider.rider_name}</p>
                <p className="text-xs text-gray-500">{rider.rider_id}</p>
              </div>
            </div>
            {rider.unbundled_amount > 0 && (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Collected:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(rider.collected_amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Bundled:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(rider.bundled_amount)} ({rider.bundled_count})
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Unbundled:</span>
              <span className={`font-medium ${rider.unbundled_amount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(rider.unbundled_amount)} ({rider.unbundled_count})
              </span>
            </div>
          </div>

          {rider.unbundled_amount > 0 && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <p className="text-xs text-red-600 font-medium">
                ⚠️ Action Required: {rider.unbundled_count} orders need bundling
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
