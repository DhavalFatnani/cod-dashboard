import { useState } from 'react'
import { X, Send, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface RiderJustificationModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  orderNumber?: string
}

export default function RiderJustificationModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
}: RiderJustificationModalProps) {
  const [justification, setJustification] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [messages, setMessages] = useState<Array<{ id: string; text: string; from: string; created_at: string }>>([])

  // Fetch existing messages/justifications
  // This would typically come from a messages table or order comments
  // For now, using a simplified approach

  const handleSend = async () => {
    if (!justification.trim()) return

    setSubmitting(true)
    try {
      // Update order with unbundled_reason
      const { error } = await supabase
        .from('orders')
        .update({
          unbundled_reason: justification,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (error) throw error

      // Add to messages
      setMessages([
        ...messages,
        {
          id: Date.now().toString(),
          text: justification,
          from: 'asm',
          created_at: new Date().toISOString(),
        },
      ])

      setJustification('')
    } catch (err: any) {
      console.error('Failed to send justification request:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative max-w-2xl mx-auto my-8 bg-white rounded-lg shadow-xl">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Request Justification</h2>
              {orderNumber && (
                <p className="text-sm text-gray-500">Order: {orderNumber}</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="border border-gray-200 rounded-lg p-4 h-64 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === 'asm' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      msg.from === 'asm'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ask rider why this order is not bundled..."
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={submitting || !justification.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              This message will be sent to the rider requesting justification for why this order
              is not included in a bundle.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
