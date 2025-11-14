import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../utils/format'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingDown, 
  DollarSign,
  FileText,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ContextualGuidance } from '../components/ContextualGuidance'

export default function FinanceDashboard() {
  // Fetch orders with edge cases for reconciliation
  const { data: edgeCases, isLoading } = useQuery({
    queryKey: ['finance-edge-cases'],
    queryFn: async () => {
      // Fetch partial collections
      const { data: partialCollections } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_type', 'COD')
        .eq('is_partial_collection', true)
        .order('created_at', { ascending: false })
        .limit(100)

      // Fetch orders with discrepancies
      const { data: discrepancies } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_type', 'COD')
        .gt('collection_discrepancy', 0)
        .order('collection_discrepancy', { ascending: false })
        .limit(100)

      // Fetch deposited orders pending reconciliation
      const { data: pendingReconciliation } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_type', 'COD')
        .eq('money_state', 'DEPOSITED')
        .order('deposited_at', { ascending: false })
        .limit(100)

      // Fetch orders with non-collection reasons
      const { data: nonCollected } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_type', 'COD')
        .not('asm_non_collected_reason', 'is', null)
        .order('asm_collection_reason_updated_at', { ascending: false })
        .limit(100)

      // Calculate summary stats
      const partialCount = partialCollections?.length || 0
      const partialAmount = partialCollections?.reduce((sum, o) => sum + (o.collected_amount || 0), 0) || 0
      const discrepancyCount = discrepancies?.length || 0
      const discrepancyAmount = discrepancies?.reduce((sum, o) => sum + (o.collection_discrepancy || 0), 0) || 0
      const pendingCount = pendingReconciliation?.length || 0
      const pendingAmount = pendingReconciliation?.reduce((sum, o) => sum + (o.cod_amount || 0), 0) || 0
      const nonCollectedCount = nonCollected?.length || 0

      return {
        partialCollections: partialCollections || [],
        discrepancies: discrepancies || [],
        pendingReconciliation: pendingReconciliation || [],
        nonCollected: nonCollected || [],
        stats: {
          partialCount,
          partialAmount,
          discrepancyCount,
          discrepancyAmount,
          pendingCount,
          pendingAmount,
          nonCollectedCount,
        }
      }
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const { partialCollections, discrepancies, pendingReconciliation, nonCollected, stats } = edgeCases || {
    partialCollections: [],
    discrepancies: [],
    pendingReconciliation: [],
    nonCollected: [],
    stats: {
      partialCount: 0,
      partialAmount: 0,
      discrepancyCount: 0,
      discrepancyAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      nonCollectedCount: 0,
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Finance Reconciliation Dashboard</h1>
        <p className="text-gray-600">
          Monitor edge cases and discrepancies requiring reconciliation attention
        </p>
      </div>

      {/* Contextual Guidance */}
      {stats.pendingCount > 0 && (
        <ContextualGuidance
          id="finance-pending-reconciliation"
          title="Pending Reconciliations"
          message={`You have ${stats.pendingCount} deposit${stats.pendingCount > 1 ? 's' : ''} pending reconciliation totaling ${formatCurrency(stats.pendingAmount)}. Review deposits and mark them as reconciled once verified.`}
          variant="warning"
          showForRoles={['finance', 'admin']}
          priority="high"
        />
      )}

      {stats.discrepancyCount > 0 && (
        <ContextualGuidance
          id="finance-discrepancies"
          title="Amount Discrepancies Detected"
          message={`${stats.discrepancyCount} order${stats.discrepancyCount > 1 ? 's' : ''} have collection discrepancies totaling ${formatCurrency(stats.discrepancyAmount)}. Review these orders and reconcile the differences.`}
          variant="error"
          showForRoles={['finance', 'admin']}
          priority="high"
        />
      )}

      {stats.partialCount > 0 && (
        <ContextualGuidance
          id="finance-partial-collections"
          title="Partial Collections"
          message={`${stats.partialCount} order${stats.partialCount > 1 ? 's' : ''} have partial collections. Review these orders to ensure proper reconciliation.`}
          variant="info"
          showForRoles={['finance', 'admin']}
          priority="medium"
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-200 rounded-lg">
              <TrendingDown className="w-5 h-5 text-orange-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-orange-800 uppercase tracking-wide">Partial Collections</p>
              <p className="text-2xl font-bold text-orange-900">{stats.partialCount}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-orange-700">
            {formatCurrency(stats.partialAmount)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-red-800 uppercase tracking-wide">Discrepancies</p>
              <p className="text-2xl font-bold text-red-900">{stats.discrepancyCount}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-red-700">
            {formatCurrency(stats.discrepancyAmount)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-200 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-yellow-800 uppercase tracking-wide">Pending Reconciliation</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pendingCount}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-yellow-700">
            {formatCurrency(stats.pendingAmount)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-200 rounded-lg">
              <XCircle className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Not Collected</p>
              <p className="text-2xl font-bold text-blue-900">{stats.nonCollectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partial Collections */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Partial Collections</h2>
              <span className="px-2.5 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded-full">
                {partialCollections.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Orders where collected amount is less than COD amount
            </p>
          </div>
          <div className="p-6">
            {partialCollections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No partial collections</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partialCollections.slice(0, 10).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="block p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                      <span className="badge bg-orange-100 text-orange-700">Partial</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-600">Expected: <span className="font-medium">{formatCurrency(order.cod_amount)}</span></p>
                        <p className="text-orange-700">Collected: <span className="font-semibold">{formatCurrency(order.collected_amount || 0)}</span></p>
                      </div>
                      {order.collection_discrepancy > 0 && (
                        <p className="text-red-600 font-semibold">
                          -{formatCurrency(order.collection_discrepancy)}
                        </p>
                      )}
                    </div>
                    {order.asm_name && (
                      <p className="text-xs text-gray-500 mt-1">ASM: {order.asm_name}</p>
                    )}
                  </Link>
                ))}
                {partialCollections.length > 10 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    Showing 10 of {partialCollections.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Discrepancies */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Amount Discrepancies</h2>
              <span className="px-2.5 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                {discrepancies.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Orders with collection shortfalls requiring attention
            </p>
          </div>
          <div className="p-6">
            {discrepancies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No discrepancies found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {discrepancies.slice(0, 10).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="block p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                      <span className="badge bg-red-100 text-red-700">Discrepancy</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-600">Expected: <span className="font-medium">{formatCurrency(order.cod_amount)}</span></p>
                        <p className="text-red-700">Collected: <span className="font-semibold">{formatCurrency(order.collected_amount || 0)}</span></p>
                      </div>
                      <p className="text-red-600 font-bold text-base">
                        -{formatCurrency(order.collection_discrepancy || 0)}
                      </p>
                    </div>
                    {order.asm_name && (
                      <p className="text-xs text-gray-500 mt-1">ASM: {order.asm_name}</p>
                    )}
                  </Link>
                ))}
                {discrepancies.length > 10 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    Showing 10 of {discrepancies.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pending Reconciliation */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-yellow-100">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pending Reconciliation</h2>
              <span className="px-2.5 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded-full">
                {pendingReconciliation.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Deposited orders awaiting finance team reconciliation
            </p>
          </div>
          <div className="p-6">
            {pendingReconciliation.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>All orders reconciled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReconciliation.slice(0, 10).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="block p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                      <span className="badge bg-yellow-100 text-yellow-700">Pending</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-gray-600">Amount: <span className="font-semibold">{formatCurrency(order.cod_amount)}</span></p>
                      {order.deposited_at && (
                        <p className="text-xs text-gray-500">
                          Deposited: {formatDate(order.deposited_at)}
                        </p>
                      )}
                    </div>
                    {order.is_partial_collection && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ Partial collection: {formatCurrency(order.collected_amount || 0)} of {formatCurrency(order.cod_amount)}
                      </p>
                    )}
                  </Link>
                ))}
                {pendingReconciliation.length > 10 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    Showing 10 of {pendingReconciliation.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Non-Collected Orders */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Not Collected Orders</h2>
              <span className="px-2.5 py-0.5 bg-blue-200 text-blue-800 text-xs font-medium rounded-full">
                {nonCollected.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Orders marked as not collected with reasons
            </p>
          </div>
          <div className="p-6">
            {nonCollected.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>All orders collected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {nonCollected.slice(0, 10).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                      <span className="badge bg-blue-100 text-blue-700">Not Collected</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Reason:</span> {order.asm_non_collected_reason}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <p>Amount: {formatCurrency(order.cod_amount)}</p>
                      {order.asm_future_collection_possible && order.asm_expected_collection_date && (
                        <p className="text-blue-600">
                          Expected: {formatDate(order.asm_expected_collection_date)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
                {nonCollected.length > 10 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    Showing 10 of {nonCollected.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

