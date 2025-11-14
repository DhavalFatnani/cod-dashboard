import { CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface StateIndicatorProps {
  currentState: string
  nextState?: string
  nextAction?: string
  actionUrl?: string
  onAction?: () => void
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const stateLabels: Record<string, string> = {
  UNCOLLECTED: 'Pending Collection',
  COLLECTED_BY_RIDER: 'Collected by Rider',
  HANDOVER_TO_ASM: 'Handover to ASM',
  PENDING_TO_DEPOSIT: 'Pending Deposit',
  DEPOSITED: 'Deposited',
  RECONCILED: 'Reconciled',
  CANCELLED: 'Cancelled',
}

export function StateIndicator({
  currentState,
  nextState,
  nextAction,
  actionUrl,
  onAction,
  variant = 'default',
}: StateIndicatorProps) {
  const variantStyles = {
    default: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      icon: <Clock className="w-4 h-4 text-gray-500" />,
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: <AlertCircle className="w-4 h-4 text-yellow-600" />,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: <AlertCircle className="w-4 h-4 text-red-600" />,
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        {styles.icon}
        <div>
          <p className={`${styles.text} text-sm font-medium`}>
            Current: {stateLabels[currentState] || currentState}
          </p>
          {nextState && (
            <p className="text-xs text-gray-500 mt-0.5">
              Next: {stateLabels[nextState] || nextState}
            </p>
          )}
        </div>
      </div>
      {nextAction && (
        <div>
          {actionUrl ? (
            <Link
              to={actionUrl}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {nextAction}
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {nextAction}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

