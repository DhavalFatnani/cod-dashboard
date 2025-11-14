import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatDateOnly } from './format'

describe('formatCurrency', () => {
  it('formats currency correctly', () => {
    expect(formatCurrency(1000)).toBe('₹1,000')
    expect(formatCurrency(1500.50)).toBe('₹1,501')
    expect(formatCurrency(0)).toBe('₹0')
  })
})

describe('formatDate', () => {
  it('formats date with time', () => {
    const date = '2024-01-15T10:30:00Z'
    const formatted = formatDate(date)
    expect(formatted).toContain('Jan')
    expect(formatted).toContain('2024')
  })

  it('handles null', () => {
    expect(formatDate(null)).toBe('-')
  })
})

describe('formatDateOnly', () => {
  it('formats date without time', () => {
    const date = '2024-01-15T10:30:00Z'
    const formatted = formatDateOnly(date)
    expect(formatted).toContain('Jan')
    expect(formatted).toContain('2024')
    expect(formatted).not.toContain(':')
  })

  it('handles null', () => {
    expect(formatDateOnly(null)).toBe('-')
  })
})

