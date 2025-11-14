import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { riderBundlesService } from '../services/riderBundlesService'
import { useUserStore } from '../stores/userStore'
import PendingCashBundling from '../components/PendingCashBundling'
import CreateBundleDrawer from '../components/CreateBundleDrawer'
import BundleDetail from '../components/BundleDetail'
import { Package, X } from 'lucide-react'

export default function RiderBundles() {
  const { profile } = useUserStore()
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)

  const { data: bundles, isLoading, refetch } = useQuery({
    queryKey: ['rider-bundles', profile?.rider_id],
    queryFn: async () => {
      if (!profile?.rider_id) return []
      return await riderBundlesService.getBundles({
        rider_id: profile.rider_id,
      })
    },
    enabled: !!profile?.rider_id && profile.role === 'rider',
    refetchInterval: 5000,
  })

  const handleSelectOrders = (orderIds: string[]) => {
    setSelectedOrderIds(orderIds)
    setShowCreateDrawer(true)
  }

  const handleBundleCreated = () => {
    refetch()
    setShowCreateDrawer(false)
    setSelectedOrderIds([])
  }

  if (profile?.role !== 'rider') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">This page is only accessible to riders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rider Bundles</h1>
          <p className="text-sm text-gray-500">Create and manage cash bundles for handover</p>
        </div>
      </div>

      {/* Pending Cash Bundling */}
      <PendingCashBundling onSelectOrders={handleSelectOrders} />

      {/* Bundles List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">My Bundles</h2>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : !bundles || bundles.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No bundles created yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {bundles.map((bundle) => (
              <div
                key={bundle.id}
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedBundleId(bundle.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Bundle {bundle.id.slice(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-500">
                      ₹{bundle.expected_amount.toFixed(2)} • {bundle.rider_bundle_orders?.length || 0} orders
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        bundle.status === 'CREATED'
                          ? 'bg-blue-100 text-blue-800'
                          : bundle.status === 'READY_FOR_HANDOVER'
                          ? 'bg-yellow-100 text-yellow-800'
                          : bundle.status === 'HANDEDOVER_TO_ASM'
                          ? 'bg-green-100 text-green-800'
                          : bundle.status === 'INCLUDED_IN_SUPERBUNDLE'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {bundle.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(bundle.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Bundle Drawer */}
      <CreateBundleDrawer
        isOpen={showCreateDrawer}
        onClose={() => {
          setShowCreateDrawer(false)
          setSelectedOrderIds([])
        }}
        orderIds={selectedOrderIds}
        onSuccess={handleBundleCreated}
      />

      {/* Bundle Detail Modal */}
      {selectedBundleId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSelectedBundleId(null)} />
          <div className="relative max-w-4xl mx-auto my-8">
            <div className="bg-white rounded-lg shadow-xl p-6">
              <button
                onClick={() => setSelectedBundleId(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              {bundles?.find((b) => b.id === selectedBundleId) && (
                <BundleDetail bundle={bundles.find((b) => b.id === selectedBundleId)!} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
