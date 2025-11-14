import { formatDate } from '../utils/format'
import { Clock, User, DollarSign, Package, CheckCircle } from 'lucide-react'
import { Order } from '../services/ordersService'

interface TimelineEvent {
  id: string
  type: 'rider_event' | 'asm_event'
  event_type: string
  actor: string
  actor_id: string
  amount?: number
  notes?: string
  timestamp: string
  metadata?: Record<string, any>
}

interface OrderTimelineProps {
  timeline: TimelineEvent[]
  order: Order
}

export function OrderTimeline({ timeline, order }: OrderTimelineProps) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ORDER_CREATED':
        return Package
      case 'COLLECTED':
      case 'DEPOSITED':
      case 'RECONCILED':
        return CheckCircle
      default:
        return Clock
    }
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'ORDER_CREATED':
        return 'bg-blue-500'
      case 'COLLECTED':
        return 'bg-green-500'
      case 'HANDOVER_TO_ASM':
        return 'bg-purple-500'
      case 'DEPOSITED':
        return 'bg-emerald-500'
      case 'RECONCILED':
        return 'bg-teal-500'
      case 'CANCELLED':
      case 'RTO':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  // Build timeline from order dates
  const orderEvents = [
    order.wms_created_at && {
      id: 'wms-created',
      type: 'order' as const,
      event_type: 'ORDER_CREATED',
      actor: 'WMS',
      timestamp: order.wms_created_at,
      amount: order.order_amount,
    },
    order.dispatched_at && {
      id: 'dispatched',
      type: 'order' as const,
      event_type: 'DISPATCHED',
      actor: order.rider_name || 'Rider',
      timestamp: order.dispatched_at,
    },
    order.collected_at && {
      id: 'collected',
      type: 'order' as const,
      event_type: 'COLLECTED',
      actor: order.rider_name || 'Rider',
      timestamp: order.collected_at,
      amount: order.cod_amount,
    },
    order.handover_to_asm_at && {
      id: 'handover',
      type: 'order' as const,
      event_type: 'HANDOVER_TO_ASM',
      actor: order.asm_name || 'ASM',
      timestamp: order.handover_to_asm_at,
      amount: order.cod_amount,
    },
    order.deposited_at && {
      id: 'deposited',
      type: 'order' as const,
      event_type: 'DEPOSITED',
      actor: order.asm_name || 'ASM',
      timestamp: order.deposited_at,
      amount: order.cod_amount,
    },
    order.reconciled_at && {
      id: 'reconciled',
      type: 'order' as const,
      event_type: 'RECONCILED',
      actor: 'Finance',
      timestamp: order.reconciled_at,
      amount: order.cod_amount,
    },
  ].filter(Boolean) as any[]

  const allEvents = [...orderEvents, ...timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  if (allEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No timeline events available
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
      <div className="space-y-6">
        {allEvents.map((event, index) => {
          const Icon = getEventIcon(event.event_type)
          const color = getEventColor(event.event_type)

          return (
            <div key={event.id || index} className="relative flex gap-4">
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${color} text-white`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {event.event_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      by {event.actor}
                    </p>
                    {event.notes && (
                      <p className="text-sm text-gray-500 mt-1">{event.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {event.amount && (
                      <p className="font-semibold text-gray-900">
                        ₹{event.amount.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(event.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

