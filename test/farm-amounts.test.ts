/**
 * The one boundary an amount crosses into whole units, and the one that presents it.
 *
 * The rounding is tested against the fractions the payoff tables are actually written
 * in, because that is where a rounding rule earns or loses its keep.
 */

import { describe, expect, it } from 'vitest'
import type { FarmDeclaration } from '../src/economy/index.js'
import { formatUnits, toAmount, toUnits } from '../src/economy/index.js'

const cents: FarmDeclaration = {
  name: 'Cent Farm',
  currency: 'CHF',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
}

/** A second currency, counted whole and labelled differently. Not a code change. */
const coins: FarmDeclaration = {
  name: 'Coin Farm',
  currency: 'coins',
  precision: 0,
  openingBalance: 0,
  openingYear: 1,
}

describe('an amount crossing into whole units', () => {
  it('rounds a finer amount to the declared precision', () => {
    expect(toUnits(0.404, 2)).toBe(40)
    expect(toAmount(toUnits(0.404, 2), 2)).toBe(0.4)
  })

  it('rounds a half away from zero, the same either side of it', () => {
    expect(toUnits(0.405, 2)).toBe(41)
    expect(toUnits(-0.405, 2)).toBe(-41)
    expect(toUnits(1.005, 2)).toBe(101)
  })

  it('scales the fractions the payoff tables are written in exactly', () => {
    expect(toUnits(0.4, 2)).toBe(40)
    expect(toUnits(-0.15, 2)).toBe(-15)
    expect(toUnits(2.35, 2)).toBe(235)
  })

  it('counts a currency with no fraction in whole units of itself', () => {
    expect(toUnits(7, 0)).toBe(7)
    expect(toUnits(7.4, 0)).toBe(7)
  })

  it('refuses an amount that is not a finite number', () => {
    for (const amount of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => toUnits(amount, 2)).toThrow(/finite/)
    }
  })

  it('refuses a precision that is not a whole number of places', () => {
    expect(() => toUnits(1, 1.5)).toThrow(/precision/)
    expect(() => toUnits(1, -1)).toThrow(/precision/)
  })
})

describe('whole units presented', () => {
  it('carries the declared label and no other', () => {
    const shown = formatUnits(720000, cents)
    expect(shown).toContain('CHF')
    for (const other of ['$', '€', 'USD', 'EUR', 'coins']) {
      expect(shown, `"${other}" appeared in a CHF figure`).not.toContain(other)
    }
  })

  it('groups the whole part in threes without a locale', () => {
    expect(formatUnits(720000, cents)).toBe('CHF 7 200.00')
    expect(formatUnits(100, cents)).toBe('CHF 1.00')
    expect(formatUnits(0, cents)).toBe('CHF 0.00')
    expect(formatUnits(123456789, cents)).toBe('CHF 1 234 567.89')
  })

  it('shows a loss as a loss', () => {
    expect(formatUnits(-50000, cents)).toBe('CHF -500.00')
  })

  it('formats a second currency declaration differently with no code change', () => {
    expect(formatUnits(7200, coins)).toBe('coins 7 200')
    expect(formatUnits(7200, coins)).not.toBe(formatUnits(7200, cents))
  })

  it('refuses to present something that is not whole units', () => {
    expect(() => formatUnits(12.5, cents)).toThrow(/whole units/i)
  })
})
