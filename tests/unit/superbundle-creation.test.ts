/**
 * Unit tests for superbundle creation logic
 * Tests the aggregation and validation logic for creating superbundles
 */

interface Bundle {
  id: string
  status: string
  expected_amount: number
  asm_id: string
}

interface CreateSuperBundleRequest {
  bundle_ids: string[]
  denomination_breakdown: { [key: string]: number }
  asm_id: string
}

function validateSuperBundleCreation(
  bundles: Bundle[],
  request: CreateSuperBundleRequest
): {
  valid: boolean
  errors: string[]
  expectedAmount: number
} {
  const errors: string[] = []
  let expectedAmount = 0

  // Check all bundles exist
  if (bundles.length !== request.bundle_ids.length) {
    errors.push('One or more bundles not found')
    return { valid: false, errors, expectedAmount: 0 }
  }

  // Validate all bundles are in HANDEDOVER_TO_ASM status
  const invalidBundles = bundles.filter(
    (b) => b.status !== 'HANDEDOVER_TO_ASM'
  )
  if (invalidBundles.length > 0) {
    errors.push(
      `Bundles must be in HANDEDOVER_TO_ASM status. Invalid: ${invalidBundles.map((b) => b.id).join(', ')}`
    )
  }

  // Validate all bundles belong to same ASM
  const differentAsmBundles = bundles.filter(
    (b) => b.asm_id !== request.asm_id
  )
  if (differentAsmBundles.length > 0) {
    errors.push(
      `All bundles must belong to the same ASM. Invalid: ${differentAsmBundles.map((b) => b.id).join(', ')}`
    )
  }

  // Calculate expected amount
  expectedAmount = bundles.reduce(
    (sum, b) => sum + b.expected_amount,
    0
  )

  // Validate denomination breakdown
  const denominationTotal = Object.entries(request.denomination_breakdown).reduce(
    (sum, [denomination, count]) => sum + parseFloat(denomination) * count,
    0
  )
  const tolerance = 0.01
  if (Math.abs(denominationTotal - expectedAmount) > tolerance) {
    errors.push(
      `Denomination breakdown (${denominationTotal}) does not match expected amount (${expectedAmount})`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    expectedAmount,
  }
}

describe('SuperBundle Creation', () => {
  const mockBundles: Bundle[] = [
    {
      id: 'bundle-1',
      status: 'HANDEDOVER_TO_ASM',
      expected_amount: 10000,
      asm_id: 'asm-1',
    },
    {
      id: 'bundle-2',
      status: 'HANDEDOVER_TO_ASM',
      expected_amount: 5000,
      asm_id: 'asm-1',
    },
  ]

  test('should validate correct superbundle creation', () => {
    const request: CreateSuperBundleRequest = {
      bundle_ids: ['bundle-1', 'bundle-2'],
      denomination_breakdown: {
        '2000': 7,  // 14,000
        '500': 2,   // 1,000
      },
      asm_id: 'asm-1',
    }

    const result = validateSuperBundleCreation(mockBundles, request)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.expectedAmount).toBe(15000)
  })

  test('should reject superbundle with incorrect denomination breakdown', () => {
    const request: CreateSuperBundleRequest = {
      bundle_ids: ['bundle-1', 'bundle-2'],
      denomination_breakdown: {
        '2000': 5,  // 10,000 (incorrect)
      },
      asm_id: 'asm-1',
    }

    const result = validateSuperBundleCreation(mockBundles, request)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('does not match'))).toBe(true)
  })

  test('should reject superbundle with bundles in wrong status', () => {
    const bundles: Bundle[] = [
      {
        id: 'bundle-1',
        status: 'READY_FOR_HANDOVER', // Wrong status
        expected_amount: 10000,
        asm_id: 'asm-1',
      },
      {
        id: 'bundle-2',
        status: 'HANDEDOVER_TO_ASM',
        expected_amount: 5000,
        asm_id: 'asm-1',
      },
    ]

    const request: CreateSuperBundleRequest = {
      bundle_ids: ['bundle-1', 'bundle-2'],
      denomination_breakdown: { '2000': 7, '500': 2 },
      asm_id: 'asm-1',
    }

    const result = validateSuperBundleCreation(bundles, request)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('HANDEDOVER_TO_ASM'))).toBe(
      true
    )
  })

  test('should reject superbundle with bundles from different ASMs', () => {
    const bundles: Bundle[] = [
      {
        id: 'bundle-1',
        status: 'HANDEDOVER_TO_ASM',
        expected_amount: 10000,
        asm_id: 'asm-1',
      },
      {
        id: 'bundle-2',
        status: 'HANDEDOVER_TO_ASM',
        expected_amount: 5000,
        asm_id: 'asm-2', // Different ASM
      },
    ]

    const request: CreateSuperBundleRequest = {
      bundle_ids: ['bundle-1', 'bundle-2'],
      denomination_breakdown: { '2000': 7, '500': 2 },
      asm_id: 'asm-1',
    }

    const result = validateSuperBundleCreation(bundles, request)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('same ASM'))).toBe(true)
  })

  test('should calculate expected amount correctly for multiple bundles', () => {
    const bundles: Bundle[] = [
      { id: 'b1', status: 'HANDEDOVER_TO_ASM', expected_amount: 10000, asm_id: 'asm-1' },
      { id: 'b2', status: 'HANDEDOVER_TO_ASM', expected_amount: 5000, asm_id: 'asm-1' },
      { id: 'b3', status: 'HANDEDOVER_TO_ASM', expected_amount: 3000, asm_id: 'asm-1' },
    ]

    const request: CreateSuperBundleRequest = {
      bundle_ids: ['b1', 'b2', 'b3'],
      denomination_breakdown: {
        '2000': 9,  // 18,000
      },
      asm_id: 'asm-1',
    }

    const result = validateSuperBundleCreation(bundles, request)
    expect(result.expectedAmount).toBe(18000)
    expect(result.valid).toBe(true)
  })
})
