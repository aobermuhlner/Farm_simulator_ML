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
import { INSUFFICIENT_FUNDS, openFarm } from '../src/economy/index.js'
import {
  ALREADY_OWNED,
  buyItem,
  NOT_FOR_SALE,
  UNKNOWN_ITEM,
  type Catalog,
} from '../src/progression/index.js'
import { catalogWith, pricedItem, soundCatalog, testFarm, unpricedItem } from './helpers/catalog.js'

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
