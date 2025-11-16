import { describe, it, expect } from 'vitest'
import { MoneyState, canTransition } from '@/lib/moneyState'

describe('money state machine', () => {
  it('allows forward transitions', () => {
    expect(canTransition(MoneyState.Uncollected, MoneyState.CollectedUnbundled)).toBe(true)
    expect(canTransition(MoneyState.Bundled, MoneyState.AcceptedByAsm)).toBe(true)
  })
  it('blocks invalid transitions', () => {
    expect(canTransition(MoneyState.Reconciled, MoneyState.Deposited)).toBe(false)
  })
})
