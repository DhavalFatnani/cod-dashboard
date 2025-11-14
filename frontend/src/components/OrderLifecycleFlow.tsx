import { CheckCircle, Circle, ArrowRight } from 'lucide-react'

interface OrderLifecycleFlowProps {
  currentState?: string
  orderCounts?: {
    uncollected?: number
    collected?: number
    handover?: number  // Includes both HANDOVER_TO_ASM and PENDING_TO_DEPOSIT
    deposited?: number
    reconciled?: number
    reconciliationException?: number
  }
  onStageClick?: (stageKey: string | null) => void
}

const stages = [
  { key: 'UNCOLLECTED', label: 'Pending Collection from Customer', color: 'yellow', description: 'Orders awaiting rider pickup' },
  { key: 'COLLECTED_BY_RIDER', label: 'With Rider', color: 'blue', description: 'Cash collected by rider' },
  { key: 'HANDOVER_TO_ASM', label: 'Collected by ASM', color: 'purple', description: 'Collected by ASM, ready for deposit' },
  { key: 'DEPOSITED', label: 'Deposited', color: 'green', description: 'Deposited to bank' },
  { key: 'RECONCILED', label: 'Reconciled', color: 'emerald', description: 'Fully reconciled' },
  { key: 'RECONCILIATION_EXCEPTION', label: 'Reconciliation Exception', color: 'red', description: 'Reconciliation issues' },
]

export default function OrderLifecycleFlow({ currentState, orderCounts, onStageClick }: OrderLifecycleFlowProps) {
  const getStageIndex = (state: string) => {
    return stages.findIndex(s => s.key === state)
  }

  const currentIndex = currentState ? getStageIndex(currentState) : -1
  const selectedStage = currentState ? stages.find(s => s.key === currentState) : null

  const getColorClasses = (color: string, isActive: boolean, isCompleted: boolean) => {
    const base = {
      yellow: {
        bg: 'bg-yellow-100',
        hover: 'hover:bg-yellow-200',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        ring: 'ring-yellow-500',
        activeBg: 'bg-yellow-200',
      },
      blue: {
        bg: 'bg-blue-100',
        hover: 'hover:bg-blue-200',
        text: 'text-blue-700',
        border: 'border-blue-300',
        ring: 'ring-blue-500',
        activeBg: 'bg-blue-200',
      },
      purple: {
        bg: 'bg-purple-100',
        hover: 'hover:bg-purple-200',
        text: 'text-purple-700',
        border: 'border-purple-300',
        ring: 'ring-purple-500',
        activeBg: 'bg-purple-200',
      },
      green: {
        bg: 'bg-green-100',
        hover: 'hover:bg-green-200',
        text: 'text-green-700',
        border: 'border-green-300',
        ring: 'ring-green-500',
        activeBg: 'bg-green-200',
      },
      emerald: {
        bg: 'bg-emerald-100',
        hover: 'hover:bg-emerald-200',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
        ring: 'ring-emerald-500',
        activeBg: 'bg-emerald-200',
      },
    }
    return base[color as keyof typeof base] || base.blue
  }

  const handleStageClick = (stageKey: string) => {
    if (onStageClick) {
      // Toggle: if clicking the same stage, deselect it
      if (currentState === stageKey) {
        onStageClick(null)
      } else {
        onStageClick(stageKey)
      }
    }
  }

  // Map stage keys to orderCounts keys
  const countMap: Record<string, keyof typeof orderCounts> = {
    'UNCOLLECTED': 'uncollected',
    'COLLECTED_BY_RIDER': 'collected',
    'HANDOVER_TO_ASM': 'handover',
    'DEPOSITED': 'deposited',
    'RECONCILED': 'reconciled',
    'RECONCILIATION_EXCEPTION': 'reconciliationException',
  }

  return (
    <div className="card bg-gradient-to-br from-gray-50 to-white">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">COD Order Lifecycle</h3>
        <p className="text-sm text-gray-500">
          {selectedStage 
            ? `Viewing: ${selectedStage.label} - ${selectedStage.description}`
            : 'Click on any stage to view detailed metrics and filter COD orders'
          }
        </p>
      </div>
      
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4 pt-2">
        {stages.map((stage, index) => {
          const isSelected = currentState === stage.key
          const isCompleted = currentIndex > index
          const isCurrent = currentIndex === index
          
          const colors = getColorClasses(stage.color, isSelected, isCompleted)
          const count = orderCounts?.[countMap[stage.key]] || 0

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-[140px]">
              <div className="flex flex-col items-center flex-1 w-full">
                <div className="relative mb-2">
                  <button
                    onClick={() => handleStageClick(stage.key)}
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200
                      ${isSelected 
                        ? `${colors.activeBg} ${colors.border} ring-2 ring-offset-2 ring-offset-white ${colors.ring} shadow-md` 
                        : isCompleted || isCurrent
                          ? `${colors.bg} ${colors.border} ${colors.hover} cursor-pointer`
                          : 'bg-gray-100 border-gray-300 hover:bg-gray-200 cursor-pointer'
                      }
                    `}
                    title={stage.description}
                  >
                    {isCompleted ? (
                      <CheckCircle className={`w-6 h-6 ${colors.text}`} />
                    ) : (
                      <Circle className={`w-6 h-6 ${isSelected || isCurrent ? colors.text : 'text-gray-400'}`} />
                    )}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </button>
                </div>
                <div className="text-center w-full">
                  <p className={`text-xs font-medium ${isSelected || isCurrent ? colors.text : 'text-gray-500'}`}>
                    {stage.label}
                  </p>
                  {count > 0 && (
                    <p className={`text-xs font-semibold mt-1 ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                      {count} orders
                    </p>
                  )}
                </div>
              </div>
              {index < stages.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 bg-gray-200 relative">
                  {isCompleted && (
                    <div className={`absolute inset-0 ${colors.bg.replace('100', '500')} transition-all duration-500`}></div>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-400 absolute -right-2 top-1/2 transform -translate-y-1/2" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
