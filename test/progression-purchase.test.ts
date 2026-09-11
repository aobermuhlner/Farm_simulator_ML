/**
 * Buying: money moves once, the item is owned, and there is no way back.
 *
 * The shipped catalog has nothing for sale, so this path ships exercised only from here.
 * That is a named risk in `design.md`, and these tests are what stands in for playing it:
 * every refusal, the debit underneath, and the absence of a sell.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Farm } from '../src/economy/index.js'
import {
  credit,
  cropSize,
  INSUFFICIENT_FUNDS,
  openFarm,
  recordHarvest,
} from '../src/economy/index.js'
import {
  ALREADY_OWNED,
  buyItem,
  countOwned,
  marketView,
  maxLand,
  NOT_FOR_SALE,
  UNKNOWN_ITEM,
  type Catalog,
} from '../src/progression/index.js'
import {
  catalogWith,
  landItem,
  pricedItem,
  soundCatalog,
  testFarm,
  unpricedItem,
} from './helpers/catalog.js'

const catalog: Catalog = soundCatalog(catalogWith([pricedItem(), unpricedItem()]))

/** A farm holding `amount` in the declared currency. */
function holding(amount: number): Farm {
  return openFarm({ ...testFarm, openingBalance: amount })
}

describe('a confirmed purchase moves money once', () => {
  it('falls by exactly the price and records one movement naming the item', () => {
    const bought = buyItem(catalog, holding(500), [], 'wider-blocks')
    expect(bought.ok, bought.ok ? '' : bought.issues.map((issue) => issue.message).join(' ')).toBe(true)
    if (!bought.ok) return

    expect(bought.farm.balance).toBe(40000)
    expect(bought.farm.movements).toEqual([{ units: -10000, reason: 'wider-blocks' }])
    expect(bought.owned).toEqual(['wider-blocks'])
  })

  it('returns new values rather than mutating the ones it was given', () => {
    const farm = holding(500)
    const owned: readonly string[] = []
    const bought = buyItem(catalog, farm, owned, 'wider-blocks')
    if (!bought.ok) throw new Error('the purchase was meant to go through')

    expect(farm.balance).toBe(50000)
    expect(farm.movements).toEqual([])
    expect(owned).toEqual([])
    expect(bought.owned).not.toBe(owned)
    expect(bought.farm).not.toBe(farm)
  })

  it('appends to what is already owned rather than replacing it', () => {
    const bought = buyItem(catalog, holding(500), ['picking-robot'], 'wider-blocks')
    if (!bought.ok) throw new Error('the purchase was meant to go through')
    expect(bought.owned).toEqual(['picking-robot', 'wider-blocks'])
  })
})

describe('a purchase that cannot happen moves no money', () => {
  it('refuses an item that is already owned, naming it', () => {
    const farm = holding(500)
    const refused = buyItem(catalog, farm, ['wider-blocks'], 'wider-blocks')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(ALREADY_OWNED)
    expect(refused.issues[0]?.field).toBe('wider-blocks')
    expect(farm.balance).toBe(50000)
    expect(farm.movements).toEqual([])
  })

  it('refuses an item with no price, naming it and saying why', () => {
    const refused = buyItem(catalog, holding(500), [], 'deeper-blocks')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(NOT_FOR_SALE)
    expect(refused.issues[0]?.field).toBe('deeper-blocks')
    expect(refused.issues[0]?.message).toContain('Nothing has been trained for it yet')
  })

  it('refuses an id the catalog does not declare, naming it', () => {
    const refused = buyItem(catalog, holding(500), [], 'heirloom-block')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(UNKNOWN_ITEM)
    expect(refused.issues[0]?.field).toBe('heirloom-block')
  })

  it('leaves the owned set untouched on every refusal', () => {
    const owned = ['wider-blocks']
    for (const id of ['wider-blocks', 'deeper-blocks', 'heirloom-block']) {
      const refused = buyItem(catalog, holding(500), owned, id)
      expect(refused.ok, `${id} was bought`).toBe(false)
    }
    expect(owned).toEqual(['wider-blocks'])
  })
})

describe('a purchase beyond the balance is refused with the shortfall', () => {
  it('passes the economy’s own refusal through, shortfall and all', () => {
    const farm = holding(20)
    const refused = buyItem(catalog, farm, [], 'wider-blocks')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(INSUFFICIENT_FUNDS)
    expect(refused.issues[0]?.message).toContain('80.00')
    expect(farm.balance).toBe(2000)
    expect(farm.movements).toEqual([])
  })

  it('does not own what it could not pay for', () => {
    const refused = buyItem(catalog, holding(20), [], 'wider-blocks')
    expect(refused.ok).toBe(false)
    expect('owned' in refused).toBe(false)
  })
})

