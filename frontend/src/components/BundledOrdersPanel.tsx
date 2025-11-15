import { useQuery } from '@tanstack/react-query'
import { bundleService, Bundle } from '../services/bundleService'
import { formatCurrency, formatDate } from '../utils/format'
import { Package, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { BundleAcceptanceModal } from './BundleAcceptanceModal'

interface BundledOrdersPanelProps {
  asmId: string
  onBundleAction?: () => void
}

export function BundledOrdersPanel({
  asmId,
  onBundleAction,
}: BundledOrdersPanelProps) {
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null)

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['bundles', asmId, 'READY_FOR_HANDOVER'],
    queryFn: () => bundleService.getBundles(asmId, 'READY_FOR_HANDOVER'),
    enabled: !!asmId,
    refetchInterval: 5000,
  })

  const { data: acceptedBundles = [] } = useQuery({
    queryKey: ['bundles', asmId, 'HANDEDOVER_TO_ASM'],
    queryFn: () => bundleService.getBundles(asmId, 'HANDEDOVER_TO_ASM'),
    enabled: !!asmId,
    refetchInterval: 5000,
  })

  const handleAccept = (bundle: Bundle) => {
    setSelectedBundle(bundle)
    setActionType('accept')
    setShowAcceptModal(true)
  }

  const handleReject = (bundle: Bundle) => {
    setSelectedBundle(bundle)
    setActionType('reject')
    setShowAcceptModal(true)
  }

  const handleModalClose = () => {
    setShowAcceptModal(false)
    setSelectedBundle(null)
    setActionType(null)
    onBundleAction?.()
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const allBundles = [...bundles, ...acceptedBundles]

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Bundled Orders
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {bundles.length} pending, {acceptedBundles.length} accepted
              </p>
            </div>
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="p-6">
          {allBundles.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No bundles found</p>
              <p className="text-sm text-gray-500 mt-1">
                Bundles will appear here once riders create them
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Bundles */}
              {bundles.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  bundle={bundle}
                  status="pending"
                  onAccept={() => handleAccept(bundle)}
                  onReject={() => handleReject(bundle)}
                />
              ))}

              {/* Accepted Bundles */}
              {acceptedBundles.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  bundle={bundle}
                  status="accepted"
                  onAccept={() => handleAccept(bundle)}
                  onReject={() => handleReject(bundle)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedBundle && showAcceptModal && (
        <BundleAcceptanceModal
          bundle={selectedBundle}
          actionType={actionType!}
          isOpen={showAcceptModal}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}

interface BundleCardProps {
  bundle: Bundle
  status: 'pending' | 'accepted'
  onAccept: () => void
  onReject: () => void
}

function BundleCard({ bundle, status, onAccept, onReject }: BundleCardProps) {
  const orderCount = 0 // TODO: Get from bundle orders query
  const isPending = status === 'pending'

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        isPending
          ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
          : 'border-green-200 bg-green-50/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-600" />
            <h3 className="font-semibold text-gray-900 text-sm">
              {bundle.bundle_number}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                isPending
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {isPending ? 'Pending' : 'Accepted'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>Rider: {bundle.rider_name || bundle.rider_id}</span>
            {bundle.sealed_at && (
              <span>Sealed: {formatDate(bundle.sealed_at)}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(bundle.expected_amount)}
          </div>
          <div className="text-xs text-gray-500">
            {orderCount} {orderCount === 1 ? 'order' : 'orders'}
          </div>
        </div>
      </div>

      {/* Denomination Breakdown */}
      {bundle.denomination_breakdown && (
        <div className="mb-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Denomination Breakdown:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(bundle.denomination_breakdown).map(
              ([denomination, count]) => (
                <div
                  key={denomination}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-xs"
                >
                  <span className="font-semibold">₹{denomination}</span>
                  <span className="text-gray-600 ml-1">× {count}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
          <button
            onClick={onAccept}
            className="flex-1 btn btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Accept Bundle
          </button>
          <button
            onClick={onReject}
            className="flex-1 btn btn-outline text-xs py-2 flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      )}

      {!isPending && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-gray-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700 font-medium">
            Accepted by ASM
          </span>
        </div>
      )}
    </div>
  )
}
