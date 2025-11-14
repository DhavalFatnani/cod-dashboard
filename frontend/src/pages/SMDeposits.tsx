import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { depositService, PendingOrder, OrderCollectionData } from '../services/depositService'
import { useUserStore } from '../stores/userStore'
import { formatCurrency, formatDate } from '../utils/format'
import {
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Upload,
  DollarSign,
  AlertCircle,
  Users,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { read, utils } from 'xlsx'
import { Link } from 'react-router-dom'
import { ContextualGuidance } from '../components/ContextualGuidance'
import { ActionWizard, WizardStep } from '../components/ActionWizard'

interface ParsedResult {
  matchedOrderIds: string[]
  unmatchedOrderNumbers: string[]
}

export default function SMDeposits() {
  const { profile, loading } = useUserStore()
  const queryClient = useQueryClient()
  const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({})
  const [depositSlip, setDepositSlip] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ParsedResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const depositSlipInputRef = useRef<HTMLInputElement>(null)
  const ordersFileInputRef = useRef<HTMLInputElement>(null)
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bankAccount, setBankAccount] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [actualAmountReceived, setActualAmountReceived] = useState<string>('')
  const [asmHandoverFile, setAsmHandoverFile] = useState<File | null>(null)
  const [orderCollectionData, setOrderCollectionData] = useState<Record<string, OrderCollectionData>>({})
  const [asmHandoverDataId, setAsmHandoverDataId] = useState<string | null>(null)
  const [selectedAsmId, setSelectedAsmId] = useState<string | null>(null)
  const asmHandoverFileInputRef = useRef<HTMLInputElement>(null)
  const [showDepositWizard, setShowDepositWizard] = useState(false)

  const { data: pendingOrders = [], isLoading } = useQuery({
    queryKey: ['pending-deposit-orders'],
    queryFn: depositService.fetchPendingOrders,
    refetchInterval: 5000,
  })

  useEffect(() => {
    setImportError(null)
    setValidationError(null)
    setSuccessMessage(null)
  }, [])

  const filteredOrders = useMemo(() => {
    if (!selectedAsmId) return pendingOrders.filter((order) => order.asm_id)
    return pendingOrders.filter((order) => order.asm_id === selectedAsmId)
  }, [pendingOrders, selectedAsmId])

  const selectedList = useMemo(() => filteredOrders.filter((order) => selectedOrders[order.id]), [filteredOrders, selectedOrders])

  // Group orders by ASM
  const groupedByAsm = useMemo(() => {
    return filteredOrders.reduce<Record<string, {
      orders: PendingOrder[]
      collected: PendingOrder[]
      notCollected: PendingOrder[]
      totalAmount: number
      collectedAmount: number
    }>>((acc, order) => {
      if (!order.asm_id) return acc
      if (!acc[order.asm_id]) {
        acc[order.asm_id] = {
          orders: [],
          collected: [],
          notCollected: [],
          totalAmount: 0,
          collectedAmount: 0,
        }
      }
      acc[order.asm_id].orders.push(order)
      acc[order.asm_id].totalAmount += Number(order.cod_amount || 0)
      
      const collectionData = orderCollectionData[order.id]
      // Order is "Not Collected" if:
      // 1. It has asm_non_collected_reason set (marked as not collected by ASM), OR
      // 2. Collection data from CSV shows NOT_COLLECTED status
      const isNotCollected = order.asm_non_collected_reason !== null && order.asm_non_collected_reason !== '' ||
                            (collectionData && collectionData.collection_status === 'NOT_COLLECTED')
      
      if (isNotCollected) {
        acc[order.asm_id].notCollected.push(order)
      } else {
        acc[order.asm_id].collected.push(order)
        // Use collected_amount if available (for partial collections), otherwise use cod_amount
        const amount = order.collected_amount !== null && order.collected_amount !== undefined
          ? Number(order.collected_amount)
          : Number(order.cod_amount || 0)
        acc[order.asm_id].collectedAmount += amount
      }
      return acc
    }, {})
  }, [filteredOrders, orderCollectionData])

  const totals = useMemo(() => {
    const totalAmount = selectedList.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0)
    const uniqueAsmIds = new Set(selectedList.map((order) => order.asm_id))
    
    // Calculate expected amount from collected orders only
    // This is the sum of COD amounts from orders that ASM has collected (HANDOVER_TO_ASM state)
    // Exclude orders marked as "Not Collected" by ASM (asm_non_collected_reason is set)
    const collectedOrders = selectedList.filter((order) => {
      // Exclude if marked as not collected by ASM
      if (order.asm_non_collected_reason !== null && order.asm_non_collected_reason !== '') {
        return false
      }
      
      const collectionData = orderCollectionData[order.id]
      // Exclude if CSV data shows NOT_COLLECTED
      if (collectionData && collectionData.collection_status === 'NOT_COLLECTED') {
        return false
      }
      
      // Order is considered collected if:
      // 1. It's in HANDOVER_TO_ASM state (money_state), OR
      // 2. Collection data shows COLLECTED status, OR
      // 3. No collection data exists but order is in HANDOVER_TO_ASM state
      return order.money_state === 'HANDOVER_TO_ASM' || 
             (collectionData && collectionData.collection_status === 'COLLECTED') ||
             (!collectionData && order.money_state === 'HANDOVER_TO_ASM')
    })
    const expectedFromCollected = collectedOrders.reduce((sum, order) => {
      // Use collected_amount if available (for partial collections), otherwise use cod_amount
      const amount = order.collected_amount !== null && order.collected_amount !== undefined 
        ? Number(order.collected_amount) 
        : Number(order.cod_amount || 0)
      return sum + amount
    }, 0)
    
    return {
      count: selectedList.length,
      totalAmount,
      expectedAmount: expectedFromCollected, // Always auto-calculated, never manual
      collectedCount: collectedOrders.length,
      notCollectedCount: selectedList.length - collectedOrders.length,
      asmCount: uniqueAsmIds.size,
      asmId: uniqueAsmIds.size === 1 ? selectedList[0]?.asm_id ?? '' : '',
      asmName: uniqueAsmIds.size === 1 ? selectedList[0]?.asm_name ?? '' : '',
    }
  }, [selectedList, orderCollectionData])

  // Fetch ASM handover data when ASM is selected
  const { data: asmHandoverDataList = [] } = useQuery({
    queryKey: ['asm-handover-data', totals.asmId],
    queryFn: () => {
      if (!totals.asmId) return []
      return depositService.fetchASMHandoverData(totals.asmId)
    },
    enabled: !!totals.asmId && totals.asmCount === 1,
  })

  // Expected amount is now auto-calculated in totals.useMemo, no manual updates needed

  const createDepositMutation = useMutation({
    mutationFn: async () => {
      if (!profile || profile.role !== 'sm') {
        throw new Error('Only Store Managers can create deposits')
      }

      if (!depositSlip) {
        throw new Error('Please upload a deposit slip before submitting')
      }

      if (totals.count === 0) {
        throw new Error('Select at least one order to include in the deposit')
      }

      if (totals.asmCount !== 1 || !totals.asmId) {
        throw new Error('Selected orders must belong to a single ASM')
      }

      // Build order collection data array
      const orderCollectionDataArray: OrderCollectionData[] = selectedList.map((order) => {
        const collectionData = orderCollectionData[order.id]
        if (collectionData) {
          return {
            order_id: order.id,
            collection_status: collectionData.collection_status,
            non_collection_reason: collectionData.non_collection_reason,
            future_collection_date: collectionData.future_collection_date,
          }
        }
        // Default to collected if no collection data
        return {
          order_id: order.id,
          collection_status: 'COLLECTED',
        }
      })

      // Calculate total amount from collected orders only
      const collectedAmount = selectedList
        .filter((order) => {
          const data = orderCollectionData[order.id]
          return !data || data.collection_status === 'COLLECTED'
        })
        .reduce((sum, order) => sum + Number(order.cod_amount || 0), 0)

      return depositService.createDeposit({
        asmId: totals.asmId,
        asmName: totals.asmName ?? null,
        orderIds: orderCollectionDataArray,
        totalAmount: collectedAmount,
        expectedAmount: totals.expectedAmount,
        actualAmountReceived: actualAmountReceived ? parseFloat(actualAmountReceived) : undefined,
        depositDate,
        bankAccount: bankAccount || undefined,
        referenceNumber: referenceNumber || undefined,
        depositSlipFile: depositSlip,
        smUserId: profile.id,
        smName: profile.full_name,
        asmHandoverDataId: asmHandoverDataId || undefined,
      })
    },
    onSuccess: async () => {
      setSuccessMessage('Deposit created successfully. Orders moved to reconciliation pending.')
      setValidationError(null)
      setImportError(null)
      setDepositSlip(null)
      setSelectedOrders({})
      setReferenceNumber('')
      setActualAmountReceived('')
      setAsmHandoverFile(null)
      setOrderCollectionData({})
      setAsmHandoverDataId(null)
      setSelectedAsmId(null)
      
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Invalidate all related queries to ensure UI is in sync
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-deposit-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['asm-handover-data'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
      ])
      
      // Force refetch to ensure latest data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['pending-deposit-orders'] }),
        queryClient.refetchQueries({ queryKey: ['orders'] }),
        queryClient.refetchQueries({ queryKey: ['kpi-metrics'] }),
      ])
    },
    onError: (error: any) => {
      setValidationError(error.message || 'Failed to create deposit')
    },
  })

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) => ({ ...prev, [orderId]: checked }))
  }

  const handleSelectAll = (asmId: string, checked: boolean) => {
    const updates: Record<string, boolean> = {}
    groupedByAsm[asmId]?.orders.forEach((order) => {
      updates[order.id] = checked
    })
    setSelectedOrders((prev) => ({ ...prev, ...updates }))
  }

  const handleSelectCollected = (asmId: string) => {
    const updates: Record<string, boolean> = {}
    groupedByAsm[asmId]?.collected.forEach((order) => {
      updates[order.id] = true
    })
    setSelectedOrders((prev) => ({ ...prev, ...updates }))
  }

  const handleDepositSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDepositSlip(e.target.files[0])
    }
  }

  const parseOrdersFile = async (file: File) => {
    const data = await file.arrayBuffer()
    const workbook = read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

    const orderNumbers = json
      .map((row) => {
        const value = row.order_number || row.order || row['Order'] || row['Order Number'] || row['orderNumber']
        return typeof value === 'string' ? value.trim() : ''
      })
      .filter(Boolean) as string[]

    const matches: string[] = []
    const unmatched: string[] = []

    orderNumbers.forEach((orderNumber) => {
      const order = filteredOrders.find((o) => o.order_number === orderNumber)
      if (order) {
        matches.push(order.id)
      } else {
        unmatched.push(orderNumber)
      }
    })

    return { matchedOrderIds: matches, unmatchedOrderNumbers: unmatched }
  }

  const handleOrdersImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImportError(null)
      setImportResult(null)
      const result = await parseOrdersFile(file)

      if (result.matchedOrderIds.length === 0) {
        setImportError('No matching orders found in the uploaded file.')
        return
      }

      const updates: Record<string, boolean> = {}
      result.matchedOrderIds.forEach((id) => {
        updates[id] = true
      })

      setSelectedOrders((prev) => ({ ...prev, ...updates }))
      setImportResult(result)
    } catch (error: any) {
      console.error('Error parsing orders file', error)
      setImportError('Failed to read file. Ensure it is a valid CSV or Excel file with an "order_number" column.')
    }
  }

  const handleASMHandoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImportError(null)
      const data = await file.arrayBuffer()
      const workbook = read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

      const collectionDataMap: Record<string, OrderCollectionData> = {}

      json.forEach((row) => {
        const orderNumber = (row.order_number || row.order || row['Order'] || row['Order Number'] || '').toString().trim()
        const order = filteredOrders.find((o) => o.order_number === orderNumber)
        
        if (order) {
          const status = (row.collection_status || row.status || 'COLLECTED').toString().toUpperCase()
          collectionDataMap[order.id] = {
            order_id: order.id,
            collection_status: status === 'NOT_COLLECTED' ? 'NOT_COLLECTED' : 'COLLECTED',
            non_collection_reason: row.non_collection_reason || row.reason || undefined,
            future_collection_date: row.future_collection_date || row.expected_collection_date || undefined,
          }
        }
      })

      setOrderCollectionData((prev) => ({ ...prev, ...collectionDataMap }))
      setAsmHandoverFile(file)

      // Upload file and get URL
      if (profile) {
        const fileUrl = await depositService.uploadHandoverDataFile(file, profile.id)
        // Store file URL in state or use it for handover data creation
      }
    } catch (error: any) {
      console.error('Error parsing ASM handover file', error)
      setImportError('Failed to read ASM handover file. Ensure it is a valid CSV or Excel file.')
    }
  }

  const amountMismatch = useMemo(() => {
    if (!actualAmountReceived || totals.expectedAmount === 0) return false
    const actual = parseFloat(actualAmountReceived)
    return Math.abs(totals.expectedAmount - actual) >= 0.01
  }, [totals.expectedAmount, actualAmountReceived])

  // Calculate overall stats
  const overallStats = useMemo(() => {
    let totalOrders = 0
    let totalCollected = 0
    let totalNotCollected = 0
    let totalAmount = 0
    let collectedAmount = 0

    Object.values(groupedByAsm).forEach((group) => {
      totalOrders += group.orders.length
      totalCollected += group.collected.length
      totalNotCollected += group.notCollected.length
      totalAmount += group.totalAmount
      collectedAmount += group.collectedAmount
    })

    return {
      totalOrders,
      totalCollected,
      totalNotCollected,
      totalAmount,
      collectedAmount,
      asmCount: Object.keys(groupedByAsm).length,
    }
  }, [groupedByAsm])

  // Render orders list component
  const renderOrdersList = () => {
    if (Object.keys(groupedByAsm).length === 0) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 font-medium mb-1">No orders pending</p>
          <p className="text-sm text-gray-500">All orders have been processed</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {Object.entries(groupedByAsm).map(([asmId, group]) => {
          const asmName = group.orders[0]?.asm_name || asmId
          const allSelected = group.orders.every((order) => selectedOrders[order.id])
          const selectedCount = group.orders.filter((order) => selectedOrders[order.id]).length

          return (
            <div key={asmId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* ASM Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{asmName}</h3>
                      <p className="text-sm text-gray-600">{group.orders.length} orders</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSelectCollected(asmId)}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Select Collected ({group.collected.length})
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(asmId, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Select All ({selectedCount}/{group.orders.length})
                    </label>
                  </div>
                </div>

                {/* ASM Summary */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Total Orders</p>
                      <p className="text-lg font-bold text-gray-900">{group.orders.length}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(group.totalAmount)}</p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-xs text-green-600 mb-1 font-medium">ASM Collected</p>
                      <p className="text-lg font-bold text-green-700">{group.collected.length}</p>
                      <p className="text-xs text-green-600">{formatCurrency(group.collectedAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-orange-600 mb-1 font-medium">Not Collected</p>
                      <p className="text-lg font-bold text-orange-700">{group.notCollected.length}</p>
                      <p className="text-xs text-orange-600">
                        {formatCurrency(group.totalAmount - group.collectedAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Orders List */}
                <div className="divide-y divide-gray-100">
                  {/* Collected Orders */}
                  {group.collected.length > 0 && (
                    <div className="p-4 bg-green-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <h4 className="text-sm font-semibold text-green-900">
                          Collected by ASM ({group.collected.length})
                        </h4>
                        <span className="text-xs text-green-700">
                          Amount: {formatCurrency(group.collectedAmount)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.collected.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={!!selectedOrders[order.id]}
                                onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <Link
                                to={`/orders/${order.id}`}
                                className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                              >
                                {order.order_number}
                              </Link>
                              <span className="badge bg-green-100 text-green-700 text-xs">Collected</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(order.cod_amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not Collected Orders */}
                  {group.notCollected.length > 0 && (
                    <div className="p-4 bg-orange-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4 text-orange-600" />
                        <h4 className="text-sm font-semibold text-orange-900">
                          Not Collected by ASM ({group.notCollected.length})
                        </h4>
                        <span className="text-xs text-orange-700">
                          Amount: {formatCurrency(group.totalAmount - group.collectedAmount)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.notCollected.map((order) => {
                          const collectionData = orderCollectionData[order.id]
                          return (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 bg-white border border-orange-200 rounded-lg hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={!!selectedOrders[order.id]}
                                  onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Link
                                  to={`/orders/${order.id}`}
                                  className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                                >
                                  {order.order_number}
                                </Link>
                                <span className="badge bg-orange-100 text-orange-700 text-xs">Not Collected</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(order.cod_amount)}
                                  </p>
                                  {(order.asm_non_collected_reason || collectionData?.non_collection_reason) && (
                                    <p className="text-xs text-orange-600 mt-0.5">
                                      {order.asm_non_collected_reason || collectionData?.non_collection_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Loading Store Manager workspace...</p>
        </div>
      </div>
    )
  }

  if (!profile || profile.role !== 'sm') {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h1 className="text-xl font-semibold text-gray-900">Access Restricted</h1>
          </div>
          <p className="text-sm text-gray-600">
            This section is only available for Store Manager accounts. If you believe this is an error, please
            contact the administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Manager Deposits</h1>
        <p className="text-gray-600">
          Collect cash from ASMs and create deposits for reconciliation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-200 rounded-lg">
              <Users className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">ASMs</p>
              <p className="text-2xl font-bold text-blue-900">{overallStats.asmCount}</p>
            </div>
          </div>
          <p className="text-sm text-blue-700 font-semibold">
            {overallStats.totalOrders} orders
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-green-800 uppercase tracking-wide">ASM Collected</p>
              <p className="text-2xl font-bold text-green-900">{overallStats.totalCollected}</p>
            </div>
          </div>
          <p className="text-sm text-green-700 font-semibold">
            {formatCurrency(overallStats.collectedAmount)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-orange-800 uppercase tracking-wide">Not Collected</p>
              <p className="text-2xl font-bold text-orange-900">{overallStats.totalNotCollected}</p>
            </div>
          </div>
          <p className="text-sm text-orange-700 font-semibold">
            {formatCurrency(overallStats.totalAmount - overallStats.collectedAmount)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-200 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-purple-800 uppercase tracking-wide">To Collect</p>
              <p className="text-2xl font-bold text-purple-900">{totals.collectedCount}</p>
            </div>
          </div>
          <p className="text-sm text-purple-700 font-semibold">
            {formatCurrency(totals.expectedAmount)}
          </p>
        </div>
      </div>

      {/* Contextual Guidance */}
      {totals.collectedCount > 0 && (
        <ContextualGuidance
          id="sm-deposit-ready"
          title="Ready to Create Deposit"
          message={`You have ${totals.collectedCount} collected order${totals.collectedCount > 1 ? 's' : ''} ready for deposit. Select orders from ASMs and create a deposit. Expected amount is auto-calculated from selected collected orders.`}
          variant="info"
          showForRoles={['sm']}
          priority="high"
        />
      )}

      {amountMismatch && (
        <ContextualGuidance
          id="sm-amount-mismatch"
          title="Amount Mismatch Detected"
          message={`The actual amount received (${formatCurrency(parseFloat(actualAmountReceived || '0'))}) doesn't match the expected amount (${formatCurrency(totals.expectedAmount)}). Please verify the amounts before creating the deposit.`}
          variant="warning"
          showForRoles={['sm']}
          priority="high"
        />
      )}

      {totals.notCollectedCount > 0 && (
        <ContextualGuidance
          id="sm-not-collected-info"
          title="Not Collected Orders"
          message={`${totals.notCollectedCount} order${totals.notCollectedCount > 1 ? 's' : ''} marked as not collected are excluded from the expected amount calculation. You can still include them in the deposit record for tracking purposes.`}
          variant="info"
          showForRoles={['sm']}
          priority="low"
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* ASM Filter */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Filter by ASM</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedAsmId(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedAsmId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ASMs ({overallStats.asmCount})
              </button>
              {Object.keys(groupedByAsm).map((asmId) => {
                const group = groupedByAsm[asmId]
                const asmName = group.orders[0]?.asm_name || asmId
                return (
                  <button
                    key={asmId}
                    onClick={() => setSelectedAsmId(asmId)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAsmId === asmId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {asmName} ({group.orders.length})
                  </button>
                )
              })}
            </div>
          </div>

          {/* ASM Handover Data Section */}
          {totals.asmCount === 1 && totals.asmId && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ASM Collection Data</h2>
                  <p className="text-xs text-gray-500">
                    Upload CSV/XLSX from ASM with order-level collection status
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* ASM Handover Data Selection */}
                {asmHandoverDataList.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select ASM Handover Data
                    </label>
                    <select
                      value={asmHandoverDataId || ''}
                      onChange={(e) => {
                        setAsmHandoverDataId(e.target.value || null)
                        // Expected amount is now auto-calculated, no need to set it manually
                      }}
                      className="input w-full"
                    >
                      <option value="">None (Manual Entry)</option>
                      {asmHandoverDataList
                        .filter((d) => d.status === 'PENDING' || d.status === 'VALIDATED')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {formatDate(d.handover_date)} - {formatCurrency(d.expected_amount)} ({d.status})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Upload ASM Handover File */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload ASM Handover File (CSV/XLSX)
                  </label>
                  <input
                    ref={asmHandoverFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleASMHandoverFileUpload}
                    className="hidden"
                  />
                  <button
                    className="btn btn-secondary flex items-center justify-center gap-2"
                    onClick={() => asmHandoverFileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {asmHandoverFile ? 'Change File' : 'Upload ASM Handover File'}
                  </button>
                  {asmHandoverFile && (
                    <p className="text-xs text-gray-500 mt-2">Selected: {asmHandoverFile.name}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Orders by ASM */}
          {renderOrdersList()}

          {/* Import Orders Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import Orders</h2>
                <p className="text-xs text-gray-500">Upload CSV/XLSX with order numbers</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={ordersFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleOrdersImport}
                className="hidden"
              />
              <button
                className="btn btn-secondary flex items-center justify-center gap-2"
                onClick={() => ordersFileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                Upload CSV / XLSX
              </button>
              <button
                className="btn btn-outline flex items-center justify-center gap-2"
                onClick={() => window.open('data:text/plain,order_number\nORD-12345\nORD-67890', '_blank')}
              >
                Download Template
              </button>
            </div>

            {importResult && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                <p className="font-medium">Imported {importResult.matchedOrderIds.length} orders successfully.</p>
                {importResult.unmatchedOrderNumbers.length > 0 && (
                  <p className="mt-2 text-xs">
                    Unmatched order numbers: {importResult.unmatchedOrderNumbers.join(', ')}
                  </p>
                )}
              </div>
            )}

            {importError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {importError}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deposit Form */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Deposit</h2>
              <p className="text-sm text-gray-600">
                Fill deposit details and submit
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Deposit Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Date
                </label>
                <input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Account
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="input w-full"
                  placeholder="HDFC - COD Collections"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="input w-full"
                  placeholder="Bank reference number"
                />
              </div>

              {/* Amount Fields */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Amount (from ASM)
                    <span className="ml-2 text-xs text-gray-500 font-normal">(Auto-calculated)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrency(totals.expectedAmount)}
                      readOnly
                      className="input w-full bg-gray-50 border-gray-300 cursor-not-allowed"
                      tabIndex={-1}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-400 text-sm">Auto</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Sum of COD amounts from {totals.collectedCount} collected order{totals.collectedCount !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Actual Amount Received
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={
                          actualAmountReceived !== '' &&
                          Math.abs(parseFloat(actualAmountReceived || '0') - totals.expectedAmount) < 0.01
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setActualAmountReceived(totals.expectedAmount.toFixed(2))
                          } else {
                            setActualAmountReceived('')
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Same as Expected</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    value={actualAmountReceived}
                    onChange={(e) => setActualAmountReceived(e.target.value)}
                    className={`input w-full ${amountMismatch ? 'border-red-300 bg-red-50' : ''}`}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Amount Mismatch Warning */}
              {amountMismatch && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Amount mismatch: Expected {formatCurrency(totals.expectedAmount)}, Received {formatCurrency(parseFloat(actualAmountReceived) || 0)}
                </div>
              )}

              {/* Deposit Slip */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Slip
                </label>
                <input
                  ref={depositSlipInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleDepositSlipChange}
                  className="hidden"
                />
                <button
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  onClick={() => depositSlipInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {depositSlip ? 'Change Deposit Slip' : 'Upload Deposit Slip'}
                </button>
                {depositSlip && (
                  <p className="text-xs text-gray-500 mt-2">Selected: {depositSlip.name}</p>
                )}
              </div>

              {/* Summary */}
              <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Selected Orders</span>
                  <span className="font-semibold text-gray-900">{totals.count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-600 font-medium">Collected by ASM</span>
                  <span className="font-semibold text-green-700">{totals.collectedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-600 font-medium">Not Collected</span>
                  <span className="font-semibold text-orange-700">{totals.notCollectedCount}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-600 font-medium">Expected Amount</span>
                  <span className={`font-bold ${amountMismatch ? 'text-yellow-700' : 'text-gray-900'}`}>
                    {formatCurrency(totals.expectedAmount)}
                  </span>
                </div>
                {actualAmountReceived && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Actual Received</span>
                    <span className={`font-bold ${amountMismatch ? 'text-red-700' : 'text-gray-900'}`}>
                      {formatCurrency(parseFloat(actualAmountReceived) || 0)}
                    </span>
                  </div>
                )}
                {totals.asmCount > 1 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Select orders for a single ASM per deposit
                  </div>
                )}
              </div>

              {/* Messages */}
              {validationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {validationError}
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {successMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={() => createDepositMutation.mutate()}
                disabled={createDepositMutation.isPending || totals.count === 0 || totals.asmCount !== 1}
                className="btn btn-primary w-full flex items-center justify-center gap-2 h-11 font-semibold shadow-sm hover:shadow-md transition-shadow"
              >
                {createDepositMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create Deposit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Creation Wizard */}
      <ActionWizard
        isOpen={showDepositWizard}
        onClose={() => {
          setShowDepositWizard(false)
          if (createDepositMutation.isSuccess) {
            setSuccessMessage('Deposit created successfully. Orders moved to reconciliation pending.')
            setDepositSlip(null)
            setSelectedOrders({})
            setReferenceNumber('')
            setActualAmountReceived('')
            setAsmHandoverFile(null)
            setOrderCollectionData({})
            setAsmHandoverDataId(null)
            setSelectedAsmId(null)
          }
        }}
        title="Create Deposit"
        steps={[
          {
            id: 'select-orders',
            title: 'Select Orders',
            description: 'Review selected orders and ASM',
            content: (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">ASM Information</p>
                  <p className="text-sm text-blue-700">{totals.asmName || totals.asmId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Orders: {totals.count}
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-1">
                      {selectedList.slice(0, 10).map((order) => (
                        <div key={order.id} className="text-sm text-gray-600 flex justify-between">
                          <span>{order.order_number}</span>
                          <span className="font-medium">{formatCurrency(order.cod_amount)}</span>
                        </div>
                      ))}
                      {selectedList.length > 10 && (
                        <p className="text-xs text-gray-500 mt-2">
                          ... and {selectedList.length - 10} more orders
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-900 mb-1">Expected Amount</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(totals.expectedAmount)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    From {totals.collectedCount} collected order{totals.collectedCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ),
            validate: () => {
              if (totals.count === 0) return 'Please select at least one order'
              if (totals.asmCount !== 1) return 'All orders must be from the same ASM'
              return true
            },
          },
          {
            id: 'amount-details',
            title: 'Amount Details',
            description: 'Enter actual amount received',
            content: (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Expected Amount (Auto-calculated)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(totals.expectedAmount)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Amount Received
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      value={actualAmountReceived}
                      onChange={(e) => setActualAmountReceived(e.target.value)}
                      className="input w-full"
                      placeholder="0.00"
                      step="0.01"
                    />
                    <button
                      onClick={() => setActualAmountReceived(totals.expectedAmount.toFixed(2))}
                      className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                      Same as Expected
                    </button>
                  </div>
                  {amountMismatch && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-yellow-800">
                        Amount mismatch: Expected {formatCurrency(totals.expectedAmount)}, Received{' '}
                        {formatCurrency(parseFloat(actualAmountReceived || '0'))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ),
            validate: () => {
              if (!actualAmountReceived || parseFloat(actualAmountReceived) <= 0) {
                return 'Please enter the actual amount received'
              }
              return true
            },
          },
          {
            id: 'deposit-details',
            title: 'Deposit Details',
            description: 'Fill in deposit information',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Date
                  </label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Account
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="input w-full"
                    placeholder="HDFC - COD Collections"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="input w-full"
                    placeholder="Bank reference number (optional)"
                  />
                </div>
              </div>
            ),
            validate: () => {
              if (!depositDate) return 'Please select a deposit date'
              return true
            },
          },
          {
            id: 'upload-slip',
            title: 'Upload Deposit Slip',
            description: 'Upload deposit slip image or PDF',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Slip
                  </label>
                  <input
                    ref={depositSlipInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleDepositSlipChange}
                    className="hidden"
                  />
                  <button
                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                    onClick={() => depositSlipInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {depositSlip ? 'Change Deposit Slip' : 'Upload Deposit Slip'}
                  </button>
                  {depositSlip && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700 font-medium">{depositSlip.name}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {(depositSlip.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ),
            validate: () => {
              if (!depositSlip) return 'Please upload a deposit slip'
              return true
            },
          },
          {
            id: 'review',
            title: 'Review & Confirm',
            description: 'Review all details before submitting',
            content: (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">ASM:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {totals.asmName || totals.asmId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Orders:</span>
                    <span className="text-sm font-medium text-gray-900">{totals.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Expected Amount:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(totals.expectedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Actual Amount:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(parseFloat(actualAmountReceived || '0'))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Deposit Date:</span>
                    <span className="text-sm font-medium text-gray-900">{depositDate}</span>
                  </div>
                  {bankAccount && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Bank Account:</span>
                      <span className="text-sm font-medium text-gray-900">{bankAccount}</span>
                    </div>
                  )}
                  {referenceNumber && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reference Number:</span>
                      <span className="text-sm font-medium text-gray-900">{referenceNumber}</span>
                    </div>
                  )}
                  {depositSlip && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Deposit Slip:</span>
                      <span className="text-sm font-medium text-gray-900">{depositSlip.name}</span>
                    </div>
                  )}
                </div>
                {amountMismatch && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 font-medium">
                      Warning: Amount mismatch detected. Please verify before submitting.
                    </p>
                  </div>
                )}
              </div>
            ),
            validate: () => true,
          },
        ]}
        onComplete={async () => {
          await createDepositMutation.mutateAsync()
        }}
      />
    </div>
  )
}