describe('money is the only key', () => {
  it('buys an item with nothing else owned exactly as it buys it with everything owned', () => {
    const alone = buyItem(catalog, holding(500), [], 'wider-blocks')
    const after = buyItem(catalog, holding(500), ['deeper-blocks'], 'wider-blocks')

    expect(alone.ok).toBe(true)
    expect(after.ok).toBe(true)
    if (!alone.ok || !after.ok) return
    expect(after.farm.balance).toBe(alone.farm.balance)
  })

  it('takes the catalog, the farm, what is owned and the id — no prerequisite among them', () => {
    expect(buyItem.length).toBe(4)
  })

  it('makes no other item purchasable except by the balance covering its price', () => {
    // Buying leaves the balance lower, so nothing can become purchasable through it. The
    // only thing that changes is the money.
    const bought = buyItem(catalog, holding(500), [], 'wider-blocks')
    if (!bought.ok) throw new Error('the purchase was meant to go through')

    const stillRefused = buyItem(catalog, bought.farm, bought.owned, 'deeper-blocks')
    expect(stillRefused.ok).toBe(false)
    if (stillRefused.ok) return
    expect(stillRefused.issues[0]?.code).toBe(NOT_FOR_SALE)
  })
})

describe('there is no way back', () => {
  it('exposes no sell, refund or un-own operation', async () => {
    const module = (await import('../src/progression/index.js')) as Record<string, unknown>
    const exported = Object.keys(module).map((name) => name.toLowerCase())

    for (const forbidden of ['sell', 'refund', 'return', 'unown', 'disown']) {
      expect(exported.filter((name) => name.includes(forbidden)), forbidden).toEqual([])
    }
  })

  it('never removes an id from the owned set anywhere in the module', () => {
    const text = readFileSync('src/progression/purchase.ts', 'utf8')
    expect(/\.filter\(/.test(text), 'purchase.ts filters the owned list').toBe(false)
    expect(/\bsplice\b|\bpop\b|\bshift\b/.test(text)).toBe(false)
  })
})

describe('an item the catalog permits to be bought more than once', () => {
  const repeatable: Catalog = soundCatalog(catalogWith([landItem(), unpricedItem()]))

  /** Buys `starter-plot` `times` over from a farm holding `amount`, or throws. */
  function buyTimes(times: number, amount = 5000): { farm: Farm; owned: readonly string[] } {
    let farm = holding(amount)
    let owned: readonly string[] = []
    for (let round = 0; round < times; round += 1) {
      const bought = buyItem(repeatable, farm, owned, 'starter-plot')
      if (!bought.ok) throw new Error(`purchase ${round + 1} was refused: ${bought.issues[0]?.message}`)
      farm = bought.farm
      owned = bought.owned
    }
    return { farm, owned }
  }

  it('debits its price once per purchase and records a movement for each', () => {
    const { farm, owned } = buyTimes(2)

    expect(farm.balance).toBe(500000 - 2 * 20000)
    expect(farm.movements).toEqual([
      { units: -20000, reason: 'starter-plot' },
      { units: -20000, reason: 'starter-plot' },
    ])
    expect(owned).toEqual(['starter-plot', 'starter-plot'])
    expect(countOwned(owned, 'starter-plot')).toBe(2)
  })

  it('is refused one past the declared limit, with the limit named and no money moved', () => {
    const { farm, owned } = buyTimes(5)
    const refused = buyItem(repeatable, farm, owned, 'starter-plot')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(ALREADY_OWNED)
    expect(refused.issues[0]?.field).toBe('starter-plot')
    expect(refused.issues[0]?.message).toContain('5')
    expect(farm.balance).toBe(500000 - 5 * 20000)
    expect(farm.movements).toHaveLength(5)
  })

  it('is still refused on a second purchase when it declares no limit at all', () => {
    const farm = holding(500)
    const refused = buyItem(catalog, farm, ['wider-blocks'], 'wider-blocks')

    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0]?.code).toBe(ALREADY_OWNED)
    expect(farm.balance).toBe(50000)
    expect(farm.movements).toEqual([])
  })

  it('is reported as bought so far against what the catalog still permits', () => {
    const { farm, owned } = buyTimes(2)
    const entry = marketView(repeatable, [], testFarm, owned, farm.balance).sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items)
      .find((item) => item.item.id === 'starter-plot')

    expect(entry?.held).toBe(2)
    expect(entry?.limit).toBe(5)
    expect(entry?.remaining).toBe(3)
    expect(entry?.state).toBe('buyable')
  })

  it('is owned rather than saving at its limit, so no money is implied to obtain more', () => {
    const { farm, owned } = buyTimes(5)
    const entry = marketView(repeatable, [], testFarm, owned, farm.balance).sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items)
      .find((item) => item.item.id === 'starter-plot')

    expect(entry?.held).toBe(5)
    expect(entry?.remaining).toBe(0)
    expect(entry?.state).toBe('owned')
  })

  it('is saving for while the balance does not cover it, limit remaining or not', () => {
    const entry = marketView(repeatable, [], testFarm, [], 100).sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items)
      .find((item) => item.item.id === 'starter-plot')

    expect(entry?.state).toBe('saving')
    expect(entry?.remaining).toBe(5)
  })
})

