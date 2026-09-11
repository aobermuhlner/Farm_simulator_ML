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
  testGroups,
  unpricedItem,
} from './helpers/catalog.js'
import { appleDeclaration } from './helpers/apple.js'
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

  it('sells the orchard and the tree, and everything unpriced says why', () => {
    // What is priced is what a model has been made for. `fitted-tree` ships a second
    // family and one tree per budget it sells, so the family and its budgets join the
    // orchard; the convolutional knobs stay unpriced because nothing has been trained
    // at those settings, which is the reason each of them gives.
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const priced = validated.catalog.items.filter((item) => item.priceUnits !== undefined)
    expect(priced.map((item) => item.id)).toEqual([
      'orchard-four-trees',
      'orchard-five-trees',
      'orchard-ten-trees',
      'orchard-thirty-trees',
      'orchard-fifty-trees',
      'orchard-hundred-trees',
      'robot-eye',
      'sorting-tree',
      'tree-four-questions',
      'tree-six-questions',
    ])
    for (const item of validated.catalog.items) {
      if (item.priceUnits !== undefined) continue
      expect(item.notForSaleReason ?? '', `${item.id} says nothing about why`).not.toBe('')
    }
  })

  it('offers the orchard as a ladder of rungs, each its own item at its own price', () => {
    // Six items rather than one repeatable one, because `progression-catalog` requires
    // that money be the only key to a purchase: a rung whose price rose with how often it
    // had been bought would need a new rule about ordering, where ascending prices order
    // the ladder by themselves. The totals read 1, 5, 10, 20, 50, 100, 200, 300, 400.
    // See `smallholding-economy/design.md`.
    const validated = validateCatalog(shippedCatalogJson(), shippedFarm())
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const rungs: readonly (readonly [string, number, number, number])[] = [
      ['orchard-four-trees', 1500, 4, 1],
      ['orchard-five-trees', 5500, 5, 1],
      ['orchard-ten-trees', 11000, 10, 1],
      ['orchard-thirty-trees', 22000, 30, 1],
      ['orchard-fifty-trees', 55000, 50, 1],
      ['orchard-hundred-trees', 110000, 100, 3],
    ]

    for (const [id, priceUnits, units, repeat] of rungs) {
      const item = validated.catalog.items.find((entry) => entry.id === id)
      expect(item, `${id} is not in the catalog`).toBeDefined()
      expect(item?.priceUnits, id).toBe(priceUnits)
      expect(item?.group, id).toBe('orchard')
      expect(repeatLimit(item!), id).toBe(repeat)
      expect(item?.opens, id).toEqual([{ kind: 'farm-land', units }])
    }
  })

  it('reaches four hundred units and two thousand pieces, and no further', () => {
    // The ladder terminates, so the land the orchard *could* reach stays a real figure on
    // screen. 2 000 apples at 0.87 perfect play is 1 740 — what `Game_design.md` §4.5
    // quoted for the orchard the game used to open on.
    const farm = shippedFarm()
    const validated = validateCatalog(shippedCatalogJson(), farm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const reach = maxLand(validated.catalog, farm)
    expect(reach).toBe(400)
    expect(reach * farm.orchard.piecesPerUnit).toBe(2000)
  })

  it('claims nothing about how well a model performs, in the orchard or its copy', () => {
    // §4.3 is the section most easily got backwards, and getting it backwards hands a
    // student a false claim: that more data breaks a model. A larger orchard makes a
    // mistake cost more money; it does not move a rate. So the copy for the thing that
    // grows the farm may not reach for the vocabulary of performance at all.
    const farm = shippedFarm()
    const validated = validateCatalog(shippedCatalogJson(), farm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const words = ['error', 'accuracy', 'accurate', 'risk', 'noise', 'variance', 'overfit']
    const rungs = validated.catalog.items.filter((entry) => entry.group === 'orchard')
    expect(rungs.length).toBeGreaterThan(0)
    for (const item of rungs) {
      const copy = `${item.label} ${item.copy} ${farm.orchard.label} ${farm.orchard.unit}`
      for (const word of words) {
        expect(copy.toLowerCase(), `${item.id}'s copy reaches for "${word}"`).not.toContain(word)
      }
    }
  })

  it('offers no model as free or already owned, in its price or in its copy', () => {
    // The eye was a gift and the tree cost six hundred, so the first thing the game said
    // about machine learning was that comprehensibility is the expensive option. Both are
    // now bought, and no copy may go on claiming otherwise — a shop line saying an item
    // came with the robot is the same false statement as an unpriced one.
    const validated = validateCatalog(shippedCatalogJson(), shippedFarm())
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const claims = [
      'came with the robot',
      'comes with the robot',
      'already own',
      'free',
      'nothing here to buy',
      'no charge',
      'costs you nothing',
    ]
    for (const item of validated.catalog.items) {
      if (!item.opens.some((unlock) => unlock.kind === 'model-family')) continue
      const copy = `${item.label} ${item.copy} ${item.notForSaleReason ?? ''}`.toLowerCase()
      for (const claim of claims) {
        expect(copy, `${item.id}'s copy claims "${claim}"`).not.toContain(claim)
      }
    }
  })

  it('gives away nothing priced, and every group it declares is real', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    // Every item owned at the start is an item, and none of them is for sale: a farm
    // that begins owning something priced would be a farm given money's worth for free.
    for (const id of validated.catalog.ownedAtStart) {
      const item = validated.catalog.items.find((candidate) => candidate.id === id)
      expect(item, id).toBeDefined()
      expect(item?.priceUnits, id).toBeUndefined()
    }
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

describe('a group says which counter its items stand at, and which part of the farm they are for', () => {
  /** The built groups, with one of them replaced wholesale. */
  function groupsWith(models: Record<string, unknown>): readonly Record<string, unknown>[] {
    return testGroups.map((group) => (group.id === 'models' ? models : group))
  }

  it('accepts a group that declares a counter and no task, which is the farm-wide reading', () => {
    const validated = validateCatalog(catalogWith([pricedItem()]), testFarm)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.catalog.groups[0]?.soldAt).toBe('market')
    expect(validated.catalog.groups[0]?.task).toBeUndefined()
  })

  it('accepts a group that names the part of the farm its items are for', () => {
    const validated = validateCatalog(
      catalogWith(
        [pricedItem()],
        groupsWith({ id: 'models', label: 'Models', task: 'apple-harvest', soldAt: 'market' }),
      ),
      testFarm,
    )
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.catalog.groups.find((group) => group.id === 'models')?.task).toBe(
      'apple-harvest',
    )
  })

  it('refuses a group that says nothing about its counter, naming the group', () => {
    const found = messages(
      catalogWith([pricedItem()], groupsWith({ id: 'models', label: 'Models' })),
    )
    expect(found).toContain('models')
    expect(found).toContain('soldAt')
    expect(refused(catalogWith([pricedItem()], groupsWith({ id: 'models', label: 'Models' }))).ok).toBe(
      false,
    )
  })

  it('refuses a counter this build does not have, naming that counter and the group', () => {
    const found = messages(
      catalogWith(
        [pricedItem()],
        groupsWith({ id: 'models', label: 'Models', soldAt: 'auction' }),
      ),
    )
    expect(found).toContain('models')
    expect(found).toContain('auction')
  })

  it('refuses a task id of the wrong shape, naming the group and the field', () => {
    const found = messages(
      catalogWith(
        [pricedItem()],
        groupsWith({ id: 'models', label: 'Models', soldAt: 'market', task: 7 }),
      ),
    )
    expect(found).toContain('models')
    expect(found).toContain('task')
  })
})

describe('only an upgrade to one model stands at the bench', () => {
  /** One item of the bench shelf, opening whatever the case is about. */
  function benched(opens: readonly Record<string, unknown>[]): Record<string, unknown> {
    return pricedItem({ id: 'benched', group: 'capacity', opens })
  }

  it('accepts an item opening values of one knob', () => {
    const validated = validateCatalog(
      catalogWith([
        benched([{ kind: 'knob-values', task: 'apple-harvest', knob: 'channels', values: [8] }]),
      ]),
      testFarm,
    )
    expect(validated.ok, messages(catalogWith([benched([
      { kind: 'knob-values', task: 'apple-harvest', knob: 'channels', values: [8] },
    ])]))).toBe(true)
  })

  it('refuses one that grows the farm, naming the item and what it opens', () => {
    const found = messages(catalogWith([benched([{ kind: 'farm-land', units: 10 }])]))
    expect(found).toContain('benched')
    expect(found).toContain('farm-land')
  })

  it('refuses one that opens a whole family, naming the item and what it opens', () => {
    const found = messages(
      catalogWith([
        benched([{ kind: 'model-family', task: 'apple-harvest', family: 'decision-tree' }]),
      ]),
    )
    expect(found).toContain('benched')
    expect(found).toContain('model-family')
  })
})

describe('the shipped models shelf shows the ladder, built rungs and unbuilt', () => {
  /**
   * The family ids the shelf names but no task declares, pinned.
   *
   * An unpriced item may name a family that does not exist yet — that latitude is what
   * lets the shelf show the whole ladder from the first day. The cost is that a mistyped
   * id is not caught at load, so it is caught here: a rename that should have updated
   * the shelf fails loudly rather than leaving an entry that quietly never unlocks.
   */
  const UNBUILT_FAMILIES = ['linear-regression', 'dense-network'] as const

  /** Every family id the shipped catalog opens, priced or not, in declared order. */
  function shelvedFamilies(): readonly string[] {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')
    return validated.catalog.items.flatMap((item) =>
      item.opens.flatMap((unlock) => (unlock.kind === 'model-family' ? [unlock.family] : [])),
    )
  }

  it('names exactly the families the shipped task declares, plus the pinned unbuilt ones', () => {
    const declared = appleDeclaration().families.map((family) => family.id)
    const shelved = shelvedFamilies()

    expect(shelved.filter((id) => !declared.includes(id))).toEqual([...UNBUILT_FAMILIES])
    for (const id of declared) expect(shelved, id).toContain(id)
  })

  it('leaves every unbuilt rung unpriced, with the declared reason it cannot be bought', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    for (const item of validated.catalog.items) {
      const unbuilt = item.opens.some(
        (unlock) =>
          unlock.kind === 'model-family' &&
          UNBUILT_FAMILIES.includes(unlock.family as (typeof UNBUILT_FAMILIES)[number]),
      )
      if (!unbuilt) continue
      expect(item.priceUnits, item.id).toBeUndefined()
      expect(item.notForSaleReason, item.id).toBeTruthy()
    }
  })

  it('gives the farm nothing to open with, and sells nothing at two counters', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')
    const { catalog } = validated

    // Every capability on this farm is bought with apples the student sorted. A model
    // handed over before the first one was sorted said, of the two on the shelf, that the
    // unreadable one is the free option — which is the opposite of the lesson.
    expect(catalog.ownedAtStart).toEqual([])

    // Every item sits in exactly one group, so its counter is one fact with one place
    // to read it — which is what makes "no item is offered at both" structural.
    const counterOf = (id: string): string | undefined =>
      catalog.groups.find((group) => group.id === catalog.items.find((item) => item.id === id)?.group)
        ?.soldAt

    for (const item of catalog.items) expect(counterOf(item.id), item.id).toBeDefined()
  })

  it('sells the capacity items at the bench and nowhere else', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')
    const { catalog } = validated

    const bench = new Set(
      catalog.groups.filter((group) => group.soldAt === 'bench').map((group) => group.id),
    )
    const benched = catalog.items.filter((item) => bench.has(item.group)).map((item) => item.id)

    expect(benched).toEqual([
      'deeper-stacks',
      'stronger-regularization',
      'dropout-layers',
      'tree-four-questions',
      'tree-six-questions',
    ])
  })

  it('gives every market shelf of a part of the farm a task the build declares', () => {
    const validated = validateCatalog(shippedCatalogJson(), testFarm)
    if (!validated.ok) throw new Error('the shipped catalog must validate')

    const named = validated.catalog.groups.flatMap((group) =>
      group.task === undefined ? [] : [group.task],
    )
    expect(named).toEqual(['apple-harvest', 'apple-harvest'])
  })
})
