import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { Order, OrderFilters } from './ordersService'
import { formatCurrency, formatDate } from '../utils/format'
import { ordersService } from './ordersService'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

interface ExportOptions {
  filters: OrderFilters
  format: ExportFormat
  onProgress?: (progress: number) => void
}

/**
 * Fetches all orders matching the filters (for export purposes)
 * Handles pagination internally to get all records
 */
async function fetchAllOrders(filters: OrderFilters, onProgress?: (progress: number) => void): Promise<Order[]> {
  const pageSize = 1000 // Fetch in batches
  let page = 1
  let allOrders: Order[] = []
  let hasMore = true

  while (hasMore) {
    const result = await ordersService.getOrders(filters, page, pageSize)
    allOrders = [...allOrders, ...result.data]
    
    if (onProgress) {
      const totalPages = result.totalPages
      const progress = Math.min((page / totalPages) * 100, 100)
      onProgress(progress)
    }

    hasMore = page < result.totalPages
    page++
  }

  return allOrders
}

/**
 * Formats order data for export
 */
function formatOrderForExport(order: Order) {
  return {
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
    'Cancelled At': order.cancelled_at ? formatDate(order.cancelled_at) : '-',
    'RTO At': order.rto_at ? formatDate(order.rto_at) : '-',
  }
}

/**
 * Exports orders to CSV format
 */
function exportToCSV(orders: Order[], filename: string) {
  if (orders.length === 0) {
    throw new Error('No orders to export')
  }

  const formattedData = orders.map(formatOrderForExport)
  const worksheet = XLSX.utils.json_to_sheet(formattedData)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  
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
}

/**
 * Exports orders to XLSX format
 */
function exportToXLSX(orders: Order[], filename: string) {
  if (orders.length === 0) {
    throw new Error('No orders to export')
  }

  const formattedData = orders.map(formatOrderForExport)
  const worksheet = XLSX.utils.json_to_sheet(formattedData)
  
  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Order Number
    { wch: 12 }, // Order Date
    { wch: 20 }, // Customer Name
    { wch: 15 }, // Customer Phone
    { wch: 15 }, // Store
    { wch: 12 }, // Payment Type
    { wch: 12 }, // COD Type
    { wch: 12 }, // Order Amount
    { wch: 12 }, // COD Amount
    { wch: 20 }, // Money State
    { wch: 15 }, // Rider
    { wch: 15 }, // ASM
    { wch: 15 }, // Dispatched At
    { wch: 15 }, // Collected At
    { wch: 18 }, // Handover to ASM At
    { wch: 15 }, // Deposited At
    { wch: 15 }, // Reconciled At
    { wch: 15 }, // Cancelled At
    { wch: 12 }, // RTO At
  ]
  worksheet['!cols'] = columnWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders')
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Helper function to format currency without special characters for PDF
 */
