import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { riderBundlesService, CreateBundleRequest } from '../services/riderBundlesService'
import { ordersService } from '../services/ordersService'
import DenominationInput from './DenominationInput'
import PhotoUploader from './PhotoUploader'
import { useQuery } from '@tanstack/react-query'

interface CreateBundleDrawerProps {
  isOpen: boolean
  onClose: () => void
  orderIds: string[]
  onSuccess: () => void
}

export default function CreateBundleDrawer({
  isOpen,
  onClose,
  orderIds,
  onSuccess,
}: CreateBundleDrawerProps) {
  const [denominationBreakdown, setDenominationBreakdown] = useState<Record<string, number>>({})
  const [photoProofs, setPhotoProofs] = useState<string[]>([])
  const [digitalSignoff, setDigitalSignoff] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch orders to calculate expected amount
  const { data: ordersData } = useQuery({
    queryKey: ['bundle-orders', orderIds],
    queryFn: async () => {
      const result = await ordersService.getOrders({}, 1, 1000)
      return result.data?.filter((o) => orderIds.includes(o.id)) || []
    },
    enabled: isOpen && orderIds.length > 0,
  })

  const orders = ordersData || []
  const expectedAmount = orders.reduce(
    (sum, o) => sum + (o.collected_amount || o.cod_amount || 0),
    0
  )

  useEffect(() => {
    if (!isOpen) {
      // Reset form when drawer closes
      setDenominationBreakdown({})
      setPhotoProofs([])
      setDigitalSignoff(false)
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setError(null)

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
      const request: CreateBundleRequest = {
        order_ids: orderIds,
        denomination_breakdown: denominationBreakdown,
        photo_proofs: photoProofs,
        digital_signoff: digitalSignoff,
      }

      await riderBundlesService.createBundle(request)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create bundle')
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
            <h2 className="text-xl font-semibold text-gray-900">Create Bundle</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orders Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              {orders.length} order{orders.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-2xl font-bold text-gray-900">
              ₹{expectedAmount.toFixed(2)}
            </p>
          </div>

          {/* Denomination Input */}
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

          {/* Photo Uploader */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Photo Proofs
            </label>
            <PhotoUploader
              value={photoProofs}
              onChange={setPhotoProofs}
              maxFiles={5}
            />
          </div>

          {/* Digital Signoff */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="signoff"
              checked={digitalSignoff}
              onChange={(e) => setDigitalSignoff(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="signoff" className="text-sm text-gray-700">
              I confirm that the cash denominations are accurate and the bundle is ready for handover. *
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
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Bundle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
