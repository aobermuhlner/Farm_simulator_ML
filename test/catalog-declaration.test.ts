/**
 * The catalog declaration: the shipped file, and the validator that refuses a broken one.
 *
 * A catalog that will not validate stops the farm opening, so there is no partial version
 * of it to test — every refusal below asserts that no items come back at all.
 */

import { describe, expect, it } from 'vitest'
import { validateCatalog } from '../src/progression/index.js'
import { DATA_MOUNTS, SHIPPED_CATALOG, sourcePathFor } from '../web/src/data/paths.js'
import { catalogWith, pricedItem, shippedCatalogJson, testFarm, unpricedItem } from './helpers/catalog.js'

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

  it('offers three things, none of them for sale, each saying why', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    expect(validated.catalog.items).toHaveLength(3)
    for (const item of validated.catalog.items) {
      expect(item.priceUnits, `${item.id} is priced`).toBeUndefined()
      expect(item.notForSaleReason ?? '', `${item.id} says nothing about why`).not.toBe('')
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
