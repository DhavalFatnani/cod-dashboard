import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { Link } from 'react-router-dom'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  actionUrl?: string
  actionLabel?: string
  priority: 'low' | 'medium' | 'high'
  timestamp: Date
  role?: string
}

interface NotificationCenterProps {
  notifications: Notification[]
  onDismiss?: (id: string) => void
  maxVisible?: number
}

export function NotificationCenter({
  notifications,
  onDismiss,
  maxVisible = 5,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isNotificationDismissed, dismissNotification, userPreferences } = useGuidanceStore()

  const visibleNotifications = notifications
    .filter((n) => !isNotificationDismissed(n.id))
    .slice(0, maxVisible)
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

  const unreadCount = visibleNotifications.length

  const handleDismiss = (id: string) => {
    dismissNotification(id)
    onDismiss?.(id)
  }

  if (!userPreferences.showNotifications) return null

  const iconMap = {
    info: <Info className="w-5 h-5 text-blue-600" />,
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto">
              {visibleNotifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No new notifications
                </div>
              ) : (
                visibleNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {iconMap[notification.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        {notification.actionUrl && (
                          <Link
                            to={notification.actionUrl}
                            onClick={() => setIsOpen(false)}
                            className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block"
                          >
                            {notification.actionLabel || 'View'} →
                          </Link>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDismiss(notification.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

