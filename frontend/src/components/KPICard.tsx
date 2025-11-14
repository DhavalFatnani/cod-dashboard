import { formatCurrency } from '../utils/format'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  label: string
  value: number
  amount: number
  onClick?: () => void
  className?: string
  isActive?: boolean
  level?: 1 | 2 | 3 | 4
  trend?: number
}

export function KPICard({ 
  label, 
  value, 
  amount, 
  onClick, 
  className = '',
  isActive = false,
  level = 1,
  trend
}: KPICardProps) {
  const isPercentage = label.toLowerCase().includes('rate') || label.toLowerCase().includes('%')
  const displayValue = isPercentage ? `${value}%` : value.toLocaleString()
  const showAmount = amount > 0 || (!isPercentage && value === 0)

  const baseStyles = onClick 
    ? 'cursor-pointer transition-all duration-200 hover:scale-[1.01]' 
    : ''

  const activeStyles = isActive
    ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50 border-blue-300'
    : 'bg-white border-gray-200 hover:border-gray-300'

  const levelStyles = {
    1: `p-6 border rounded-lg shadow-sm ${activeStyles}`,
    2: `p-5 border rounded-lg shadow-sm ${activeStyles}`,
    3: `p-4 border rounded-lg ${activeStyles}`,
    4: `p-3 border rounded-lg ${activeStyles}`,
  }

  const valueSizes = {
    1: 'text-3xl',
    2: 'text-2xl',
    3: 'text-xl',
    4: 'text-lg',
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${levelStyles[level]}
        ${baseStyles}
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <p className={`text-sm font-medium text-gray-600 ${level === 1 ? 'text-base' : ''}`}>
          {label}
        </p>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-xs font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        {value > 0 || isPercentage ? (
          <p className={`font-semibold text-gray-900 ${valueSizes[level]}`}>
            {displayValue}
          </p>
        ) : null}
        {showAmount && (
          <p className={`text-gray-600 ${level === 1 ? 'text-sm font-medium' : 'text-xs'}`}>
            {formatCurrency(amount)}
          </p>
        )}
        {!showAmount && value === 0 && !isPercentage && (
          <p className="text-xs text-gray-400">No data</p>
        )}
      </div>
    </div>
  )
}
