import { useState } from 'react'
import { X, CheckCircle, XCircle } from 'lucide-react'
import { asmBundleActionsService, AcceptBundleRequest } from '../services/asmBundleActionsService'
import DenominationInput from './DenominationInput'
import { RiderBundle } from '../services/riderBundlesService'

interface BundleAcceptanceModalProps {
  isOpen: boolean
  onClose: () => void
  bundle: RiderBundle | null
  onSuccess: () => void
}

export default function BundleAcceptanceModal({
  isOpen,
  onClose,
  bundle,
  onSuccess,
}: BundleAcceptanceModalProps) {
  const [validationStatus, setValidationStatus] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [actualDenominations, setActualDenominations] = useState<Record<string, number>>({})
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !bundle) return null

  const handleSubmit = async () => {
    if (!validationStatus) {
      setError('Please select accept or reject')
      return
    }

    if (validationStatus === 'ACCEPTED' && Object.keys(actualDenominations).length === 0) {
      setError('Please enter actual denominations for acceptance')
      return
    }

    if (validationStatus === 'REJECTED' && !comments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const request: AcceptBundleRequest = {
        bundle_id: bundle.id,
        validation_status: validationStatus,
        actual_denominations: validationStatus === 'ACCEPTED' ? actualDenominations : undefined,
        comments: comments || undefined,
      }

      await asmBundleActionsService.acceptBundle(request)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to process bundle')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative max-w-3xl mx-auto my-8 bg-white rounded-lg shadow-xl">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Bundle Validation</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bundle Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Bundle ID: {bundle.id.slice(0, 8)}...</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₹{bundle.expected_amount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {bundle.rider_bundle_orders?.length || 0} orders
            </p>
          </div>

          {/* Expected Denominations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Expected Denominations (from Rider)
            </label>
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

          {/* Validation Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Validation Decision *
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setValidationStatus('ACCEPTED')}
                className={`flex-1 p-4 border-2 rounded-lg ${
                  validationStatus === 'ACCEPTED'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <CheckCircle
                  className={`w-6 h-6 mx-auto mb-2 ${
                    validationStatus === 'ACCEPTED' ? 'text-green-600' : 'text-gray-400'
                  }`}
                />
                <p className="font-medium">Accept</p>
              </button>
              <button
                type="button"
                onClick={() => setValidationStatus('REJECTED')}
                className={`flex-1 p-4 border-2 rounded-lg ${
                  validationStatus === 'REJECTED'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-red-300'
                }`}
              >
                <XCircle
                  className={`w-6 h-6 mx-auto mb-2 ${
                    validationStatus === 'REJECTED' ? 'text-red-600' : 'text-gray-400'
                  }`}
                />
                <p className="font-medium">Reject</p>
              </button>
            </div>
          </div>

          {/* Actual Denominations (if accepting) */}
          {validationStatus === 'ACCEPTED' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Actual Denominations (verified) *
              </label>
              <DenominationInput
                value={actualDenominations}
                onChange={setActualDenominations}
                expectedAmount={bundle.expected_amount}
              />
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments {validationStatus === 'REJECTED' && '*'}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                validationStatus === 'REJECTED'
                  ? 'Please provide reason for rejection...'
                  : 'Add any notes...'
              }
            />
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
              disabled={submitting}
              className={`px-4 py-2 text-white rounded-lg ${
                validationStatus === 'ACCEPTED'
                  ? 'bg-green-600 hover:bg-green-700'
                  : validationStatus === 'REJECTED'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-400 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {submitting ? 'Processing...' : validationStatus === 'ACCEPTED' ? 'Accept Bundle' : 'Reject Bundle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
