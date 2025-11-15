/**
 * Unit tests for bundle actions logic
 * Tests the business logic for accepting/rejecting bundles
 */

interface Bundle {
  id: string
  status: string
  expected_amount: number
  asm_id: string
}

interface AcceptBundleRequest {
  bundle_id: string
  denomination_breakdown: { [key: string]: number }
}

function canAcceptBundle(bundle: Bundle, request: AcceptBundleRequest): {
  canAccept: boolean
  reason?: string
} {
  // Check bundle status
  if (bundle.status !== 'READY_FOR_HANDOVER') {
    return {
      canAccept: false,
      reason: `Bundle must be in READY_FOR_HANDOVER status. Current: ${bundle.status}`,
    }
  }

  // Validate denomination breakdown
  const total = Object.entries(request.denomination_breakdown).reduce(
    (sum, [denom, count]) => sum + parseFloat(denom) * count,
    0
  )
  const tolerance = 0.01
  if (Math.abs(total - bundle.expected_amount) > tolerance) {
    return {
      canAccept: false,
      reason: `Denomination breakdown (${total}) does not match expected amount (${bundle.expected_amount})`,
    }
  }

  return { canAccept: true }
}

function canRejectBundle(bundle: Bundle, rejectionReason: string): {
  canReject: boolean
  reason?: string
} {
  if (bundle.status !== 'READY_FOR_HANDOVER') {
    return {
      canReject: false,
      reason: `Bundle must be in READY_FOR_HANDOVER status. Current: ${bundle.status}`,
    }
  }

  if (!rejectionReason || rejectionReason.trim().length === 0) {
    return {
      canReject: false,
      reason: 'Rejection reason is required',
    }
  }

  return { canReject: true }
}

describe('Bundle Actions', () => {
  const mockBundle: Bundle = {
    id: 'bundle-123',
    status: 'READY_FOR_HANDOVER',
    expected_amount: 10000,
    asm_id: 'asm-1',
  }

  describe('Accept Bundle', () => {
    test('should accept bundle with valid denomination breakdown', () => {
      const request: AcceptBundleRequest = {
        bundle_id: 'bundle-123',
        denomination_breakdown: {
          '2000': 5, // 10,000
        },
      }

      const result = canAcceptBundle(mockBundle, request)
      expect(result.canAccept).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    test('should reject bundle with incorrect denomination breakdown', () => {
      const request: AcceptBundleRequest = {
        bundle_id: 'bundle-123',
        denomination_breakdown: {
          '2000': 4, // 8,000 (incorrect)
        },
      }

      const result = canAcceptBundle(mockBundle, request)
      expect(result.canAccept).toBe(false)
      expect(result.reason).toContain('does not match expected amount')
    })

    test('should reject bundle not in READY_FOR_HANDOVER status', () => {
      const bundle: Bundle = {
        ...mockBundle,
        status: 'CREATED',
      }

      const request: AcceptBundleRequest = {
        bundle_id: 'bundle-123',
        denomination_breakdown: { '2000': 5 },
      }

      const result = canAcceptBundle(bundle, request)
      expect(result.canAccept).toBe(false)
      expect(result.reason).toContain('READY_FOR_HANDOVER')
    })
  })

  describe('Reject Bundle', () => {
    test('should reject bundle with valid reason', () => {
      const result = canRejectBundle(mockBundle, 'Denomination mismatch')
      expect(result.canReject).toBe(true)
    })

    test('should reject bundle without reason', () => {
      const result = canRejectBundle(mockBundle, '')
      expect(result.canReject).toBe(false)
      expect(result.reason).toContain('required')
    })

    test('should reject bundle not in READY_FOR_HANDOVER status', () => {
      const bundle: Bundle = {
        ...mockBundle,
        status: 'HANDEDOVER_TO_ASM',
      }

      const result = canRejectBundle(bundle, 'Some reason')
      expect(result.canReject).toBe(false)
      expect(result.reason).toContain('READY_FOR_HANDOVER')
    })
  })
})
