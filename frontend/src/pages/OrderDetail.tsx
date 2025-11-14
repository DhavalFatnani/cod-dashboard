import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '../services/ordersService'
import { formatCurrency, formatDate } from '../utils/format'
import { useUserStore } from '../stores/userStore'
import { ArrowLeft, Clock, FileText, CheckCircle, Upload, QrCode, Banknote, Image as ImageIcon, X } from 'lucide-react'
import { OrderTimeline } from '../components/OrderTimeline'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { ContextualGuidance } from '../components/ContextualGuidance'
import { StateIndicator } from '../components/StateIndicator'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { profile, loading: profileLoading } = useUserStore()
  const { user } = useAuthStore()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [generatedQRUrl, setGeneratedQRUrl] = useState<string>('')
  const [partialAmount, setPartialAmount] = useState<string>('')
  const [isPartialCollection, setIsPartialCollection] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBack = () => {
    // Navigate back to dashboard (index route) with filters preserved from URL params
    const params = searchParams.toString()
    navigate(`/${params ? `?${params}` : ''}`)
  }

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersService.getOrder(id!),
    enabled: !!id,
  })

  const { data: timeline } = useQuery({
    queryKey: ['order-timeline', id],
    queryFn: () => ordersService.getOrderTimeline(id!),
    enabled: !!id,
  })

  const markHardCashCollectedMutation = useMutation({
    mutationFn: async () => {
      if (!order || !profile?.asm_id || !profile.full_name) {
        throw new Error('Invalid order or user profile')
      }
      
      const collectedAmount = isPartialCollection && partialAmount 
        ? parseFloat(partialAmount) 
        : undefined

      if (collectedAmount !== undefined) {
        if (isNaN(collectedAmount) || collectedAmount <= 0 || collectedAmount > order.cod_amount) {
          throw new Error(`Collected amount must be between 0 and ${formatCurrency(order.cod_amount)}`)
        }
      }

      console.log('🔄 Marking hard cash collected:', {
        orderId: order.id,
        asmId: profile.asm_id,
        asmName: profile.full_name,
        collectedAmount,
      })
      const result = await ordersService.markHardCashCollected(
        order.id,
        profile.asm_id,
        profile.full_name,
        collectedAmount
      )
      console.log('✅ Mark hard cash collected result:', result)
      return result
    },
    onSuccess: async () => {
      console.log('✅ Successfully marked hard cash collected')
      setPartialAmount('')
      setIsPartialCollection(false)
      
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', id] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
      ])
      
      // Force refetch to ensure latest data
      await queryClient.refetchQueries({ queryKey: ['order', id] })
    },
    onError: (error) => {
      console.error('❌ Error marking hard cash collected:', error)
      alert(`Error: ${error.message || 'Failed to mark cash collected'}`)
    },
  })

  const markCashCollectedByRiderMutation = useMutation({
    mutationFn: async () => {
      if (!order || !profile?.rider_id || !profile.full_name) {
        throw new Error('Invalid order or rider profile')
      }
      return ordersService.markCashCollectedByRider(
        order.id,
        profile.rider_id,
        profile.full_name
      )
    },
    onSuccess: async () => {
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', id] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
      ])
      
      // Force refetch to ensure latest data
      await queryClient.refetchQueries({ queryKey: ['order', id] })
    },
    onError: (error) => {
      alert(`Error: ${error.message || 'Failed to mark cash collected'}`)
    },
  })

  const markQRPaymentCollectedMutation = useMutation({
    mutationFn: async () => {
      if (!order || !profile?.asm_id || !profile.full_name || !selectedFile || !user) {
        throw new Error('Invalid order, user profile, or no screenshot selected')
      }
      
      const collectedAmount = isPartialCollection && partialAmount 
        ? parseFloat(partialAmount) 
        : undefined

      if (collectedAmount !== undefined) {
        if (isNaN(collectedAmount) || collectedAmount <= 0 || collectedAmount > order.cod_amount) {
          throw new Error(`Collected amount must be between 0 and ${formatCurrency(order.cod_amount)}`)
        }
      }

      return ordersService.markQRPaymentCollected(
        order.id,
        profile.asm_id,
        profile.full_name,
        selectedFile,
        user.id,
        collectedAmount
      )
    },
    onSuccess: async () => {
      setSelectedFile(null)
      setPartialAmount('')
      setIsPartialCollection(false)
      
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', id] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
      ])
      
      // Force refetch to ensure latest data
      await queryClient.refetchQueries({ queryKey: ['order', id] })
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleGenerateDynamicQR = () => {
    if (!order) return
    
    // Generate sample UPI QR code URL
    // Format: upi://pay?pa=merchant@bank&pn=MerchantName&am=amount&cu=INR&tn=OrderNumber
    const upiString = `upi://pay?pa=merchant@ybl&pn=COD%20Dashboard&am=${order.cod_amount}&cu=INR&tn=${order.order_number}`
    
    // Generate QR code using a QR code API (sample using qrserver.com)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`
    
    setGeneratedQRUrl(qrUrl)
    setShowQRModal(true)
  }

  // Auto-close QR modal after marking as collected
  useEffect(() => {
    if (markHardCashCollectedMutation.isSuccess) {
      setShowQRModal(false)
    }
  }, [markHardCashCollectedMutation.isSuccess])

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (isLoading || profileLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Order not found</p>
      </div>
    )
  }

  const canMarkCollected =
    profile?.role === 'asm' &&
    order.payment_type === 'COD' &&
    order.money_state === 'COLLECTED_BY_RIDER' &&
    (!order.asm_id || order.asm_id === profile.asm_id)

    const canRiderMarkCollected =
    profile?.role === 'rider' &&
    order.payment_type === 'COD' &&
    order.money_state === 'UNCOLLECTED' &&
    (!order.rider_id || order.rider_id === profile.rider_id)

  const isHardCash = order.cod_type === 'COD_HARD'
  const isQRCode = order.cod_type === 'COD_QR'

  const getMoneyStateBadge = (state: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      UNCOLLECTED: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
      COLLECTED_BY_RIDER: { bg: 'bg-blue-50', text: 'text-blue-700' },
      HANDOVER_TO_ASM: { bg: 'bg-purple-50', text: 'text-purple-700' },
      PENDING_TO_DEPOSIT: { bg: 'bg-orange-50', text: 'text-orange-700' },
      DEPOSITED: { bg: 'bg-green-50', text: 'text-green-700' },
      RECONCILED: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-700' },
      RTO: { bg: 'bg-gray-50', text: 'text-gray-700' },
    }
    const color = colors[state] || { bg: 'bg-gray-50', text: 'text-gray-700' }
    return (
      <span className={`badge ${color.bg} ${color.text}`}>
        {state.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Order Details</h1>
              <p className="text-sm text-gray-500 mt-1">{order.order_number}</p>
            </div>
            {getMoneyStateBadge(order.money_state)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8">
        {/* State Indicator */}
        <div className="mb-6">
          <StateIndicator
            currentState={order.money_state}
            nextState={
              order.money_state === 'UNCOLLECTED' && profile?.role === 'rider'
                ? 'COLLECTED_BY_RIDER'
                : order.money_state === 'COLLECTED_BY_RIDER' && profile?.role === 'asm'
                ? 'HANDOVER_TO_ASM'
                : undefined
            }
            nextAction={
              order.money_state === 'UNCOLLECTED' && profile?.role === 'rider'
                ? 'Mark Cash Collected'
                : order.money_state === 'COLLECTED_BY_RIDER' && profile?.role === 'asm'
                ? 'Mark Collected from Rider'
                : undefined
            }
            variant={
              order.money_state === 'RECONCILED'
                ? 'success'
                : order.money_state === 'CANCELLED'
                ? 'error'
                : 'default'
            }
          />
        </div>

        {/* Contextual Guidance */}
        {order.money_state === 'UNCOLLECTED' && profile?.role === 'rider' && (
          <ContextualGuidance
            id="rider-collect-guidance"
            title="Collect Cash from Customer"
            message="Once you collect the cash from the customer, click 'Mark Cash Collected' below. If you collected a partial amount, you can specify it."
            variant="info"
            showForRoles={['rider']}
            priority="high"
          />
        )}

        {order.money_state === 'COLLECTED_BY_RIDER' && profile?.role === 'asm' && (
          <ContextualGuidance
            id="asm-collect-from-rider"
            title="Collect Cash from Rider"
            message="Collect the cash from the rider and mark the order as collected. If the rider couldn't collect full amount, you can mark partial collection or mark as not collected with a reason."
            variant="warning"
            showForRoles={['asm']}
            priority="high"
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Information */}
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Order Information</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Order Number</p>
                  <p className="text-base font-medium text-gray-900">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Payment Type</p>
                  <p className="text-base font-medium text-gray-900">{order.payment_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Customer Name</p>
                  <p className="text-base text-gray-900">{order.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Customer Phone</p>
                  <p className="text-base text-gray-900">{order.customer_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Store</p>
                  <p className="text-base text-gray-900">{order.store_name || order.store_id || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Order Amount</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatCurrency(order.order_amount)}
                  </p>
                </div>
                {order.payment_type === 'COD' && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">COD Amount</p>
                      <p className="text-base font-semibold text-blue-600">
                        {formatCurrency(order.cod_amount)}
                      </p>
                    </div>
                    {order.collected_amount !== null && order.collected_amount !== order.cod_amount && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Collected Amount</p>
                        <p className="text-base font-semibold text-orange-600">
                          {formatCurrency(order.collected_amount)}
                        </p>
                        {order.collection_discrepancy !== null && order.collection_discrepancy > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Shortfall: {formatCurrency(order.collection_discrepancy)}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">COD Type</p>
                      <p className="text-base text-gray-900">{order.cod_type || '-'}</p>
                    </div>
                    {order.is_partial_collection && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Collection Status</p>
                        <span className="badge bg-orange-100 text-orange-700">
                          Partial Collection
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rider</p>
                  <p className="text-base text-gray-900">{order.rider_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">ASM</p>
                  <p className="text-base text-gray-900">{order.asm_name || '-'}</p>
                </div>
              </div>
            </div>

            {/* Payment Screenshot Section */}
            {order.payment_screenshot_url && (
              <div className="card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Payment Screenshot</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 mb-2">
                      ✓ Payment screenshot uploaded on {formatDate(order.payment_screenshot_uploaded_at || '')}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={order.payment_screenshot_url}
                      alt="Payment Screenshot"
                      className="w-full h-auto"
                    />
                  </div>
                  <a
                    href={order.payment_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    View Full Size
                  </a>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Order Timeline</h2>
              </div>
              <OrderTimeline timeline={timeline || []} order={order} />
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-gray-400" />
                Actions
              </h3>
              
              {/* Rider Actions */}
              {canRiderMarkCollected && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Mark cash collected from customer
                  </p>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (confirm(`Mark cash collected for order ${order.order_number}?`)) {
                        markCashCollectedByRiderMutation.mutate()
                      }
                    }}
                    disabled={markCashCollectedByRiderMutation.isPending}
                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {markCashCollectedByRiderMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Mark Cash Collected
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 italic">
                    * This will update the order status to "With Rider"
                  </p>
                </div>
              )}

              {/* ASM Actions - QR Payment */}
              {canMarkCollected && isQRCode && !order.payment_screenshot_url && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Upload payment screenshot to mark as collected
                  </p>
                  
                  {/* Partial Collection Toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="partial-qr"
                      checked={isPartialCollection}
                      onChange={(e) => {
                        setIsPartialCollection(e.target.checked)
                        if (!e.target.checked) setPartialAmount('')
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="partial-qr" className="text-sm text-gray-700 cursor-pointer">
                      Partial collection
                    </label>
                  </div>

                  {/* Partial Amount Input */}
                  {isPartialCollection && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Collected Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={order.cod_amount}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          placeholder={`Max: ${formatCurrency(order.cod_amount)}`}
                          className="input w-full pl-8"
                        />
                      </div>
                      {partialAmount && parseFloat(partialAmount) > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Remaining: {formatCurrency(order.cod_amount - parseFloat(partialAmount || '0'))}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* File Upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {!selectedFile ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary w-full flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Select Screenshot
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700 font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="btn btn-secondary flex-1"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => markQRPaymentCollectedMutation.mutate()}
                          disabled={markQRPaymentCollectedMutation.isPending || (isPartialCollection && (!partialAmount || parseFloat(partialAmount) <= 0))}
                          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                          {markQRPaymentCollectedMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Mark Collected
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canMarkCollected && isHardCash && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Choose collection method:
                  </p>
                  
                  {/* Partial Collection Toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="partial-hard"
                      checked={isPartialCollection}
                      onChange={(e) => {
                        setIsPartialCollection(e.target.checked)
                        if (!e.target.checked) setPartialAmount('')
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="partial-hard" className="text-sm text-gray-700 cursor-pointer">
                      Partial collection
                    </label>
                  </div>

                  {/* Partial Amount Input */}
                  {isPartialCollection && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Collected Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={order.cod_amount}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          placeholder={`Max: ${formatCurrency(order.cod_amount)}`}
                          className="input w-full pl-8"
                        />
                      </div>
                      {partialAmount && parseFloat(partialAmount) > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Remaining: {formatCurrency(order.cod_amount - parseFloat(partialAmount || '0'))}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Mark Cash Collected */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🔘 Button clicked - Mark Cash Collected')
                      console.log('🔘 Mutation state:', {
                        isPending: markHardCashCollectedMutation.isPending,
                        isError: markHardCashCollectedMutation.isError,
                        isSuccess: markHardCashCollectedMutation.isSuccess,
                      })
                      markHardCashCollectedMutation.mutate()
                    }}
                    disabled={markHardCashCollectedMutation.isPending || (isPartialCollection && (!partialAmount || parseFloat(partialAmount) <= 0))}
                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {markHardCashCollectedMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Mark Cash Collected
                      </>
                    )}
                  </button>

                  {/* Generate Dynamic QR */}
                  <button
                    onClick={handleGenerateDynamicQR}
                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Generate Dynamic QR for UPI
                  </button>
                  
                  <p className="text-xs text-gray-500 italic">
                    * Generate UPI QR code for customer to scan and pay
                  </p>
                </div>
              )}

              {!canMarkCollected && (
                <p className="text-sm text-gray-500">
                  No actions available for this order
                </p>
              )}
            </div>

            {/* Key Dates */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Key Dates
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                {order.dispatched_at && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Dispatched</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.dispatched_at)}
                    </p>
                  </div>
                )}
                {order.collected_at && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Collected</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.collected_at)}
                    </p>
                  </div>
                )}
                {order.handover_to_asm_at && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Handover to ASM</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.handover_to_asm_at)}
                    </p>
                  </div>
                )}
                {order.deposited_at && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Deposited</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.deposited_at)}
                    </p>
                  </div>
                )}
                {order.reconciled_at && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reconciled</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(order.reconciled_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <QrCode className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">UPI Payment QR Code</h2>
                  <p className="text-sm text-gray-500">Order: {order?.order_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Amount Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Amount to Collect</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(order?.cod_amount || 0)}
                </p>
              </div>

              {/* QR Code Display */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6 flex items-center justify-center">
                {generatedQRUrl && (
                  <img
                    src={generatedQRUrl}
                    alt="UPI QR Code"
                    className="w-64 h-64"
                  />
                )}
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Instructions:</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Show this QR code to the customer</li>
                  <li>Customer scans with any UPI app</li>
                  <li>Verify payment received in your UPI app</li>
                  <li>Click "Mark Payment Collected" below</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    markHardCashCollectedMutation.mutate()
                    setShowQRModal(false)
                  }}
                  disabled={markHardCashCollectedMutation.isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {markHardCashCollectedMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Mark Payment Collected
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center italic">
                Note: This is a sample QR. Integration with actual UPI gateway coming soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
