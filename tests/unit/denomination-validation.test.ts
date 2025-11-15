/**
 * Unit tests for denomination breakdown validation
 * These tests validate the logic for checking denomination totals match expected amounts
 */

interface DenominationBreakdown {
  [denomination: string]: number
}

function validateDenominationBreakdown(
  breakdown: DenominationBreakdown,
  expectedAmount: number,
  tolerance: number = 0.01
): { valid: boolean; total: number; difference: number } {
  const total = Object.entries(breakdown).reduce(
    (sum, [denomination, count]) => sum + parseFloat(denomination) * count,
    0
  )
  const difference = Math.abs(total - expectedAmount)
  const valid = difference <= tolerance

  return { valid, total, difference }
}

describe('Denomination Validation', () => {
  test('should validate correct denomination breakdown', () => {
    const breakdown = {
      '2000': 5,   // 10,000
      '500': 10,   // 5,000
      '100': 20,   // 2,000
    }
    const expected = 17000

    const result = validateDenominationBreakdown(breakdown, expected)
    expect(result.valid).toBe(true)
    expect(result.total).toBe(17000)
    expect(result.difference).toBeLessThan(0.01)
  })

  test('should reject incorrect denomination breakdown', () => {
    const breakdown = {
      '2000': 5,   // 10,000
      '500': 10,   // 5,000
    }
    const expected = 20000

    const result = validateDenominationBreakdown(breakdown, expected)
    expect(result.valid).toBe(false)
    expect(result.total).toBe(15000)
    expect(result.difference).toBe(5000)
  })

  test('should handle empty breakdown', () => {
    const breakdown = {}
    const expected = 0

    const result = validateDenominationBreakdown(breakdown, expected)
    expect(result.valid).toBe(true)
    expect(result.total).toBe(0)
  })

  test('should handle small differences within tolerance', () => {
    const breakdown = {
      '2000': 5,
      '500': 10,
      '100': 20,
    }
    const expected = 17000.005 // Very small difference

    const result = validateDenominationBreakdown(breakdown, expected, 0.01)
    expect(result.valid).toBe(true)
  })

  test('should handle all common denominations', () => {
    const breakdown = {
      '2000': 1,
      '500': 2,
      '200': 3,
      '100': 4,
      '50': 5,
      '20': 6,
      '10': 7,
    }
    const expected = 2000 + 1000 + 600 + 400 + 250 + 120 + 70 // 4440

    const result = validateDenominationBreakdown(breakdown, expected)
    expect(result.valid).toBe(true)
    expect(result.total).toBe(4440)
  })

  test('should calculate total correctly for large amounts', () => {
    const breakdown = {
      '2000': 100,  // 200,000
      '500': 50,    // 25,000
    }
    const expected = 225000

    const result = validateDenominationBreakdown(breakdown, expected)
    expect(result.valid).toBe(true)
    expect(result.total).toBe(225000)
  })
})
