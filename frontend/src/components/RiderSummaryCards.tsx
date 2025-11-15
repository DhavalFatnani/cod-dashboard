import { useQuery } from '@tanstack/react-query'
import { bundleService, RiderSummary } from '../services/bundleService'
import { formatCurrency } from '../utils/format'
import { User, Package, AlertCircle, CheckCircle2 } from 'lucide-react'

interface RiderSummaryCardsProps {
  asmId: string
  onRiderClick?: (riderId: string) => void
  selectedRiderId?: string | null
}

export function RiderSummaryCards({
  asmId,
  onRiderClick,
  selectedRiderId,
}: RiderSummaryCardsProps) {
  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['rider-summaries', asmId],
    queryFn: () => bundleService.getRiderSummaries(asmId),
    enabled: !!asmId,
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No riders assigned</p>
        <p className="text-sm text-gray-500 mt-1">
          Riders will appear here once they have collected orders
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {summaries.map((summary) => (
        <RiderCard
          key={summary.rider_id}
          summary={summary}
          isSelected={selectedRiderId === summary.rider_id}
          onClick={() => onRiderClick?.(summary.rider_id)}
        />
      ))}
    </div>
  )
}

interface RiderCardProps {
  summary: RiderSummary
  isSelected?: boolean
  onClick?: () => void
}

function RiderCard({ summary, isSelected, onClick }: RiderCardProps) {
  const hasUnbundled = summary.unbundled_amount > 0
  const bundledPercentage =
    summary.total_amount_collected > 0
      ? (summary.bundled_amount / summary.total_amount_collected) * 100
      : 0

  return (
    <div
      className={`bg-white border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      } ${hasUnbundled ? 'ring-1 ring-red-200' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {summary.rider_name || `Rider ${summary.rider_id}`}
            </h3>
            <p className="text-xs text-gray-500">{summary.rider_id}</p>
          </div>
        </div>
        {hasUnbundled && (
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        )}
      </div>

      {/* Stats */}
      <div className="space-y-2">
        {/* Total Collected */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Total Collected</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(summary.total_amount_collected)}
          </span>
        </div>

        {/* Orders Count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Orders</span>
          <span className="text-sm font-medium text-gray-700">
            {summary.total_orders_collected}
          </span>
        </div>

        {/* Bundled Amount */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-gray-600">Bundled</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-green-700">
              {formatCurrency(summary.bundled_amount)}
            </span>
            <span className="text-xs text-gray-500 ml-1">
              ({Math.round(bundledPercentage)}%)
            </span>
          </div>
        </div>

        {/* Unbundled Amount */}
        {hasUnbundled && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs text-red-700 font-medium">Unbundled</span>
            </div>
            <span className="text-sm font-semibold text-red-700">
              {formatCurrency(summary.unbundled_amount)}
            </span>
          </div>
        )}

        {/* Pending Bundles */}
        {summary.pending_bundles_count > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs text-gray-600">Pending Bundles</span>
            </div>
            <span className="text-sm font-semibold text-blue-700">
              {summary.pending_bundles_count}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Bundle Progress</span>
          <span className="text-xs font-medium text-gray-700">
            {Math.round(bundledPercentage)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              bundledPercentage === 100
                ? 'bg-green-600'
                : bundledPercentage >= 80
                ? 'bg-blue-600'
                : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(bundledPercentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