describe('an item that grows the farm grows it on every purchase', () => {
  const repeatable: Catalog = soundCatalog(catalogWith([landItem(), unpricedItem()]))

  it('raises the land held by the amount declared, and the crop with it', () => {
    const opened = holding(5000)
    const bought = buyItem(repeatable, opened, [], 'starter-plot')
    expect(bought.ok).toBe(true)
    if (!bought.ok) return

    expect(bought.farm.land).toBe(opened.land + 10)
    expect(cropSize(bought.farm)).toBe(cropSize(opened) + 10 * testFarm.orchard.piecesPerUnit)
  })

  it('raises them again when it is bought again', () => {
    const opened = holding(5000)
    const first = buyItem(repeatable, opened, [], 'starter-plot')
    if (!first.ok) throw new Error('the first purchase was meant to go through')
    const second = buyItem(repeatable, first.farm, first.owned, 'starter-plot')
    if (!second.ok) throw new Error('the second purchase was meant to go through')

    expect(second.farm.land).toBe(opened.land + 20)
    expect(cropSize(second.farm)).toBe(cropSize(opened) + 20 * testFarm.orchard.piecesPerUnit)
  })

  it('moves no land when the purchase is refused', () => {
    const opened = holding(1)
    const refused = buyItem(repeatable, opened, [], 'starter-plot')
    expect(refused.ok).toBe(false)
    expect(opened.land).toBe(testFarm.orchard.opening)
  })

  it('leaves an item that opens no land carrying the land it already held', () => {
    const bought = buyItem(catalog, holding(500), [], 'wider-blocks')
    if (!bought.ok) throw new Error('the purchase was meant to go through')
    expect(bought.farm.land).toBe(testFarm.orchard.opening)
  })

  it('never reaches past the largest orchard the catalog could sell towards', () => {
    let farm = holding(5000)
    let owned: readonly string[] = []
    for (let round = 0; round < 5; round += 1) {
      const bought = buyItem(repeatable, farm, owned, 'starter-plot')
      if (!bought.ok) throw new Error(`purchase ${round + 1} was refused`)
      farm = bought.farm
      owned = bought.owned
      // The figure is a property of the catalog and the declaration, so buying towards
      // it does not move it — a bar that shrank as it filled would be a different claim.
      expect(maxLand(repeatable, testFarm)).toBe(testFarm.orchard.opening + 50)
    }
    expect(farm.land).toBe(maxLand(repeatable, testFarm))
  })

  it('is not gated on owning anything else', () => {
    const alone = buyItem(repeatable, holding(5000), [], 'starter-plot')
    expect(alone.ok, alone.ok ? '' : alone.issues[0]?.message).toBe(true)
    if (!alone.ok) return
    expect(alone.farm.land).toBe(testFarm.orchard.opening + 10)
  })
})

describe('nothing but a purchase moves the land', () => {
  it('is the declared opening for a farm that has bought nothing', () => {
    expect(holding(50000).land).toBe(testFarm.orchard.opening)
  })

  it('survives years, harvests and a large balance, none of which move it', () => {
    const repeatable: Catalog = soundCatalog(catalogWith([landItem(), unpricedItem()]))
    const bought = buyItem(repeatable, holding(5000), [], 'starter-plot')
    if (!bought.ok) throw new Error('the purchase was meant to go through')

    let farm = bought.farm
    for (let year = 0; year < 4; year += 1) farm = recordHarvest(credit(farm, 100000, 'sales'), 5000)

    expect(farm.year).toBe(testFarm.openingYear + 4)
    expect(farm.balance).toBeGreaterThan(bought.farm.balance)
    expect(farm.land).toBe(bought.farm.land)
  })
})
