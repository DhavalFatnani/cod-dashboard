import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simulatorService } from '../services/simulatorService'
import { useUserStore } from '../stores/userStore'
import { TestTube, X, Play, Square, Package, ShoppingBag, Banknote, Trash2, Loader2 } from 'lucide-react'

export default function SimulatorToggle() {
  const { profile, loading: profileLoading } = useUserStore()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [orderCount, setOrderCount] = useState(100)
  const [testTag, setTestTag] = useState('')

  const isAdmin = !profileLoading && profile?.role === 'admin'

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['simulator-status'],
    queryFn: async () => {
      const result = await simulatorService.getStatus()
      return result
    },
    refetchInterval: (query) => {
      // Only poll if modal is open
      if (!isOpen) return false
      
      // Check cached status - stop polling if status is false
      const cachedStatus = query.state.data as { status?: boolean } | undefined
      if (cachedStatus?.status === false) {
        return false // Stop polling when stopped
      }
      
      // Poll every 2 seconds if running
      return cachedStatus?.status === true ? 2000 : false
    },
    enabled: isAdmin,
  })

  // Sync test tag from status
  useEffect(() => {
    if (status?.test_tag && !testTag) {
      setTestTag(status.test_tag)
    }
    if (!status?.status && testTag) {
      setTestTag('')
    }
  }, [status, testTag])

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] }),
      queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] }),
      queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
    ])
  }

  const createOrdersMutation = useMutation({
    mutationFn: () =>
      simulatorService.start({
        count: orderCount,
        test_tag: testTag || undefined,
      }),
    onSuccess: async (data) => {
      setTestTag(data.test_tag || '')
      await invalidateAll()
    },
  })

  const stopMutation = useMutation({
    mutationFn: async () => {
      const result = await simulatorService.stop()
      return result
    },
    onSuccess: async () => {
      // Immediately update cache to stop polling
      queryClient.setQueryData(['simulator-status'], {
        status: false,
        test_tag: null,
      })
      
      setTestTag('')
      
      // Invalidate other queries but NOT status (we already updated it)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
      queryClient.invalidateQueries({ queryKey: ['lifecycle-counts'] })
      
      // Refetch status once to confirm, but don't invalidate (to prevent race)
      setTimeout(() => {
        refetchStatus()
      }, 500)
    },
    onError: (error: any) => {
      alert(`Failed to stop simulator: ${error.message || 'Unknown error'}`)
    },
  })

  const collectMutation = useMutation({
    mutationFn: () =>
      simulatorService.bulkProcess(testTag || status?.test_tag || '', 'collect'),
    onSuccess: async () => {
      await invalidateAll()
    },
  })

  const depositMutation = useMutation({
    mutationFn: () =>
      simulatorService.bulkProcess(testTag || status?.test_tag || '', 'deposit'),
    onSuccess: async () => {
      await invalidateAll()
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: () =>
      simulatorService.cleanup(testTag || status?.test_tag || ''),
    onSuccess: async () => {
      setTestTag('')
      await invalidateAll()
    },
  })

  if (!isAdmin) return null

  // Simple: check cache first (for immediate UI update), then fall back to query data
  const cachedStatus = queryClient.getQueryData<{ status?: boolean; test_tag?: string | null }>(['simulator-status'])
  const isRunning = cachedStatus?.status === true || (status?.status === true && !cachedStatus)
  
  const currentTestTag = testTag || status?.test_tag || ''

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-50
          flex items-center gap-2
          px-5 py-3
          rounded-lg shadow-lg
          font-medium text-white
          transition-all duration-200
          hover:shadow-xl hover:scale-105
          ${isRunning 
            ? 'bg-green-600 hover:bg-green-700' 
            : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
      >
        <TestTube className="w-5 h-5" />
        <span>Simulator</span>
        {isRunning && (
          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
            Running
          </span>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TestTube className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Simulator</h2>
                  <p className="text-sm text-gray-500">Generate and process test orders</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="font-medium text-gray-900">
                    {isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                {currentTestTag && (
                  <span className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {currentTestTag}
                  </span>
                )}
              </div>

              {/* 1. Create Orders Section */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">1. Create Orders</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label text-sm">Number of Orders</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={orderCount}
                      onChange={(e) => setOrderCount(parseInt(e.target.value) || 100)}
                      className="input"
                      disabled={isRunning}
                    />
                  </div>
                  <div>
                    <label className="label text-sm">Test Tag (optional)</label>
                    <input
                      type="text"
                      value={testTag}
                      onChange={(e) => setTestTag(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="input"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="flex gap-3">
                    {!isRunning ? (
                      <button
                        onClick={() => createOrdersMutation.mutate()}
                        disabled={createOrdersMutation.isPending}
                        className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {createOrdersMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Create Orders
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending || !isRunning}
                        className="btn btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {stopMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Stopping...
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4" />
                            Stop Simulator
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Collect Orders Section */}
              {currentTestTag && (
                <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingBag className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">2. Collect Orders</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Mark COD orders as collected by riders
                  </p>
                  <button
                    onClick={() => collectMutation.mutate()}
                    disabled={collectMutation.isPending || !currentTestTag}
                    className="btn btn-success w-full flex items-center justify-center gap-2"
                  >
                    {collectMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Collecting...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        Collect Orders
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 3. Deposit Orders Section */}
              {currentTestTag && (
                <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">3. Deposit Orders</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Create deposits for collected orders
                  </p>
                  <button
                    onClick={() => depositMutation.mutate()}
                    disabled={depositMutation.isPending || !currentTestTag}
                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    {depositMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Depositing...
                      </>
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Create Deposits
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Cleanup */}
              {currentTestTag && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      if (confirm(`Delete all test data with tag "${currentTestTag}"?`)) {
                        cleanupMutation.mutate()
                      }
                    }}
                    disabled={cleanupMutation.isPending}
                    className="btn btn-danger w-full flex items-center justify-center gap-2"
                  >
                    {cleanupMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cleaning up...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Cleanup Test Data
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
