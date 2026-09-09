/**
 * The catalog declaration: the shipped file, and the validator that refuses a broken one.
 *
 * A catalog that will not validate stops the farm opening, so there is no partial version
 * of it to test — every refusal below asserts that no items come back at all.
 */

import { describe, expect, it } from 'vitest'
import { maxLand, repeatLimit, validateCatalog } from '../src/progression/index.js'
import { DATA_MOUNTS, SHIPPED_CATALOG, sourcePathFor } from '../web/src/data/paths.js'
import {
  catalogWith,
  landItem,
  pricedItem,
  shippedCatalogJson,
  testFarm,
  unpricedItem,
} from './helpers/catalog.js'
import { shippedFarm } from './helpers/farm.js'

function messages(input: unknown): string {
  const validated = validateCatalog(input, testFarm)
  return validated.ok ? '' : validated.issues.map((issue) => issue.message).join(' ')
}

function refused(input: unknown) {
  const validated = validateCatalog(input, testFarm)
  expect(validated.ok, 'the catalog was meant to be refused').toBe(false)
  return validated
}

describe('the shipped catalog', () => {
  it('is served by the declarations mount already in the table', () => {
    expect(sourcePathFor(SHIPPED_CATALOG)).toBe('declarations/catalog.json')
    expect(Object.keys(DATA_MOUNTS)).toEqual(['data/declarations', 'data/pools', 'data/artifacts'])
  })

  it('parses and validates against the shipped farm', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    expect(validated.ok, validated.ok ? '' : messages(shippedCatalogJson())).toBe(true)
  })

  it('validates against the farm that is actually shipped, not only a test one', () => {
    const validated = validateCatalog(shippedCatalogJson(), shippedFarm())
    expect(validated.ok, validated.ok ? '' : messages(shippedCatalogJson())).toBe(true)
  })

  it('sells the orchard and nothing else, and everything unpriced says why', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const priced = validated.catalog.items.filter((item) => item.priceUnits !== undefined)
    expect(priced.map((item) => item.id)).toEqual(['orchard-expansion'])
    for (const item of validated.catalog.items) {
      if (item.priceUnits !== undefined) continue
      expect(item.notForSaleReason ?? '', `${item.id} says nothing about why`).not.toBe('')
    }
  })

  it('prices the expansion at a thousand, five times over, a hundred units each', () => {
    // 1 000 rather than §4.5's 1 200: at 6 000 apples the weakest shipped configuration
    // earns 1 207 in the wettest declared year, so 1 200 pays an expansion back with
    // 7 CHF to spare — a margin the first retune of a payoff would spend. See design.md,
    // decision 4; the payback multiple itself is asserted in delivery-guards.
    const validated = validateCatalog(shippedCatalogJson(), shippedFarm())
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const item = validated.catalog.items.find((entry) => entry.id === 'orchard-expansion')
    expect(item?.priceUnits).toBe(100000)
    expect(item?.group).toBe('orchard')
    expect(repeatLimit(item!)).toBe(5)
    expect(item?.opens).toEqual([{ kind: 'farm-land', units: 100 }])
  })

  it('reaches six hundred units and thirty-six thousand pieces, and no further', () => {
    const farm = shippedFarm()
    const validated = validateCatalog(shippedCatalogJson(), farm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const reach = maxLand(validated.catalog, farm)
    expect(reach).toBe(600)
    expect(reach * farm.orchard.piecesPerUnit).toBe(36000)
  })

  it('claims nothing about how well a model performs, in the orchard or its copy', () => {
    // §4.3 is the section most easily got backwards, and getting it backwards hands a
    // student a false claim: that more data breaks a model. A larger orchard makes a
    // mistake cost more money; it does not move a rate. So the copy for the thing that
    // grows the farm may not reach for the vocabulary of performance at all.
    const farm = shippedFarm()
    const validated = validateCatalog(shippedCatalogJson(), farm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const item = validated.catalog.items.find((entry) => entry.id === 'orchard-expansion')
    const words = ['error', 'accuracy', 'accurate', 'risk', 'noise', 'variance', 'overfit']
    const copy = `${item?.label ?? ''} ${item?.copy ?? ''} ${farm.orchard.label} ${farm.orchard.unit}`
    for (const word of words) {
      expect(copy.toLowerCase(), `the orchard's copy reaches for "${word}"`).not.toContain(word)
    }
  })

  it('owns nothing at the start, and every group it declares is real', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    expect(validated.catalog.ownedAtStart).toEqual([])
    const groups = validated.catalog.groups.map((group) => group.id)
    for (const item of validated.catalog.items) expect(groups).toContain(item.group)
  })
})

