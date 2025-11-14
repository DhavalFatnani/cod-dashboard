import { X, HelpCircle, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useGuidance } from '../hooks/useGuidance'
import { GuidanceConfig } from '../hooks/useGuidance'

interface ContextualGuidanceProps extends GuidanceConfig {
  variant?: 'info' | 'warning' | 'success' | 'error'
  icon?: React.ReactNode
  onAction?: () => void
}

export function ContextualGuidance({
  id,
  title,
  message,
  actionLabel,
  actionUrl,
  onAction,
  variant = 'info',
  icon,
  dismissible = true,
  priority = 'medium',
  showForRoles,
  showForStates,
}: ContextualGuidanceProps) {
  const { shouldShow, dismiss } = useGuidance({
    id,
    title,
    message,
    actionLabel,
    actionUrl,
    dismissible,
    priority,
    showForRoles,
    showForStates,
  })

  if (!shouldShow) return null

  const variantStyles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="w-5 h-5 text-blue-600" />,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-lg p-4 mb-4 shadow-sm`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icon || styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`${styles.text} font-semibold text-sm mb-1`}>
            {title}
          </h4>
          <p className={`${styles.text} text-sm`}>{message}</p>
          {(actionLabel && (actionUrl || onAction)) && (
            <div className="mt-3">
              {actionUrl ? (
                <a
                  href={actionUrl}
                  className={`${styles.text} text-sm font-medium hover:underline`}
                >
                  {actionLabel} →
                </a>
              ) : (
                <button
                  onClick={onAction}
                  className={`${styles.text} text-sm font-medium hover:underline`}
                >
                  {actionLabel} →
                </button>
              )}
            </div>
          )}
        </div>
        {dismissible && (
          <button
            onClick={dismiss}
            className={`${styles.text} flex-shrink-0 hover:opacity-70 transition-opacity`}
            aria-label="Dismiss guidance"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

