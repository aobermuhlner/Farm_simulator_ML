/**
 * The farm's money: exactness over a long sum, a reason on every movement, and the
 * difference between a refusal a student can reach and a mistake in the calling code.
 */

import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import {
  credit,
  debit,
  formatUnits,
  INSUFFICIENT_FUNDS,
  movementsThisYear,
  openFarm,
  toUnits,
} from '../src/economy/index.js'

const declaration: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'CHF',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
  openingCrop: 10,
  cropComposition: { sound: 0.75, spoiled: 0.25 },
}

/** A farm holding `amount` in the declared currency. */
function holding(amount: number): Farm {
  return openFarm({ ...declaration, openingBalance: amount })
}

describe('the farm opens at its declared state', () => {
  it('holds the declared balance in whole units and the declared year', () => {
    const farm = openFarm({ ...declaration, openingBalance: 2000, openingYear: 7 })
    expect(farm.balance).toBe(200000)
    expect(farm.year).toBe(7)
    expect(farm.movements).toEqual([])
    expect(farm.ledger).toEqual([])
  })
})

describe('a long sum stays exact', () => {
  it('totals eighteen thousand credits of 0.40 at exactly 7 200.00', () => {
    let farm = holding(0)
    const each = toUnits(0.4, declaration.precision)
    for (let index = 0; index < 18_000; index += 1) {
      farm = credit(farm, each, 'a picked apple')
    }
    expect(farm.balance).toBe(720000)
    expect(formatUnits(farm.balance, declaration)).toBe('CHF 7 200.00')
  })

  it('presents the figure with no residue of its own arithmetic', () => {
    const farm = credit(holding(0), toUnits(0.404, declaration.precision), 'a picked apple')
    expect(formatUnits(farm.balance, declaration)).toBe('CHF 0.40')
    expect(farm.movements[0]?.units).toBe(40)
  })
})

describe('the money module is arithmetic and nothing else', () => {
  it('imports neither React nor any storage API', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.ts$/.test(name)) files.push(path)
      }
    }
    walk(join(process.cwd(), 'src/economy'))

    expect(files.length).toBeGreaterThan(2)
    const offences = files.filter((file) => {
      const text = readFileSync(file, 'utf8')
      return (
        /from ['"]react/.test(text) ||
        /from ['"][^'"]*web\//.test(text) ||
        /\b(localStorage|sessionStorage|indexedDB|document|window)\b/.test(text)
      )
    })
    expect(offences.map((file) => relative(process.cwd(), file))).toEqual([])
  })
})

describe('every movement states its reason', () => {
  it('reads two debits back in order, each with its amount and its reason', () => {
    const first = debit(holding(100), toUnits(10, 2), 'a sorting table')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = debit(first.farm, toUnits(25, 2), 'a second robot arm')
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(movementsThisYear(second.farm)).toEqual([
      { units: -1000, reason: 'a sorting table' },
      { units: -2500, reason: 'a second robot arm' },
    ])
  })

  it('throws rather than recording a movement with no reason', () => {
    const farm = holding(100)
    expect(() => credit(farm, 500, '')).toThrow(/reason/)
    expect(() => credit(farm, 500, '   ')).toThrow(/reason/)
    expect(() => debit(farm, 500, '')).toThrow(/reason/)
    expect(farm.balance).toBe(10000)
    expect(farm.movements).toEqual([])
  })
})

describe('a debit larger than the balance is refused', () => {
  it('names the shortfall and leaves the balance alone', () => {
    const farm = holding(800)
    const attempted = debit(farm, toUnits(1200, 2), 'a greenhouse')

    expect(attempted.ok).toBe(false)
    if (attempted.ok) return
    expect(attempted.issues[0]?.code).toBe(INSUFFICIENT_FUNDS)
    expect(attempted.issues[0]?.message).toContain('CHF 400.00')
    expect(farm.balance).toBe(80000)
    expect(formatUnits(farm.balance, declaration)).toBe('CHF 800.00')
  })

  it('leaves no trace of a refused debit in the year in progress', () => {
    const farm = holding(800)
    const attempted = debit(farm, toUnits(1200, 2), 'a greenhouse')
    expect(attempted.ok).toBe(false)
    expect(movementsThisYear(farm)).toEqual([])
  })

  it('permits a debit that empties the balance exactly', () => {
    const spent = debit(holding(800), toUnits(800, 2), 'everything')
    expect(spent.ok).toBe(true)
    if (!spent.ok) return
    expect(spent.farm.balance).toBe(0)
  })
})

describe('an amount that never crossed the unit boundary properly', () => {
  it('throws for a non-integer amount, so a doubled conversion fails loudly', () => {
    const farm = holding(100)
    expect(() => credit(farm, 40.5, 'a picked apple')).toThrow(/whole number/)
    expect(() => debit(farm, 40.5, 'a sorting table')).toThrow(/whole number/)
    expect(farm.movements).toEqual([])
  })

  it('throws for a non-finite amount', () => {
    const farm = holding(100)
    expect(() => credit(farm, Number.NaN, 'a picked apple')).toThrow(/whole number/)
    expect(() => debit(farm, Number.POSITIVE_INFINITY, 'a robot')).toThrow(/whole number/)
    expect(farm.movements).toEqual([])
  })

  it('throws for a movement given the wrong sign for its direction', () => {
    const farm = holding(100)
    expect(() => credit(farm, -500, 'a picked apple')).toThrow(/negative/)
    expect(() => debit(farm, -500, 'a refund')).toThrow(/negative/)
    expect(farm.movements).toEqual([])
  })
})