describe('a catalog that cannot be trusted is refused whole', () => {
  it('refuses something that is not an object', () => {
    expect(messages([])).toContain('must be an object')
    expect(messages('catalog')).toContain('must be an object')
  })

  it('names every top-level field it is missing', () => {
    for (const field of ['schemaVersion', 'groups', 'ownedAtStart', 'items']) {
      const base = catalogWith([pricedItem()])
      delete base[field]
      expect(messages(base), `${field} was not named`).toContain(`"${field}"`)
    }
  })

  it('names the item and the field an item omits', () => {
    const item = pricedItem()
    delete item.label
    const validated = refused(catalogWith([item]))
    if (validated.ok) return

    expect(validated.issues.some((issue) => issue.message.includes('"label"'))).toBe(true)
    expect(validated.issues.some((issue) => (issue.field ?? '').includes('wider-blocks'))).toBe(true)
  })

  it('names a repeated item id', () => {
    expect(messages(catalogWith([pricedItem(), pricedItem({ label: 'Again' })]))).toContain(
      'declared twice',
    )
  })

  it('names an item placed in a group the catalog does not declare', () => {
    const validated = refused(catalogWith([pricedItem({ group: 'labour' })]))
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('unknown-group')
    expect(validated.issues[0]?.message).toContain('labour')
  })

  it('names an id in the opening ownership that no item declares', () => {
    const base = catalogWith([pricedItem()])
    base.ownedAtStart = ['picking-robot']
    const validated = refused(base)
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('unknown-item')
    expect(validated.issues[0]?.message).toContain('picking-robot')
  })

  it('refuses an item that opens nothing', () => {
    expect(messages(catalogWith([pricedItem({ opens: [] })]))).toContain('opens')
  })

  it('refuses an unpriced item that does not say why it cannot be bought', () => {
    const item = unpricedItem()
    delete item.notForSaleReason
    expect(messages(catalogWith([item]))).toContain('notForSaleReason')
  })

  it('yields no items at all rather than the ones that were sound', () => {
    const validated = refused(catalogWith([pricedItem(), pricedItem({ id: 'broken', group: 'nowhere' })]))
    expect(validated.ok).toBe(false)
    expect('catalog' in validated).toBe(false)
  })
})

describe('a price is an amount the declared currency can hold', () => {
  it('refuses a negative price, naming the item', () => {
    const validated = refused(catalogWith([pricedItem({ price: -1 })]))
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('malformed-price')
    expect(validated.issues[0]?.field).toBe('wider-blocks')
  })

  it('refuses a price that is not a number, naming the item', () => {
    const validated = refused(catalogWith([pricedItem({ price: '100' })]))
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('malformed-price')
    expect(validated.issues[0]?.field).toBe('wider-blocks')
  })

  it('refuses a price finer than the declared precision, naming the item', () => {
    const validated = refused(catalogWith([pricedItem({ price: 10.005 })]))
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('unrepresentable-amount')
    expect(validated.issues[0]?.field).toBe('wider-blocks')
  })

  it('accepts a price of zero, and holds it in whole units of the declared precision', () => {
    const validated = validateCatalog(catalogWith([pricedItem({ price: 0 })]), testFarm)
    if (!validated.ok) throw new Error(messages(catalogWith([pricedItem({ price: 0 })])))
    expect(validated.catalog.items[0]?.priceUnits).toBe(0)
  })

  it('crosses into whole units once, through the currency the farm declares', () => {
    const validated = validateCatalog(catalogWith([pricedItem({ price: 12.34 })]), testFarm)
    if (!validated.ok) throw new Error('the catalog was meant to validate')
    expect(validated.catalog.items[0]?.priceUnits).toBe(1234)

    const coarse = validateCatalog(catalogWith([pricedItem({ price: 12 })]), {
      ...testFarm,
      precision: 0,
    })
    if (!coarse.ok) throw new Error('the coarse catalog was meant to validate')
    expect(coarse.catalog.items[0]?.priceUnits).toBe(12)
  })
})

