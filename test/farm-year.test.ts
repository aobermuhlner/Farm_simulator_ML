/**
 * A year brought in across several cards, and closed once.
 *
 * The whole point of the module under test is what it does *not* do: accumulating a
 * card's crop must leave the balance, the ledger and the year exactly where they were,
 * so a year abandoned half way costs nothing and pays nothing. Closing is the only step
 * that reaches `recordHarvest`, and it reaches it once.
 */

import { describe, expect, it } from 'vitest'
import type { CropBroughtIn } from '../src/economy/index.js'
import {
  bringIn,
  closeYear,
  credit,
  isComplete,
  openFarm,
  openYear,
  outstanding,
  toUnits,
  totalPaid,
} from '../src/economy/index.js'
import { testFarm } from './helpers/catalog.js'

const opened = openFarm({ ...testFarm, openingBalance: 1000, openingYear: 3 })

function crop(taskId: string, paid: number): CropBroughtIn {
  return {
    taskId,
    paidUnits: toUnits(paid, testFarm.precision),
    evaluated: 10,
    counts: { sound: { keep: 10 } },
  }
}

describe('what a card brings in is held, not credited', () => {
  it('leaves the balance, the ledger and the year untouched however many cards come in', () => {
    let year = openYear(opened)
    for (const [index, paid] of [12.5, 40, -8.25, 100].entries()) {
      year = bringIn(year, crop(`card-${index}`, paid))
      expect(opened.balance).toBe(toUnits(1000, 2))
      expect(opened.ledger).toEqual([])
      expect(opened.year).toBe(3)
    }

    expect(year.brought).toHaveLength(4)
    expect(totalPaid(year)).toBe(toUnits(144.25, 2))
  })

  it('opens at the farm’s own year with nothing brought in', () => {
    const year = openYear(opened)

    expect(year.year).toBe(3)
    expect(year.brought).toEqual([])
    expect(totalPaid(year)).toBe(0)
  })

  it('counts a card once however many times it is brought in', () => {
    const year = bringIn(bringIn(openYear(opened), crop('orchard', 10)), crop('orchard', 25))

    expect(year.brought).toHaveLength(1)
    expect(totalPaid(year)).toBe(toUnits(25, 2))
  })

  it('names what is still outstanding, and knows when nothing is', () => {
    const playable = ['orchard', 'heirloom', 'livestock']
    const started = openYear(opened)

    expect(outstanding(started, playable)).toEqual(playable)
    expect(isComplete(started, playable)).toBe(false)

    const two = bringIn(bringIn(started, crop('orchard', 5)), crop('livestock', 5))
    expect(outstanding(two, playable)).toEqual(['heirloom'])
    expect(isComplete(two, playable)).toBe(false)

    const all = bringIn(two, crop('heirloom', 5))
    expect(outstanding(all, playable)).toEqual([])
    expect(isComplete(all, playable)).toBe(true)
  })

  it('treats a year that was never run as everything outstanding', () => {
    expect(outstanding(undefined, ['orchard'])).toEqual(['orchard'])
    expect(isComplete(undefined, [])).toBe(false)
    expect(totalPaid(undefined)).toBe(0)
  })
})

describe('several crops close one year between them', () => {
  it('appends one record for the total, and advances the year by one', () => {
    const playable = ['orchard', 'heirloom', 'livestock']
    let year = openYear(opened)
    year = bringIn(year, crop('orchard', 120))
    year = bringIn(year, crop('heirloom', 30.5))
    year = bringIn(year, crop('livestock', -10.5))
    expect(isComplete(year, playable)).toBe(true)

    const { farm, closed } = closeYear(opened, year)

    expect(farm.ledger).toHaveLength(1)
    expect(farm.ledger[0]?.year).toBe(3)
    expect(farm.ledger[0]?.harvest).toBe(toUnits(140, 2))
    expect(farm.balance).toBe(toUnits(1140, 2))
    expect(farm.year).toBe(4)
    expect(closed.year).toBe(3)
    expect(closed.brought).toHaveLength(3)
  })

  it('closes a single-card farm in one step, so the in-progress state is invisible', () => {
    const playable = ['orchard']
    const year = bringIn(openYear(opened), crop('orchard', 75))

    expect(isComplete(year, playable)).toBe(true)

    const { farm } = closeYear(opened, year)
    expect(farm.ledger).toHaveLength(1)
    expect(farm.ledger[0]?.harvest).toBe(toUnits(75, 2))
    expect(farm.year).toBe(4)
  })

  it('floors a losing year at zero the way recording a harvest already does', () => {
    const year = bringIn(openYear(opened), crop('orchard', -1200))
    const { farm } = closeYear(opened, year)

    expect(farm.balance).toBe(0)
    expect(farm.ledger[0]?.absorbed).toBe(toUnits(200, 2))
    expect(farm.year).toBe(4)
  })
})

describe('a year abandoned in progress costs nothing and pays nothing', () => {
  it('leaves the balance, the ledger and the year as they were before it was run', () => {
    const playable = ['orchard', 'heirloom']
    const before = credit(opened, toUnits(60, 2), 'a sale')

    const year = bringIn(openYear(before), crop('orchard', 500))
    expect(isComplete(year, playable)).toBe(false)

    // Abandoning is simply not closing: the farm value never went anywhere.
    expect(before.balance).toBe(toUnits(1060, 2))
    expect(before.ledger).toEqual([])
    expect(before.year).toBe(3)
    expect(before.movements).toHaveLength(1)
  })
})
