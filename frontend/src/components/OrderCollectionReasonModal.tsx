import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface OrderCollectionReasonModalProps {
  orderId: string
  orderNumber: string
  codAmount: number
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: {
    non_collected_reason: string
    future_collection_possible: boolean
    expected_collection_date?: string
  }) => Promise<void>
}

const COLLECTION_REASONS = [
  'Customer unavailable',
  'Customer refused to pay',
  'Order cancelled by customer',
  'Address incorrect',
  'Customer requested reschedule',
  'Payment dispute',
  'Other',
]

export function OrderCollectionReasonModal({
  orderId,
  orderNumber,
  codAmount,
  isOpen,
  onClose,
  onSubmit,
}: OrderCollectionReasonModalProps) {
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [futureCollection, setFutureCollection] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    setError(null)

    if (!reason) {
      setError('Please select a reason')
      return
    }

    if (reason === 'Other' && !customReason.trim()) {
      setError('Please provide a custom reason')
      return
    }

    if (futureCollection && !expectedDate) {
      setError('Please provide expected collection date')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        non_collected_reason: reason === 'Other' ? customReason.trim() : reason,
        future_collection_possible: futureCollection,
        expected_collection_date: futureCollection ? expectedDate : undefined,
      })
      handleClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update order reason')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setCustomReason('')
    setFutureCollection(false)
    setExpectedDate('')
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Order Not Collected</h2>
            <p className="text-sm text-gray-500 mt-1">Order: {orderNumber}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount Display */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">COD Amount</p>
            <p className="text-2xl font-bold text-yellow-700">
              ₹{codAmount.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="label">Reason for Not Collecting *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
            >
              <option value="">Select a reason</option>
              {COLLECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason */}
          {reason === 'Other' && (
            <div>
              <label className="label">Custom Reason *</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="input"
                rows={3}
                placeholder="Please provide details..."
              />
            </div>
          )}

          {/* Future Collection */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="futureCollection"
              checked={futureCollection}
              onChange={(e) => setFutureCollection(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="futureCollection" className="text-sm text-gray-700">
              Future collection is possible
            </label>
          </div>

          {/* Expected Collection Date */}
          {futureCollection && (
            <div>
              <label className="label">Expected Collection Date *</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              className="btn btn-secondary flex-1"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Reason'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

