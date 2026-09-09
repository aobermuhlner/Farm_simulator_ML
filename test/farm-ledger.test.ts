/**
 * The year counter and the ledger.
 *
 * The year advancing only at a harvest is what makes the harvest a commitment rather
 * than a button, so the tests here are as much about what *cannot* advance it as about
 * what does. The other half is the floor: a ruinous year is recorded honestly and still
 * leaves a farm that can be played.
 */

import { describe, expect, it } from 'vitest'
import type { Farm, FarmDeclaration } from '../src/economy/index.js'
import {
  bringIn,
  closeYear,
  credit,
  cropSize,
  debit,
  openFarm,
  openYear,
  recordHarvest,
  toUnits,
} from '../src/economy/index.js'

const declaration: FarmDeclaration = {
  name: 'Test Farm',
  currency: 'CHF',
  precision: 2,
  openingBalance: 0,
  openingYear: 1,
  orchard: { label: 'Orchard', unit: 'trees', opening: 10, piecesPerUnit: 1 },
  cropComposition: { sound: 0.75, spoiled: 0.25 },
}

function farmIn(year: number, amount: number): Farm {
  return openFarm({ ...declaration, openingYear: year, openingBalance: amount })
}

/** An amount in the declared currency, as whole units. */
function chf(amount: number): number {
  return toUnits(amount, declaration.precision)
}

describe('only a harvest closes a year', () => {
  it('appends exactly one record for the year that closed and opens the next', () => {
    const closed = recordHarvest(farmIn(3, 1000), chf(250))

    expect(closed.ledger).toHaveLength(1)
    expect(closed.ledger[0]?.year).toBe(3)
    expect(closed.year).toBe(4)
    expect(closed.balance).toBe(chf(1250))
  })

  it('leaves the year and the ledger untouched for any number of credits and debits', () => {
    let farm = farmIn(3, 1000)
    farm = credit(farm, chf(120), 'a good week')
    const spent = debit(farm, chf(80), 'a sorting table')
    expect(spent.ok).toBe(true)
    if (!spent.ok) return
    farm = credit(spent.farm, chf(40), 'a windfall')

    expect(farm.year).toBe(3)
    expect(farm.ledger).toEqual([])
    expect(farm.balance).toBe(chf(1080))
  })

  it('opens the new year with none of the closed year’s movements', () => {
    const worked = credit(farmIn(3, 1000), chf(120), 'a good week')
    expect(worked.movements).toHaveLength(1)
    expect(recordHarvest(worked, chf(250)).movements).toEqual([])
  })

  it('offers nothing that advances the year but the two ways of recording a harvest', async () => {
    // A name-shaped guard over a behavioural rule: nothing may exist that moves the year
    // on its own. `closeYear` is the multi-card path and is allowed here only because the
    // test below proves it cannot advance a year without recording one.
    const economy = (await import('../src/economy/index.js')) as Record<string, unknown>
    const advancing = Object.keys(economy).filter((name) =>
      /(advance|next|close|end|tick|increment).*year|year.*(advance|next|close|end|tick|increment)/i.test(
        name,
      ),
    )
    expect(advancing).toEqual(['closeYear'])
  })

  it('cannot close a year without settling its total and appending its record', () => {
    const before = farmIn(3, 1000)
    const { farm } = closeYear(before, bringIn(openYear(before), {
      taskId: 'a-card',
      paidUnits: chf(250),
      evaluated: 4,
      counts: {},
    }))

    expect(farm.year).toBe(4)
    expect(farm.ledger).toHaveLength(1)
    expect(farm.ledger[0]?.year).toBe(3)
    expect(farm.ledger[0]?.harvest).toBe(chf(250))
    expect(farm.balance).toBe(chf(1250))
  })

  it('advances nothing while a year is in progress, however many cards come in', () => {
    const before = farmIn(3, 1000)
    let year = openYear(before)
    for (const taskId of ['a-card', 'another-card']) {
      year = bringIn(year, { taskId, paidUnits: chf(500), evaluated: 1, counts: {} })
    }

    expect(before.year).toBe(3)
    expect(before.ledger).toEqual([])
    expect(before.balance).toBe(chf(1000))
  })
})