function formatCurrencyForPDF(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Generate smart title based on filters
 */
function generateSmartTitle(filters: OrderFilters): string {
  const parts: string[] = []
  
  if (filters.payment_type === 'COD') {
    if (filters.cod_type === 'COD_HARD') {
      parts.push('Hard Cash')
    } else if (filters.cod_type === 'COD_QR') {
      parts.push('QR Payment')
    } else if (filters.cod_type === 'CANCELLED') {
      parts.push('Cancelled')
    } else {
      parts.push('COD')
    }
    
    if (filters.money_state) {
      const stateMap: Record<string, string> = {
        'UNCOLLECTED': 'Pending Collection',
        'COLLECTED_BY_RIDER': 'With Rider',
        'HANDOVER_TO_ASM': 'Collected by ASM',
        'PENDING_TO_DEPOSIT': 'Pending Deposit',
        'DEPOSITED': 'Deposited',
        'RECONCILED': 'Reconciled',
      }
      parts.push(stateMap[filters.money_state] || filters.money_state.replace(/_/g, ' '))
    }
  } else if (filters.payment_type === 'PREPAID') {
    parts.push('Prepaid')
  } else {
    parts.push('All')
  }
  
  parts.push('Orders')
  return parts.join(' ')
}

/**
 * Get date range from orders
 */
function getDateRange(orders: Order[]): string {
  if (orders.length === 0) return 'N/A'
  
  const dates = orders.map(o => new Date(o.created_at).getTime())
  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  
  if (minDate.getTime() === maxDate.getTime()) {
    return formatDate(minDate)
  }
  
  return `${formatDate(minDate)} - ${formatDate(maxDate)}`
}

/**
 * Exports orders to PDF format (as a report)
 */
function exportToPDF(orders: Order[], filename: string, filters: OrderFilters) {
  if (orders.length === 0) {
    throw new Error('No orders to export')
  }

  const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Color scheme
  const colors = {
    primary: [59, 130, 246],      // Blue
    secondary: [107, 114, 128],   // Gray
    success: [34, 197, 94],        // Green
    warning: [251, 146, 60],        // Orange
    danger: [239, 68, 68],         // Red
    lightGray: [249, 250, 251],   // Light gray
    darkGray: [31, 41, 55],        // Dark gray
    // Light versions for card backgrounds
    primaryLight: [239, 246, 255],  // Light blue
    successLight: [236, 253, 245],  // Light green
    warningLight: [255, 247, 237],  // Light orange
    secondaryLight: [249, 250, 251], // Light gray
  }

  // Helper function to add text with styling
  const addText = (text: string, x: number, y: number, fontSize: number, color: number[] = colors.darkGray, isBold: boolean = false) => {
    doc.setFontSize(fontSize)
    doc.setTextColor(color[0], color[1], color[2])
    if (isBold) {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    doc.text(text, x, y)
  }

  // Generate smart title
  const reportTitle = generateSmartTitle(filters)
  
  // Header
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.rect(0, 0, pageWidth, 30, 'F')
  addText(reportTitle, 14, 18, 20, [255, 255, 255], true)
  addText('Cash-on-Delivery Management Dashboard', 14, 25, 9, [255, 255, 255], false)

  // Report metadata section - cleaner layout
  let yPos = 38
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  
  yPos += 6
  
  // Calculate date range from actual order data
  const dateRange = getDateRange(orders)
  
  // Metadata in a clean grid
  const metadataItems = [
    { label: 'Report Generated', value: new Date().toLocaleString('en-IN') },
    { label: 'Date Range', value: dateRange },
    { label: 'Total Orders', value: orders.length.toString() },
  ]
  
  const metadataColWidth = (pageWidth - 42) / 3
  metadataItems.forEach((item, index) => {
    const x = 14 + index * metadataColWidth
    addText(item.label, x, yPos, 8, colors.secondary)
    addText(item.value, x, yPos + 5, 9, colors.darkGray, true)
  })

  yPos += 18

  // Summary statistics - compact horizontal layout
  const codOrders = orders.filter(o => o.payment_type === 'COD')
  const prepaidOrders = orders.length - codOrders.length
  const totalCOD = codOrders.reduce((sum, o) => sum + o.cod_amount, 0)
  const totalOrderAmount = orders.reduce((sum, o) => sum + o.order_amount, 0)
  const hardCashOrders = codOrders.filter(o => o.cod_type === 'COD_HARD')
  const qrOrders = codOrders.filter(o => o.cod_type === 'COD_QR')
  
  // Summary section header
  addText('Summary', 14, yPos, 11, colors.darkGray, true)
  yPos += 8

  // Summary metrics in a clean table-like format
  const summaryMetrics = [
    { label: 'Total Orders', value: orders.length.toString() },
    { label: 'COD Orders', value: codOrders.length.toString() },
    { label: 'Prepaid Orders', value: prepaidOrders.toString() },
    { label: 'Hard Cash', value: hardCashOrders.length.toString() },
    { label: 'QR Payments', value: qrOrders.length.toString() },
    { label: 'Total Amount', value: `INR ${formatCurrencyForPDF(totalOrderAmount)}` },
    { label: 'COD Amount', value: `INR ${formatCurrencyForPDF(totalCOD)}` },
    { label: 'Avg Order Value', value: `INR ${formatCurrencyForPDF(Math.round(totalOrderAmount / orders.length))}` },
  ]

  const metricCols = 4
  const metricColWidth = (pageWidth - 42) / metricCols
  const metricRowHeight = 8
  
  summaryMetrics.forEach((metric, index) => {
    const col = index % metricCols
    const row = Math.floor(index / metricCols)
    const x = 14 + col * metricColWidth
    const y = yPos + row * metricRowHeight
    
    addText(metric.label, x, y, 8, colors.secondary)
    addText(metric.value, x, y + 4, 9, colors.darkGray, true)
  })

  yPos += Math.ceil(summaryMetrics.length / metricCols) * metricRowHeight + 10

  // Table section
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6
  
  addText('Order Details', 14, yPos, 11, colors.darkGray, true)
  yPos += 8

  // Table data with better formatting - use formatCurrencyForPDF to avoid superscript issues
  const tableData = orders.map(order => [
    order.order_number,
    formatDate(order.created_at),
    (order.customer_name || '-').substring(0, 20),
    order.payment_type,
    (order.cod_type || '-').replace(/_/g, ' '),
    `INR ${formatCurrencyForPDF(order.payment_type === 'COD' ? order.cod_amount : order.order_amount)}`,
    order.money_state.replace(/_/g, ' '),
    (order.rider_name || '-').substring(0, 15),
    (order.asm_name || '-').substring(0, 15),
  ])

  // Enhanced table styling
  autoTable(doc, {
    startY: yPos,
    head: [['Order #', 'Date', 'Customer', 'Payment', 'COD Type', 'Amount', 'State', 'Rider', 'ASM']],
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
      fillColor: colors.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      font: 'helvetica',
    },
    bodyStyles: {
      textColor: colors.darkGray,
      fontSize: 7,
      font: 'helvetica',
    },
    alternateRowStyles: { 
      fillColor: colors.lightGray,
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Order #
      1: { cellWidth: 22 }, // Date
      2: { cellWidth: 28 }, // Customer
      3: { cellWidth: 18 }, // Payment
      4: { cellWidth: 22 }, // COD Type
      5: { cellWidth: 22, halign: 'right' }, // Amount
      6: { cellWidth: 28 }, // State
      7: { cellWidth: 22 }, // Rider
      8: { cellWidth: 22 }, // ASM
    },
    margin: { top: yPos, left: 14, right: 14 },
    pageBreak: 'auto',
    showHead: 'everyPage',
    didDrawPage: (data: any) => {
      // Add page number footer
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      )
    },
  })

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || pageHeight - 20
  if (finalY < pageHeight - 15) {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(14, finalY + 5, pageWidth - 14, finalY + 5)
    
    doc.setFontSize(8)
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(
      `Report generated on ${new Date().toLocaleString()} | COD Dashboard`,
      pageWidth / 2,
      finalY + 10,
      { align: 'center' }
    )
  }

  doc.save(`${filename}.pdf`)
}

