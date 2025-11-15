import { useState } from 'react'
import { X, Package, Plus, Trash2 } from 'lucide-react'
import { Bundle } from '../services/bundleService'
import { formatCurrency } from '../utils/format'
import { bundleService } from '../services/bundleService'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreateSuperBundleDrawerProps {
  isOpen: boolean
  onClose: () => void
  asmId: string
  availableBundles: Bundle[]
}

export function CreateSuperBundleDrawer({
  isOpen,
  onClose,
  asmId,
  availableBundles,
}: CreateSuperBundleDrawerProps) {
  const queryClient = useQueryClient()
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(
    new Set()
  )
  const [denominationBreakdown, setDenominationBreakdown] = useState<
    Record<string, number>
  >({})
  const [errors, setErrors] = useState<string[]>([])

  const createMutation = useMutation({
    mutationFn: () =>
      bundleService.createSuperBundle(
        Array.from(selectedBundleIds),
        denominationBreakdown,
        asmId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['superbundles'] })
      queryClient.invalidateQueries({ queryKey: ['rider-summaries'] })
      handleClose()
    },
    onError: (error: any) => {
      setErrors([error.message || 'Failed to create superbundle'])
    },
  })

  const handleClose = () => {
    setSelectedBundleIds(new Set())
    setDenominationBreakdown({})
    setErrors([])
    onClose()
  }

  const toggleBundle = (bundleId: string) => {
    const newSet = new Set(selectedBundleIds)
    if (newSet.has(bundleId)) {
      newSet.delete(bundleId)
    } else {
      newSet.add(bundleId)
    }
    setSelectedBundleIds(newSet)
    setErrors([])
  }

  const selectedBundles = availableBundles.filter((b) =>
    selectedBundleIds.has(b.id)
  )

  const expectedAmount = selectedBundles.reduce(
    (sum, b) => sum + parseFloat(b.expected_amount?.toString() || '0'),
    0
  )

  const handleDenominationChange = (
    denomination: string,
    count: number
  ) => {
    const newBreakdown = { ...denominationBreakdown }
    if (count <= 0) {
      delete newBreakdown[denomination]
    } else {
      newBreakdown[denomination] = count
    }
    setDenominationBreakdown(newBreakdown)
    setErrors([])
  }

  const calculateTotal = () => {
    return Object.entries(denominationBreakdown).reduce(
      (sum, [denomination, count]) => sum + parseFloat(denomination) * count,
      0
    )
  }

  const validateAndSubmit = () => {
    setErrors([])

    if (selectedBundleIds.size === 0) {
      setErrors(['Please select at least one bundle'])
      return
    }

    const total = calculateTotal()
    const tolerance = 0.01
    if (Math.abs(total - expectedAmount) > tolerance) {
      setErrors([
        `Total (${formatCurrency(total)}) does not match expected amount (${formatCurrency(expectedAmount)})`,
      ])
      return
    }

    createMutation.mutate()
  }

  if (!isOpen) return null

  const total = calculateTotal()
  const isAmountValid = Math.abs(total - expectedAmount) < 0.01

  // Common denominations
  const commonDenominations = ['2000', '500', '200', '100', '50', '20', '10']

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-gray-500 bg-opacity-75" onClick={handleClose} />
      
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl">
          <div className="flex flex-col h-full bg-white shadow-xl">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Create SuperBundle
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Select bundles to combine
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Errors */}
              {errors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  {errors.map((error, idx) => (
                    <div key={idx} className="text-sm text-red-700">
                      {error}
                    </div>
                  ))}
                </div>
              )}

              {/* Available Bundles */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Available Bundles ({availableBundles.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableBundles.map((bundle) => {
                    const isSelected = selectedBundleIds.has(bundle.id)
                    return (
                      <div
                        key={bundle.id}
                        onClick={() => toggleBundle(bundle.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBundle(bundle.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm font-semibold text-gray-900">
                                {bundle.bundle_number}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              Rider: {bundle.rider_name || bundle.rider_id}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(bundle.expected_amount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Selected Bundles Summary */}
              {selectedBundles.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Selected Bundles: {selectedBundles.length}
                    </span>
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(expectedAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {selectedBundles
                      .map((b) => b.bundle_number)
                      .join(', ')}
                  </div>
                </div>
              )}

              {/* Denomination Breakdown */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Denomination Breakdown
                </label>
                <div className="space-y-2">
                  {commonDenominations.map((denom) => (
                    <div key={denom} className="flex items-center gap-3">
                      <label className="w-20 text-sm text-gray-700">
                        ₹{denom}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={denominationBreakdown[denom] || 0}
                        onChange={(e) =>
                          handleDenominationChange(
                            denom,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="w-24 text-sm text-gray-600">
                        = ₹
                        {(
                          parseFloat(denom) *
                          (denominationBreakdown[denom] || 0)
                        ).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Validation */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    Total:
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      isAmountValid ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Expected: {formatCurrency(expectedAmount)}
                  {!isAmountValid && (
                    <span className="text-red-700 ml-2">
                      (Difference: {formatCurrency(Math.abs(total - expectedAmount))})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 btn btn-outline"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={validateAndSubmit}
                  disabled={
                    createMutation.isPending ||
                    selectedBundleIds.size === 0 ||
                    !isAmountValid
                  }
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create SuperBundle
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
