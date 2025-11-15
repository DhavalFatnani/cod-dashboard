import { useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Bundle } from '../services/bundleService'
import { formatCurrency } from '../utils/format'
import { bundleService } from '../services/bundleService'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface BundleAcceptanceModalProps {
  bundle: Bundle
  actionType: 'accept' | 'reject'
  isOpen: boolean
  onClose: () => void
}

export function BundleAcceptanceModal({
  bundle,
  actionType,
  isOpen,
  onClose,
}: BundleAcceptanceModalProps) {
  const queryClient = useQueryClient()
  const [denominationBreakdown, setDenominationBreakdown] = useState<
    Record<string, number>
  >(bundle.denomination_breakdown || {})
  const [rejectionReason, setRejectionReason] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const acceptMutation = useMutation({
    mutationFn: () =>
      bundleService.acceptBundle(bundle.id, denominationBreakdown),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['rider-summaries'] })
      onClose()
    },
    onError: (error: any) => {
      setErrors([error.message || 'Failed to accept bundle'])
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => bundleService.rejectBundle(bundle.id, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['rider-summaries'] })
      onClose()
    },
    onError: (error: any) => {
      setErrors([error.message || 'Failed to reject bundle'])
    },
  })

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

  const validateDenominations = () => {
    const total = calculateTotal()
    const expected = parseFloat(bundle.expected_amount?.toString() || '0')
    const tolerance = 0.01

    if (Math.abs(total - expected) > tolerance) {
      return `Total (${formatCurrency(total)}) does not match expected amount (${formatCurrency(expected)})`
    }
    return null
  }

  const handleSubmit = () => {
    setErrors([])

    if (actionType === 'accept') {
      const validationError = validateDenominations()
      if (validationError) {
        setErrors([validationError])
        return
      }
      acceptMutation.mutate()
    } else {
      if (!rejectionReason.trim()) {
        setErrors(['Rejection reason is required'])
        return
      }
      rejectMutation.mutate()
    }
  }

  if (!isOpen) return null

  const total = calculateTotal()
  const expected = parseFloat(bundle.expected_amount?.toString() || '0')
  const isAmountValid = Math.abs(total - expected) < 0.01

  // Common denominations in Indian currency
  const commonDenominations = ['2000', '500', '200', '100', '50', '20', '10']

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-6 pt-5 pb-4 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {actionType === 'accept'
                    ? 'Accept Bundle'
                    : 'Reject Bundle'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Bundle: {bundle.bundle_number}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bundle Info */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Rider</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {bundle.rider_name || bundle.rider_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Expected Amount</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(bundle.expected_amount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                {errors.map((error, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            {actionType === 'accept' ? (
              <>
                {/* Denomination Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
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
                  {!isAmountValid && (
                    <div className="mt-2 text-xs text-red-700">
                      Expected: {formatCurrency(expected)} (Difference:{' '}
                      {formatCurrency(Math.abs(total - expected))})
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Rejection Reason */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter reason for rejection..."
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 btn btn-outline"
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  acceptMutation.isPending ||
                  rejectMutation.isPending ||
                  (actionType === 'accept' && !isAmountValid) ||
                  (actionType === 'reject' && !rejectionReason.trim())
                }
                className={`flex-1 btn ${
                  actionType === 'accept' ? 'btn-primary' : 'btn-danger'
                } flex items-center justify-center gap-2`}
              >
                {acceptMutation.isPending || rejectMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : actionType === 'accept' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Accept Bundle
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Reject Bundle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
