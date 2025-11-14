import { RiderBundle } from '../services/riderBundlesService'
import { Package, Calendar, User, CheckCircle, XCircle, Clock } from 'lucide-react'

interface BundleDetailProps {
  bundle: RiderBundle
}

export default function BundleDetail({ bundle }: BundleDetailProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'bg-blue-100 text-blue-800'
      case 'READY_FOR_HANDOVER':
        return 'bg-yellow-100 text-yellow-800'
      case 'HANDEDOVER_TO_ASM':
        return 'bg-green-100 text-green-800'
      case 'INCLUDED_IN_SUPERBUNDLE':
        return 'bg-purple-100 text-purple-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HANDEDOVER_TO_ASM':
      case 'INCLUDED_IN_SUPERBUNDLE':
        return <CheckCircle className="w-5 h-5" />
      case 'REJECTED':
        return <XCircle className="w-5 h-5" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Bundle Details</h3>
          <p className="text-sm text-gray-500">ID: {bundle.id.slice(0, 8)}...</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(bundle.status)}`}>
          {getStatusIcon(bundle.status)}
          {bundle.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Amount Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Expected Amount</p>
          <p className="text-2xl font-bold text-gray-900">₹{bundle.expected_amount.toFixed(2)}</p>
        </div>
        {bundle.validated_amount && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Validated Amount</p>
            <p className="text-2xl font-bold text-gray-900">₹{bundle.validated_amount.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Denomination Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Denomination Breakdown</h4>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(bundle.denomination_breakdown)
            .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
            .map(([denomination, count]) => (
              <div key={denomination} className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">₹{denomination}</p>
                <p className="text-lg font-semibold text-gray-900">{count}</p>
              </div>
            ))}
        </div>
      </div>

      {/* Rider & ASM Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm text-gray-600">Rider</p>
            <p className="font-medium text-gray-900">{bundle.rider_name || bundle.rider_id}</p>
          </div>
        </div>
        {bundle.asm_id && (
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">ASM</p>
              <p className="font-medium text-gray-900">{bundle.asm_name || bundle.asm_id}</p>
            </div>
          </div>
        )}
      </div>

      {/* Orders */}
      {bundle.rider_bundle_orders && bundle.rider_bundle_orders.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Orders ({bundle.rider_bundle_orders.length})
          </h4>
          <div className="space-y-2">
            {bundle.rider_bundle_orders.map((bundleOrder) => (
              <div
                key={bundleOrder.order_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {bundleOrder.orders?.order_number || bundleOrder.order_id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    ₹{bundleOrder.orders?.collected_amount || bundleOrder.orders?.cod_amount || 0}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {bundleOrder.orders?.money_state || 'BUNDLED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Proofs */}
      {bundle.photo_proofs && bundle.photo_proofs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Photo Proofs</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {bundle.photo_proofs.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Proof ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-300"
              />
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="pt-4 border-t border-gray-200 space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>Created: {new Date(bundle.created_at).toLocaleString()}</span>
        </div>
        {bundle.sealed_at && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>Sealed: {new Date(bundle.sealed_at).toLocaleString()}</span>
          </div>
        )}
        {bundle.handedover_at && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Handed Over: {new Date(bundle.handedover_at).toLocaleString()}</span>
          </div>
        )}
        {bundle.rejected_at && (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            <span>Rejected: {new Date(bundle.rejected_at).toLocaleString()}</span>
            {bundle.rejection_reason && (
              <span className="text-red-600">- {bundle.rejection_reason}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
