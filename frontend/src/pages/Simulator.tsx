import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simulatorService } from '../services/simulatorService'
import { useUserStore } from '../stores/userStore'
import { Play, Square, Trash2, RefreshCw, AlertCircle } from 'lucide-react'

export default function Simulator() {
  const { profile } = useUserStore()
  const queryClient = useQueryClient()
  const [orderCount, setOrderCount] = useState(100)
  const [testTag, setTestTag] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['simulator-status'],
    queryFn: () => simulatorService.getStatus(),
    refetchInterval: 2000, // Poll every 2 seconds
  })

  const startMutation = useMutation({
    mutationFn: () =>
      simulatorService.start({
        count: orderCount,
        test_tag: testTag || undefined,
      }),
    onSuccess: (data) => {
      addLog(`Started simulator: ${data.message}`)
      setTestTag(data.test_tag || '')
      refetchStatus()
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
    },
    onError: (error: any) => {
      addLog(`Error: ${error.message}`)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => simulatorService.stop(),
    onSuccess: () => {
      addLog('Simulator stopped')
      refetchStatus()
    },
    onError: (error: any) => {
      addLog(`Error: ${error.message}`)
    },
  })

  const bulkProcessMutation = useMutation({
    mutationFn: (action: 'collect' | 'handover' | 'deposit' | 'reconcile') =>
      simulatorService.bulkProcess(testTag || status?.test_tag || '', action),
    onSuccess: (data, action) => {
      addLog(`Bulk ${action}: Processed ${data.processed} orders`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
    },
    onError: (error: any) => {
      addLog(`Error: ${error.message}`)
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: () =>
      simulatorService.cleanup(testTag || status?.test_tag || ''),
    onSuccess: (data) => {
      addLog(data.message)
      setTestTag('')
      refetchStatus()
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-metrics'] })
    },
    onError: (error: any) => {
      addLog(`Error: ${error.message}`)
    },
  })

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50))
  }

  useEffect(() => {
    if (status?.test_tag && !testTag) {
      setTestTag(status.test_tag)
    }
  }, [status, testTag])

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p className="font-semibold">Access Denied</p>
          </div>
          <p className="text-sm text-red-600 mt-2">
            Only administrators can access the simulator.
          </p>
        </div>
      </div>
    )
  }

  const isRunning = status?.status || false
  const currentTestTag = testTag || status?.test_tag || ''

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulator</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generate and process test orders in bulk
        </p>
      </div>

      {/* Status Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-green-500' : 'bg-gray-300'
              }`}
            ></div>
            <span className="text-sm font-medium">
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
        {currentTestTag && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">Test Tag:</p>
            <p className="text-sm font-mono font-medium">{currentTestTag}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Controls</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Number of Orders</label>
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
            <label className="label">Test Tag (optional)</label>
            <input
              type="text"
              value={testTag}
              onChange={(e) => setTestTag(e.target.value)}
              placeholder="Auto-generated if empty"
              className="input"
              disabled={isRunning}
            />
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {startMutation.isPending ? 'Starting...' : 'Start Simulator'}
              </button>
            ) : (
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="btn btn-danger flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                {stopMutation.isPending ? 'Stopping...' : 'Stop Simulator'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Processing */}
      {isRunning && currentTestTag && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Bulk Processing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => bulkProcessMutation.mutate('collect')}
              disabled={bulkProcessMutation.isPending}
              className="btn btn-secondary text-sm"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              Collect
            </button>
            <button
              onClick={() => bulkProcessMutation.mutate('handover')}
              disabled={bulkProcessMutation.isPending}
              className="btn btn-secondary text-sm"
            >
              Handover
            </button>
            <button
              onClick={() => bulkProcessMutation.mutate('deposit')}
              disabled={bulkProcessMutation.isPending}
              className="btn btn-secondary text-sm"
            >
              Deposit
            </button>
            <button
              onClick={() => bulkProcessMutation.mutate('reconcile')}
              disabled={bulkProcessMutation.isPending}
              className="btn btn-secondary text-sm"
            >
              Reconcile
            </button>
          </div>
        </div>
      )}

      {/* Cleanup */}
      {currentTestTag && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Cleanup</h2>
          <button
            onClick={() => {
              if (
                confirm(
                  `Are you sure you want to delete all test data with tag "${currentTestTag}"?`
                )
              ) {
                cleanupMutation.mutate()
              }
            }}
            disabled={cleanupMutation.isPending}
            className="btn btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {cleanupMutation.isPending
              ? 'Cleaning up...'
              : 'Cleanup Test Data'}
          </button>
        </div>
      )}

      {/* Logs */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Activity Logs</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet</p>
          ) : (
            logs.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  )
}

