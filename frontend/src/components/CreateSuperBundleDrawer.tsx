import { useState, useEffect } from 'react'
import { X, Save, Package } from 'lucide-react'
import { asmBundleActionsService, CreateSuperBundleRequest } from '../services/asmBundleActionsService'
import { riderBundlesService, RiderBundle } from '../services/riderBundlesService'
import DenominationInput from './DenominationInput'
import { useQuery } from '@tanstack/react-query'

interface CreateSuperBundleDrawerProps {
  isOpen: boolean
  onClose: () => void
  asmId: string
  onSuccess: () => void
}

export default function CreateSuperBundleDrawer({
  isOpen,
  onClose,
  asmId,
  onSuccess,
}: CreateSuperBundleDrawerProps) {
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(new Set())
  const [denominationBreakdown, setDenominationBreakdown] = useState<Record<string, number>>({})
  const [digitalSignoff, setDigitalSignoff] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch bundles ready for superbundle creation
  const { data: bundles } = useQuery({
    queryKey: ['asm-ready-bundles', asmId],
    queryFn: async () => {
      const allBundles = await riderBundlesService.getBundles({
        status: 'HANDEDOVER_TO_ASM',
      })
      // Filter by ASM
      return allBundles.filter((b) => b.asm_id === asmId)
    },
    enabled: isOpen && !!asmId,
  })

  useEffect(() => {
    if (!isOpen) {
      setSelectedBundleIds(new Set())
      setDenominationBreakdown({})
      setDigitalSignoff(false)
      setError(null)
    }
  }, [isOpen])

  // Calculate expected amount from selected bundles
  const selectedBundles = bundles?.filter((b) => selectedBundleIds.has(b.id)) || []
  const expectedAmount = selectedBundles.reduce(
    (sum, b) => sum + (b.validated_amount || b.expected_amount),
    0
  )

  // Auto-aggregate denominations when bundles are selected
  useEffect(() => {
    if (selectedBundles.length > 0) {
      const aggregated: Record<string, number> = {}
      for (const bundle of selectedBundles) {
        for (const [denomination, count] of Object.entries(bundle.denomination_breakdown)) {
          aggregated[denomination] = (aggregated[denomination] || 0) + count
        }
      }
      setDenominationBreakdown(aggregated)
    } else {
      setDenominationBreakdown({})
    }
  }, [selectedBundleIds, bundles])

  const toggleBundle = (bundleId: string) => {
    const newSelected = new Set(selectedBundleIds)
    if (newSelected.has(bundleId)) {
      newSelected.delete(bundleId)
    } else {
      newSelected.add(bundleId)
    }
    setSelectedBundleIds(newSelected)
  }

  const handleSubmit = async () => {
    setError(null)

    if (selectedBundleIds.size === 0) {
      setError('Please select at least one bundle')
      return
    }

    if (Object.keys(denominationBreakdown).length === 0) {
      setError('Please enter denomination breakdown')
      return
    }

    // Validate denomination sum
    let calculatedAmount = 0
    for (const [denomination, count] of Object.entries(denominationBreakdown)) {
      calculatedAmount += parseFloat(denomination) * count
    }

    if (Math.abs(calculatedAmount - expectedAmount) > 0.01) {
      setError('Denomination breakdown does not match expected amount')
      return
    }

    if (!digitalSignoff) {
      setError('Please confirm digital signoff')
      return
    }

    setSubmitting(true)
    try {
      const request: CreateSuperBundleRequest = {
        rider_bundle_ids: Array.from(selectedBundleIds),
        denomination_breakdown: denominationBreakdown,
        digital_signoff: digitalSignoff,
      }

      await asmBundleActionsService.createSuperBundle(request)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create superbundle')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create SuperBundle</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bundle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Bundles ({selectedBundleIds.size} selected)
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bundles && bundles.length > 0 ? (
                bundles.map((bundle) => (
                  <div
                    key={bundle.id}
                    className={`p-3 border-2 rounded-lg cursor-pointer ${
                      selectedBundleIds.has(bundle.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleBundle(bundle.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBundleIds.has(bundle.id)}
                          onChange={() => toggleBundle(bundle.id)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <Package className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">
                            Bundle {bundle.id.slice(0, 8)}...
                          </p>
                          <p className="text-sm text-gray-500">
                            ₹{bundle.validated_amount || bundle.expected_amount} • {bundle.rider_bundle_orders?.length || 0} orders
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No bundles available for superbundle creation
                </p>
              )}
            </div>
          </div>

          {/* Expected Amount */}
          {selectedBundleIds.size > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                {selectedBundleIds.size} bundle{selectedBundleIds.size !== 1 ? 's' : ''} selected
              </p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{expectedAmount.toFixed(2)}
              </p>
            </div>
          )}

          {/* Denomination Input */}
          {selectedBundleIds.size > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Denomination Breakdown *
              </label>
              <DenominationInput
                value={denominationBreakdown}
                onChange={setDenominationBreakdown}
                expectedAmount={expectedAmount}
              />
            </div>
          )}

          {/* Digital Signoff */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="superbundle-signoff"
              checked={digitalSignoff}
              onChange={(e) => setDigitalSignoff(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="superbundle-signoff" className="text-sm text-gray-700">
              I confirm that the superbundle denominations are accurate and ready for SM handover. *
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedBundleIds.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create SuperBundle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
