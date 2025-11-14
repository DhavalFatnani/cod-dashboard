import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '../services/ordersService'
import { asmHandoverService, BulkOrderCollectionData } from '../services/asmHandoverService'
import { exportOrders } from '../services/exportService'
import { useUserStore } from '../stores/userStore'
import { formatCurrency, formatDate } from '../utils/format'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Download,
} from 'lucide-react'
import { OrderCollectionReasonModal } from '../components/OrderCollectionReasonModal'
import { ASMHandoverSummary } from '../components/ASMHandoverSummary'
import { read, utils } from 'xlsx'
import { ContextualGuidance } from '../components/ContextualGuidance'
import { ActionWizard, WizardStep } from '../components/ActionWizard'
import { Link } from 'react-router-dom'

export default function ASMHandover() {
  const { profile, loading: profileLoading } = useUserStore()
  const queryClient = useQueryClient()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Fetch orders for ASM Handover
  // Show COD Hard Cash orders in: UNCOLLECTED, COLLECTED_BY_RIDER, and HANDOVER_TO_ASM states
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['asm-handover-orders', profile?.asm_id],
    queryFn: async () => {
      if (!profile?.asm_id) return []
      
      // Fetch orders in multiple states
      const [uncollectedResult, collectedResult, handoverResult] = await Promise.all([
        ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          money_state: 'UNCOLLECTED',
        }),
        ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          money_state: 'COLLECTED_BY_RIDER',
        }),
        ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          money_state: 'HANDOVER_TO_ASM',
        }),
      ])
      
      // Combine all orders and filter by ASM ID or unassigned orders
      const allOrders = [
        ...uncollectedResult.data,
        ...collectedResult.data,
        ...handoverResult.data,
      ]
      
      return allOrders.filter(
        (o) => 
          o.payment_type === 'COD' &&
          o.cod_type === 'COD_HARD' &&
          ['UNCOLLECTED', 'COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM'].includes(o.money_state) &&
          (!o.asm_id || o.asm_id === profile.asm_id)
      )
    },
    enabled: !!profile?.asm_id,
    refetchInterval: 5000, // Refetch every 5 seconds to sync with order state changes
  })

  // Update order reason mutation
  const updateReasonMutation = useMutation({
    mutationFn: async (data: {
      orderId: string
      reason: {
        non_collected_reason: string
        future_collection_possible: boolean
        expected_collection_date?: string
      }
    }) => {
      return asmHandoverService.updateOrderCollectionReason(
        data.orderId,
        data.reason
      )
    },
    onSuccess: async () => {
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
      ])
      
      // Force refetch to ensure latest data
      await queryClient.refetchQueries({ queryKey: ['asm-handover-orders'] })
    },
    onError: (error: any) => {
      console.error('Error updating order reason:', error)
      alert(`Error: ${error.message || 'Failed to update order reason'}`)
    },
  })

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (file: File) => {
      return asmHandoverService.bulkUpdateCollectionReasons(file)
    },
    onSuccess: async () => {
      // Wait a bit for database triggers to complete
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asm-handover-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
      ])
      
      // Force refetch to ensure latest data
      await queryClient.refetchQueries({ queryKey: ['asm-handover-orders'] })
    },
  })

  const handleMarkNotCollected = (orderId: string) => {
    setSelectedOrderId(orderId)
    setShowReasonModal(true)
  }

  const handleReasonSubmit = async (reason: {
    non_collected_reason: string
    future_collection_possible: boolean
    expected_collection_date?: string
  }) => {
    if (!selectedOrderId) {
      console.error('No order selected')
      return
    }
    
    try {
      await updateReasonMutation.mutateAsync({
        orderId: selectedOrderId,
        reason,
      })
      setShowReasonModal(false)
      setSelectedOrderId(null)
    } catch (error: any) {
      // Error is already handled in onError callback
      console.error('Failed to submit reason:', error)
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await bulkUpdateMutation.mutateAsync(file)
      alert('Bulk update completed successfully')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleExportHandoverOrders = async (format: 'csv' | 'xlsx' | 'pdf' = 'xlsx') => {
    // Get orders to export: HANDOVER_TO_ASM + Not Collected orders
    const handoverOrdersList = orders.filter((o) => o.money_state === 'HANDOVER_TO_ASM')
    const notCollectedOrdersList = orders.filter((o) => o.asm_non_collected_reason)
    const totalOrdersToExport = handoverOrdersList.length + notCollectedOrdersList.length
    
    if (totalOrdersToExport === 0) {
      alert('No orders available to export')
      return
    }

    setExporting(true)
    setExportProgress(0)

    try {
      // Fetch all orders that need to be exported
      // 1. Orders in HANDOVER_TO_ASM state
      // 2. Orders with asm_non_collected_reason (regardless of state, but still COD_HARD)
      const [handoverResult, notCollectedResult] = await Promise.all([
        ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          money_state: 'HANDOVER_TO_ASM',
          asm_id: profile?.asm_id,
        }, 1, 1000), // Fetch all pages
        // For not collected orders, we need to fetch all COD_HARD orders for this ASM
        // and filter by asm_non_collected_reason in the frontend
        ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          asm_id: profile?.asm_id,
        }, 1, 1000), // Fetch all pages
      ])

      // Combine and deduplicate orders
      const handoverOrdersSet = new Set(handoverResult.data.map(o => o.id))
      const allNotCollectedOrders = notCollectedResult.data.filter(
        o => o.asm_non_collected_reason && !handoverOrdersSet.has(o.id)
      )
      
      const allOrdersToExport = [...handoverResult.data, ...allNotCollectedOrders]
      
      if (allOrdersToExport.length === 0) {
        alert('No orders available to export')
        return
      }

      // Update progress
      setExportProgress(50)
      
      // Format orders for export
      const formattedOrders = allOrdersToExport.map(order => ({
        'Order Number': order.order_number,
        'Order Date': formatDate(order.created_at),
        'Customer Name': order.customer_name || '-',
        'Customer Phone': order.customer_phone || '-',
        'Store': order.store_name || order.store_id || '-',
        'Payment Type': order.payment_type,
        'COD Type': order.cod_type || '-',
        'Order Amount': order.order_amount,
        'COD Amount': order.cod_amount,
        'Money State': order.money_state.replace(/_/g, ' '),
        'Collection Status': order.asm_non_collected_reason ? 'Not Collected' : 'Collected',
        'Not Collected Reason': order.asm_non_collected_reason || '-',
        'Future Collection Possible': order.asm_future_collection_possible ? 'Yes' : 'No',
        'Expected Collection Date': order.asm_expected_collection_date || '-',
        'Rider': order.rider_name || '-',
        'ASM': order.asm_name || '-',
        'Dispatched At': order.dispatched_at ? formatDate(order.dispatched_at) : '-',
        'Collected At': order.collected_at ? formatDate(order.collected_at) : '-',
        'Handover to ASM At': order.handover_to_asm_at ? formatDate(order.handover_to_asm_at) : '-',
        'Deposited At': order.deposited_at ? formatDate(order.deposited_at) : '-',
        'Reconciled At': order.reconciled_at ? formatDate(order.reconciled_at) : '-',
      }))

      setExportProgress(75)

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `asm-handover-orders-${timestamp}`

      // Export based on format
      if (format === 'csv') {
        const { utils } = await import('xlsx')
        const worksheet = utils.json_to_sheet(formattedOrders)
        const csv = utils.sheet_to_csv(worksheet)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${filename}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const worksheet = XLSX.utils.json_to_sheet(formattedOrders)
        const columnWidths = [
          { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
          { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
          { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
          { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
        ]
        worksheet['!cols'] = columnWidths
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ASM Handover Orders')
        XLSX.writeFile(workbook, `${filename}.xlsx`)
      } else if (format === 'pdf') {
        // For PDF, we need to use the export service's PDF function
        // But we need to pass the combined orders, so we'll create a custom export
        const { jsPDF } = await import('jspdf')
        const { autoTable } = await import('jspdf-autotable')
        
        const doc = new jsPDF('l', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        
        // Header
        doc.setFillColor(59, 130, 246)
        doc.rect(0, 0, pageWidth, 30, 'F')
        doc.setFontSize(20)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text('ASM Handover Orders', 14, 18)
        doc.setFontSize(9)
        doc.text('Cash-on-Delivery Management Dashboard', 14, 25)
        
        // Report metadata
        let yPos = 38
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.3)
        doc.line(14, yPos, pageWidth - 14, yPos)
        yPos += 6
        
        doc.setFontSize(8)
        doc.setTextColor(107, 114, 128)
        doc.setFont('helvetica', 'normal')
        doc.text('Report Generated', 14, yPos)
        doc.text(new Date().toLocaleString('en-IN'), 14, yPos + 5)
        
        doc.text('Total Orders', 80, yPos)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(31, 41, 55)
        doc.text(allOrdersToExport.length.toString(), 80, yPos + 5)
        
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(107, 114, 128)
        doc.text('Collected', 140, yPos)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(31, 41, 55)
        doc.text(handoverOrdersList.length.toString(), 140, yPos + 5)
        
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(107, 114, 128)
        doc.text('Not Collected', 200, yPos)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(31, 41, 55)
        doc.text(notCollectedOrdersList.length.toString(), 200, yPos + 5)
        
        yPos += 18
        
        // Table
        doc.setDrawColor(226, 232, 240)
        doc.line(14, yPos, pageWidth - 14, yPos)
        yPos += 6
        
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(31, 41, 55)
        doc.text('Order Details', 14, yPos)
        yPos += 8
        
        const tableData = allOrdersToExport.map(order => [
          order.order_number,
          formatDate(order.created_at),
          (order.customer_name || '-').substring(0, 20),
          order.payment_type,
          (order.cod_type || '-').replace(/_/g, ' '),
          `INR ${order.cod_amount.toLocaleString('en-IN')}`,
          order.money_state.replace(/_/g, ' '),
          order.asm_non_collected_reason ? 'Not Collected' : 'Collected',
          (order.asm_non_collected_reason || '-').substring(0, 30),
          (order.rider_name || '-').substring(0, 15),
          (order.asm_name || '-').substring(0, 15),
        ])
        
        autoTable(doc, {
          startY: yPos,
          head: [['Order #', 'Date', 'Customer', 'Payment', 'COD Type', 'Amount', 'State', 'Status', 'Not Collected Reason', 'Rider', 'ASM']],
          body: tableData,
          theme: 'striped',
          styles: { 
            fontSize: 7,
            cellPadding: 2.5,
            overflow: 'linebreak',
            cellWidth: 'wrap',
            font: 'helvetica',
          },
          headStyles: { 
            fillColor: [59, 130, 246],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'left',
            font: 'helvetica',
          },
          bodyStyles: {
            textColor: [31, 41, 55],
            fontSize: 7,
            font: 'helvetica',
          },
          alternateRowStyles: { 
            fillColor: [249, 250, 251],
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            2: { cellWidth: 28 },
            3: { cellWidth: 18 },
            4: { cellWidth: 22 },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 28 },
            7: { cellWidth: 20 },
            8: { cellWidth: 35 },
            9: { cellWidth: 22 },
            10: { cellWidth: 22 },
          },
          margin: { top: yPos, left: 14, right: 14 },
          pageBreak: 'auto',
          showHead: 'everyPage',
        })
        
        doc.save(`${filename}.pdf`)
      }

      setExportProgress(100)
      
      // Show success message
      alert(`Successfully exported ${allOrdersToExport.length} order${allOrdersToExport.length > 1 ? 's' : ''} (${handoverOrdersList.length} collected, ${notCollectedOrdersList.length} not collected) to ${format.toUpperCase()}`)
    } catch (error: any) {
      console.error('Export error:', error)
      alert(`Error exporting orders: ${error.message || 'Unknown error'}`)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find((o) => o.id === selectedOrderId)
  }, [selectedOrderId, orders])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (!profile || profile.role !== 'asm') {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h1 className="text-xl font-semibold text-gray-900">Access Restricted</h1>
          </div>
          <p className="text-sm text-gray-600">
            This section is only available for ASM accounts.
          </p>
        </div>
      </div>
    )
  }

  // Group orders by state and collection status
  const uncollectedOrders = orders.filter((o) => o.money_state === 'UNCOLLECTED')
  const withRiderOrders = orders.filter((o) => o.money_state === 'COLLECTED_BY_RIDER')
  const handoverOrders = orders.filter((o) => o.money_state === 'HANDOVER_TO_ASM')
  
  // Collected orders: Only orders in HANDOVER_TO_ASM state (Collected by ASM)
  const collectedOrders = handoverOrders
  
  // Pending orders: UNCOLLECTED + COLLECTED_BY_RIDER
  const pendingOrders = [...uncollectedOrders, ...withRiderOrders]
  
  // Not Collected: Orders explicitly marked as not collected (have asm_non_collected_reason)
  const notCollectedOrders = orders.filter((o) => o.asm_non_collected_reason)

  const readyToHandoverCount = withRiderOrders.filter((o) => !o.asm_non_collected_reason).length
  const readyToHandoverAmount = withRiderOrders
    .filter((o) => !o.asm_non_collected_reason)
    .reduce((sum, o) => sum + Number(o.cod_amount || 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ASM Handover</h1>
            <p className="text-gray-600">
              Manage order collections and mark orders as collected or not collected
            </p>
          </div>
          {/* Export Button - Prominent Position */}
          {(handoverOrders.length > 0 || notCollectedOrders.length > 0) && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className="btn btn-primary flex items-center gap-2 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-shadow"
                title="Export orders ready for handover"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exporting...</span>
                    {exportProgress > 0 && (
                      <span className="text-xs ml-1">({Math.round(exportProgress)}%)</span>
                    )}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export Orders</span>
                  </>
                )}
              </button>
              {showExportMenu && !exporting && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Export Format</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      handleExportHandoverOrders('csv')
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      handleExportHandoverOrders('xlsx')
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span>Export as XLSX</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      handleExportHandoverOrders('pdf')
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-red-600" />
                    <span>Export as PDF</span>
                  </button>
                </div>
              )}
              {exporting && exportProgress > 0 && (
                <div className="absolute -bottom-8 left-0 right-0 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content - Left Column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Bulk Upload Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 bg-blue-50 rounded-lg">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Bulk Upload Collection Data
                </h2>
                <p className="text-sm text-gray-600">
                  Upload CSV or XLSX file with order collection status and reasons for faster processing
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBulkUpload}
                className="hidden"
              />
              <button
                className="flex-1 btn btn-primary flex items-center justify-center gap-2 h-11"
                onClick={() => fileInputRef.current?.click()}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload CSV / XLSX
                  </>
                )}
              </button>
              <button
                className="btn btn-outline flex items-center justify-center gap-2 h-11 px-6"
                onClick={() => {
                  const template = [
                    ['order_number', 'collection_status', 'non_collection_reason', 'future_collection_possible', 'expected_collection_date'],
                    ['ORD-12345', 'COLLECTED', '', '', ''],
                    ['ORD-67890', 'NOT_COLLECTED', 'Customer unavailable', 'true', '2024-01-15'],
                  ]
                  const ws = utils.aoa_to_sheet(template)
                  const wb = utils.book_new()
                  utils.book_append_sheet(wb, ws, 'Sheet1')
                  const csv = utils.sheet_to_csv(ws)
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'asm-handover-template.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Template
              </button>
            </div>
          </div>

          {/* Orders List */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {orders.length} {orders.length === 1 ? 'order' : 'orders'} in handover pipeline
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">No orders found</p>
                  <p className="text-sm text-gray-500">Orders will appear here once they are assigned to you</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pending Collection from Customer */}
                  {uncollectedOrders.length > 0 && (
                    <div>
                      <ContextualGuidance
                        id="asm-uncollected-guidance"
                        title="Orders Pending Customer Collection"
                        message="These orders are waiting for riders to collect cash from customers. Once riders mark them as collected, they will appear in the 'With Rider' section."
                        variant="info"
                        showForRoles={['asm']}
                        priority="low"
                      />
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-yellow-500 rounded-full"></div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Pending Collection from Customer
                        </h3>
                        <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          {uncollectedOrders.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {uncollectedOrders.map((order) => (
                          <div
                            key={order.id}
                            className="group flex items-center justify-between p-4 bg-yellow-50/50 border border-yellow-200 rounded-lg hover:bg-yellow-50 hover:shadow-sm transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {order.order_number}
                                </p>
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                  Pending
                                </span>
                              </div>
                              <p className="text-base font-bold text-gray-900 mb-1">
                                {formatCurrency(order.cod_amount)}
                              </p>
                              {order.asm_non_collected_reason && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-red-700 font-medium">
                                    Reason: {order.asm_non_collected_reason}
                                  </p>
                                  {order.asm_future_collection_possible && (
                                    <p className="text-xs text-blue-600">
                                      Future collection: {order.asm_expected_collection_date ? formatDate(order.asm_expected_collection_date) : 'TBD'}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            {order.asm_non_collected_reason ? (
                              <button
                                onClick={() => handleMarkNotCollected(order.id)}
                                className="btn btn-secondary text-xs px-4 py-2 ml-4 shrink-0"
                              >
                                Edit Reason
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* With Rider */}
                  {withRiderOrders.length > 0 && (
                    <div>
                      <ContextualGuidance
                        id="asm-with-rider-guidance"
                        title="Collect Cash from Riders"
                        message={`You have ${withRiderOrders.length} order${withRiderOrders.length > 1 ? 's' : ''} with riders. Collect the cash and mark them as collected or not collected. Click on an order to take action.`}
                        actionLabel="View Orders"
                        variant="warning"
                        showForRoles={['asm']}
                        priority="high"
                      />
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                        <h3 className="text-base font-semibold text-gray-900">
                          With Rider
                        </h3>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {withRiderOrders.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {withRiderOrders.map((order) => (
                          <div
                            key={order.id}
                            className={`group flex items-center justify-between p-4 rounded-lg border transition-all ${
                              order.asm_non_collected_reason
                                ? 'bg-red-50/50 border-red-200 hover:bg-red-50 hover:shadow-sm'
                                : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {order.order_number}
                                </p>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                  order.asm_non_collected_reason
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {order.asm_non_collected_reason ? 'Not Collected' : 'Ready'}
                                </span>
                              </div>
                              <p className="text-base font-bold text-gray-900 mb-1">
                                {formatCurrency(order.cod_amount)}
                              </p>
                              {order.asm_non_collected_reason && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-red-700 font-medium">
                                    Reason: {order.asm_non_collected_reason}
                                  </p>
                                  {order.asm_future_collection_possible && (
                                    <p className="text-xs text-blue-600">
                                      Future collection: {order.asm_expected_collection_date ? formatDate(order.asm_expected_collection_date) : 'TBD'}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleMarkNotCollected(order.id)}
                              className={`btn text-xs px-4 py-2 ml-4 shrink-0 ${
                                order.asm_non_collected_reason
                                  ? 'btn-secondary'
                                  : 'btn-outline'
                              }`}
                            >
                              {order.asm_non_collected_reason ? 'Edit Reason' : 'Mark Not Collected'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Collected by ASM */}
                  {handoverOrders.length > 0 && (
                    <div>
                      <ContextualGuidance
                        id="asm-handover-ready"
                        title="Ready for Store Manager Collection"
                        message={`You have ${handoverOrders.length} order${handoverOrders.length > 1 ? 's' : ''} ready for Store Manager to collect. These orders will appear in the SM Deposits page.`}
                        variant="success"
                        showForRoles={['asm']}
                        priority="medium"
                      />
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Collected by ASM
                        </h3>
                        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                          {handoverOrders.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {handoverOrders.map((order) => (
                          <div
                            key={order.id}
                            className="group flex items-center justify-between p-4 bg-purple-50/50 border border-purple-200 rounded-lg hover:bg-purple-50 hover:shadow-sm transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {order.order_number}
                                </p>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                  Handover to SM
                                </span>
                              </div>
                              <p className="text-base font-bold text-gray-900">
                                {formatCurrency(order.cod_amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Collection Summary */}
          <ASMHandoverSummary orders={orders} />

          {/* Info Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Collection Status</h3>
              <p className="text-sm text-gray-600">
                View your collection summary and order status
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Collected by ASM</span>
                  <span className="text-base font-bold text-gray-900">
                    {handoverOrders.length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 bg-blue-50 rounded-lg px-3">
                  <span className="text-sm font-medium text-blue-900">Ready for SM Collection</span>
                  <span className="text-lg font-bold text-blue-700">
                    {readyToHandoverCount}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-base font-bold text-gray-900">
                    {formatCurrency(readyToHandoverAmount)}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 text-center">
                  Store Manager will collect cash from you and mark orders as collected in their dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reason Modal */}
      {selectedOrder && (
        <OrderCollectionReasonModal
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.order_number}
          codAmount={selectedOrder.cod_amount}
          isOpen={showReasonModal}
          onClose={() => {
            setShowReasonModal(false)
            setSelectedOrderId(null)
          }}
          onSubmit={handleReasonSubmit}
        />
      )}
    </div>
  )
}

