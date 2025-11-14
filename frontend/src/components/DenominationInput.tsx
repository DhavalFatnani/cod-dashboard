import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

interface DenominationInputProps {
  value: Record<string, number>
  onChange: (value: Record<string, number>) => void
  expectedAmount: number
  denominations?: number[]
}

const DEFAULT_DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

export default function DenominationInput({
  value,
  onChange,
  expectedAmount,
  denominations = DEFAULT_DENOMINATIONS,
}: DenominationInputProps) {
  const [calculatedAmount, setCalculatedAmount] = useState(0)

  useEffect(() => {
    let sum = 0
    for (const [denomination, count] of Object.entries(value)) {
      sum += parseFloat(denomination) * count
    }
    setCalculatedAmount(sum)
  }, [value])

  const handleChange = (denomination: string, count: number) => {
    const newValue = { ...value }
    if (count <= 0) {
      delete newValue[denomination]
    } else {
      newValue[denomination] = count
    }
    onChange(newValue)
  }

  const isValid = Math.abs(calculatedAmount - expectedAmount) < 0.01

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {denominations.map((denom) => (
          <div key={denom} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              ₹{denom}
            </label>
            <input
              type="number"
              min="0"
              value={value[denom.toString()] || 0}
              onChange={(e) => handleChange(denom.toString(), parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Calculated Amount:</p>
            <p className="text-2xl font-bold text-gray-900">₹{calculatedAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Expected Amount:</p>
            <p className="text-2xl font-bold text-gray-900">₹{expectedAmount.toFixed(2)}</p>
          </div>
        </div>

        {!isValid && (
          <div className="mt-3 flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              Difference: ₹{Math.abs(calculatedAmount - expectedAmount).toFixed(2)}
            </span>
          </div>
        )}

        {isValid && (
          <div className="mt-3 flex items-center gap-2 text-green-600">
            <span className="text-sm font-medium">✓ Amounts match</span>
          </div>
        )}
      </div>
    </div>
  )
}
