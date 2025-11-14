import { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { exportOrders, ExportFormat } from '../services/exportService'
import { OrderFilters } from '../services/ordersService'

interface ExportDropdownProps {
  filters: OrderFilters
}

export default function ExportDropdown({ filters }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false)
    setIsExporting(true)
    setExportProgress(0)
    setExportStatus('idle')
    setErrorMessage('')

    try {
      await exportOrders({
        filters,
        format,
        onProgress: (progress) => {
          setExportProgress(progress)
        },
      })
      
      setExportStatus('success')
      setTimeout(() => {
        setExportStatus('idle')
        setIsExporting(false)
        setExportProgress(0)
      }, 2000)
    } catch (error) {
      console.error('Export failed:', error)
      setExportStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Export failed. Please try again.')
      setIsExporting(false)
      setExportProgress(0)
      
      setTimeout(() => {
        setExportStatus('idle')
        setErrorMessage('')
      }, 5000)
    }
  }

  const formatOptions = [
    { format: 'csv' as ExportFormat, label: 'Export as CSV', icon: FileText, description: 'Comma-separated values' },
    { format: 'xlsx' as ExportFormat, label: 'Export as Excel', icon: FileSpreadsheet, description: 'Excel spreadsheet (.xlsx)' },
    { format: 'pdf' as ExportFormat, label: 'Export as PDF', icon: File, description: 'PDF report with summary' },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="btn btn-secondary flex items-center gap-2 relative"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Exporting...</span>
            {exportProgress > 0 && (
              <span className="text-xs ml-2">({Math.round(exportProgress)}%)</span>
            )}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isExporting && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">Export Format</p>
            <p className="text-xs text-gray-500 mt-1">Choose your preferred format</p>
          </div>
          
          {formatOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 group"
              >
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Status Messages */}
      {exportStatus === 'success' && (
        <div className="absolute right-0 mt-2 w-64 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 z-50">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">Export completed successfully!</p>
        </div>
      )}

      {exportStatus === 'error' && (
        <div className="absolute right-0 mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 z-50">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Export failed</p>
            <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

