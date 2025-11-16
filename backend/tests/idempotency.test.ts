import { describe, it, expect } from 'vitest'
import { getOrCreateIdempotent } from '@/lib/idempotency'

describe('idempotency', () => {
  it('replays same response for same key', async () => {
    let calls = 0
    const compute = async () => { calls++; return { status: 200 as const, body: { n: calls } } }
    const r1 = await getOrCreateIdempotent('key-1', 'POST', '/x', compute)
    const r2 = await getOrCreateIdempotent('key-1', 'POST', '/x', compute)
    expect(r1.body).toEqual({ n: 1 })
    expect(r2.body).toEqual({ n: 1 })
    expect(calls).toBe(1)
  })
})
