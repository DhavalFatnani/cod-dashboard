import { useState, ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'

export interface WizardStep {
  id: string
  title: string
  description?: string
  content: ReactNode
  validate?: () => boolean | string
  onNext?: () => void | Promise<void>
  onBack?: () => void
}

interface ActionWizardProps {
  isOpen: boolean
  onClose: () => void
  title: string
  steps: WizardStep[]
  onComplete: () => void | Promise<void>
  showProgress?: boolean
}

export function ActionWizard({
  isOpen,
  onClose,
  title,
  steps,
  onComplete,
  showProgress = true,
}: ActionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const currentStepData = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const handleNext = async () => {
    // Validate current step
    if (currentStepData.validate) {
      const validation = currentStepData.validate()
      if (validation !== true) {
        alert(typeof validation === 'string' ? validation : 'Please complete this step')
        return
      }
    }

    // Call onNext hook if provided
    if (currentStepData.onNext) {
      await currentStepData.onNext()
    }

    if (isLastStep) {
      setIsSubmitting(true)
      try {
        await onComplete()
        onClose()
        setCurrentStep(0)
      } catch (error) {
        console.error('Error completing wizard:', error)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStepData.onBack) {
      currentStepData.onBack()
    }
    setCurrentStep(currentStep - 1)
  }

  const handleClose = () => {
    if (confirm('Are you sure you want to close? Your progress will be saved.')) {
      onClose()
      setCurrentStep(0)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              {showProgress && (
                <p className="text-sm text-gray-500 mt-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          {showProgress && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex-1 flex items-center">
                    <div
                      className={`flex-1 h-2 rounded-full ${
                        index <= currentStep
                          ? 'bg-blue-600'
                          : 'bg-gray-200'
                      }`}
                    />
                    {index < steps.length - 1 && (
                      <div
                        className={`w-2 h-2 rounded-full mx-1 ${
                          index < currentStep
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step Indicator */}
          {showProgress && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex-1 text-center ${
                      index === currentStep
                        ? 'text-blue-600 font-semibold'
                        : index < currentStep
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div className="text-xs">{step.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-sm text-gray-600">{currentStepData.description}</p>
              )}
            </div>
            <div>{currentStepData.content}</div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <button
              onClick={isFirstStep ? handleClose : handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              disabled={isSubmitting}
            >
              <ChevronLeft className="w-4 h-4" />
              {isFirstStep ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : isLastStep ? (
                <>
                  Complete
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