describe('a ruinous harvest floors at zero', () => {
  it('comes to rest at zero and says what the floor absorbed', () => {
    const closed = recordHarvest(farmIn(1, 200), chf(-500))

    expect(closed.balance).toBe(0)
    expect(closed.ledger[0]?.harvest).toBe(chf(-500))
    expect(closed.ledger[0]?.absorbed).toBe(chf(300))
  })

  it('records what the floor absorbed separately from what the harvest paid', () => {
    const record = recordHarvest(farmIn(1, 200), chf(-500)).ledger[0]
    expect(record?.harvest).not.toBe(record?.absorbed)
    expect(record?.harvest).toBeLessThan(0)
    expect(record?.absorbed).toBeGreaterThan(0)
  })

  it('absorbs nothing when the balance covers the loss', () => {
    const closed = recordHarvest(farmIn(1, 900), chf(-500))
    expect(closed.balance).toBe(chf(400))
    expect(closed.ledger[0]?.absorbed).toBe(0)
  })
})

describe('the ledger is the history of closed years', () => {
  it('holds one record per closed year with ascending years', () => {
    let farm = farmIn(1, 500)
    for (const paid of [chf(100), chf(-50), chf(300)]) farm = recordHarvest(farm, paid)

    expect(farm.ledger.map((record) => record.year)).toEqual([1, 2, 3])
    expect(farm.year).toBe(4)
  })

  it('closes each year at the balance the farm holds after that harvest', () => {
    let farm = farmIn(1, 500)
    const closings: number[] = []
    for (const paid of [chf(100), chf(-50), chf(300)]) {
      farm = recordHarvest(farm, paid)
      closings.push(farm.balance)
    }

    expect(farm.ledger.map((record) => record.closingBalance)).toEqual(closings)
    expect(closings).toEqual([chf(600), chf(550), chf(850)])
  })

  it('holds no record for the year in progress', () => {
    const opened = farmIn(1, 500)
    expect(opened.ledger).toEqual([])

    const closed = recordHarvest(opened, chf(100))
    expect(closed.year).toBe(2)
    expect(closed.ledger.some((record) => record.year === 2)).toBe(false)
  })

  it('never changes a record once it is appended', () => {
    const first = recordHarvest(farmIn(1, 500), chf(100))
    const snapshot = { ...(first.ledger[0] as object) }
    const second = recordHarvest(first, chf(-900))

    expect(second.ledger[0]).toEqual(snapshot)
    expect(first.ledger).toHaveLength(1)
    expect(second.ledger).toHaveLength(2)
  })
})

describe('a bad year is a bad year, never a failure', () => {
  it('carries no bankrupt, lost or game-over state', () => {
    const ruined = recordHarvest(farmIn(1, 200), chf(-500))
    for (const key of Object.keys(ruined)) {
      expect(key, `"${key}" looks like a failure state`).not.toMatch(
        /bankrupt|lost|over|failed|defeat|ruin/i,
      )
    }
    expect(Object.values(ruined).some((value) => value === 'bankrupt')).toBe(false)
  })

  it('works the next year from a zero balance', () => {
    const ruined = recordHarvest(farmIn(1, 200), chf(-500))
    expect(ruined.balance).toBe(0)

    const recovered = recordHarvest(credit(ruined, chf(40), 'a picked apple'), chf(700))
    expect(recovered.year).toBe(3)
    expect(recovered.balance).toBe(chf(740))
    expect(recovered.ledger).toHaveLength(2)
  })

  it('bars nothing at a zero balance that a larger balance would allow', () => {
    const empty = farmIn(1, 0)
    expect(credit(empty, chf(10), 'a picked apple').balance).toBe(chf(10))
    expect(debit(empty, 0, 'something free').ok).toBe(true)
    expect(recordHarvest(empty, chf(-100)).balance).toBe(0)
  })

  it('refuses a harvest settlement that never crossed the unit boundary', () => {
    expect(() => recordHarvest(farmIn(1, 200), 40.5)).toThrow(/whole number/)
    expect(() => recordHarvest(farmIn(1, 200), Number.NaN)).toThrow(/whole number/)
  })
})

describe('the land the farm holds is state, not a constant', () => {
  it('opens at the declared opening land', () => {
    expect(openFarm(declaration).land).toBe(declaration.orchard.opening)
  })

  it('bears the crop that land bears, rather than a separately declared size', () => {
    expect(cropSize(openFarm(declaration))).toBe(
      declaration.orchard.opening * declaration.orchard.piecesPerUnit,
    )
  })

  it('opens at whatever the declaration says, so a bigger holding starts bigger', () => {
    const larger = openFarm({
      ...declaration,
      orchard: { ...declaration.orchard, opening: declaration.orchard.opening * 4 },
    })
    expect(cropSize(larger)).toBeGreaterThan(cropSize(openFarm(declaration)))
  })

  it('survives a harvest, because land does not shrink by its crop being brought in', () => {
    const grown = { ...openFarm(declaration), land: 400 }
    expect(recordHarvest(grown, toUnits(12, 2)).land).toBe(400)
  })
})