/**
 * Main export function
 */
export async function exportOrders(options: ExportOptions): Promise<void> {
  const { filters, format, onProgress } = options

  try {
    // Fetch all orders matching filters
    onProgress?.(0)
    const orders = await fetchAllOrders(filters, onProgress)
    
    if (orders.length === 0) {
      throw new Error('No orders found matching the current filters')
    }

    // Generate filename with timestamp and filters
    const timestamp = new Date().toISOString().split('T')[0]
    const filterParts: string[] = []
    
    if (filters.payment_type) filterParts.push(filters.payment_type.toLowerCase())
    if (filters.cod_type) filterParts.push(filters.cod_type.toLowerCase().replace(/_/g, '-'))
    if (filters.money_state) filterParts.push(filters.money_state.toLowerCase().replace(/_/g, '-'))
    
    const filterSuffix = filterParts.length > 0 ? `-${filterParts.join('-')}` : ''
    const filename = `cod-orders-${timestamp}${filterSuffix}`

    // Export based on format
    switch (format) {
      case 'csv':
        exportToCSV(orders, filename)
        break
      case 'xlsx':
        exportToXLSX(orders, filename)
        break
      case 'pdf':
        exportToPDF(orders, filename, filters)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    onProgress?.(100)
  } catch (error) {
    console.error('Export error:', error)
    throw error
  }
}