describe('a declared repeat limit', () => {
  it('is absent from every item that has ever been declared, meaning once', () => {
    const validated = validateCatalog(catalogWith([pricedItem()]), testFarm)
    if (!validated.ok) throw new Error('the catalog was meant to validate')
    expect(validated.catalog.items[0]?.repeat).toBeUndefined()
    expect(repeatLimit(validated.catalog.items[0]!)).toBe(1)
  })

  it('is kept when it is a whole count of one or more', () => {
    for (const repeat of [1, 3, 5]) {
      const validated = validateCatalog(catalogWith([pricedItem({ repeat })]), testFarm)
      if (!validated.ok) throw new Error(messages(catalogWith([pricedItem({ repeat })])))
      expect(repeatLimit(validated.catalog.items[0]!)).toBe(repeat)
    }
  })

  it('refuses zero, a fraction or a negative, naming the item and the field', () => {
    for (const repeat of [0, -1, 2.5, '3']) {
      const validated = refused(catalogWith([pricedItem({ repeat })]))
      if (validated.ok) continue
      expect(validated.issues[0]?.field, JSON.stringify(repeat)).toBe('wider-blocks.repeat')
      expect(validated.issues[0]?.message).toContain('wider-blocks')
      expect(validated.issues[0]?.code).toBe('malformed-field')
    }
  })
})

describe('an item that grows the farm', () => {
  it('opens a whole amount of land, and that is the whole of what it names', () => {
    const validated = validateCatalog(catalogWith([landItem()]), testFarm)
    if (!validated.ok) throw new Error(messages(catalogWith([landItem()])))
    expect(validated.catalog.items[0]?.opens).toEqual([{ kind: 'farm-land', units: 10 }])
  })

  it('refuses growth of zero, a fraction or no amount at all, naming the field', () => {
    for (const units of [0, -5, 2.5, undefined, '10']) {
      const opens = [units === undefined ? { kind: 'farm-land' } : { kind: 'farm-land', units }]
      const validated = refused(catalogWith([landItem({ opens })]))
      if (validated.ok) continue
      expect(validated.issues[0]?.field, JSON.stringify(units)).toBe('starter-plot.opens[0].units')
      expect(validated.issues[0]?.message).toContain('starter-plot')
    }
  })

  it('is still refused when it names a kind this build does not recognise', () => {
    const validated = refused(
      catalogWith([landItem({ opens: [{ kind: 'farm-weather', units: 10 }] })]),
    )
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('unknown-unlock-kind')
    expect(validated.issues[0]?.message).toContain('farm-weather')
  })

  it('satisfies "an item opens at least one thing", naming no knob', () => {
    // Growth is a thing opened, so an item that only grows the farm is not an item that
    // opens nothing — and it reaches no knob, so the default and coverage rules that are
    // about knob values have nothing of it to check.
    const validated = validateCatalog(catalogWith([landItem()]), testFarm)
    expect(validated.ok).toBe(true)
    const empty = refused(catalogWith([landItem({ opens: [] })]))
    if (empty.ok) return
    expect(empty.issues[0]?.code).toBe('opens-nothing')
  })

  it('counts towards the largest orchard reachable, once per permitted purchase', () => {
    const validated = validateCatalog(catalogWith([landItem({ repeat: 4 })]), testFarm)
    if (!validated.ok) throw new Error('the catalog was meant to validate')
    expect(maxLand(validated.catalog, testFarm)).toBe(testFarm.orchard.opening + 40)
  })

  it('is excluded from that figure when nothing can buy it', () => {
    const unbuyable = landItem({ price: undefined, notForSaleReason: 'No plots are for sale.' })
    delete unbuyable.price
    const validated = validateCatalog(catalogWith([unbuyable]), testFarm)
    if (!validated.ok) throw new Error(messages(catalogWith([unbuyable])))
    expect(maxLand(validated.catalog, testFarm)).toBe(testFarm.orchard.opening)
  })
})
