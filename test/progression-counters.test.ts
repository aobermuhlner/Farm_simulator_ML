/**
 * Two counters over one catalog: the market, and the workshop's upgrade bench.
 *
 * The market sections by the part of the farm a group belongs to, the bench lays a
 * task's families out with the upgrades sold for their knobs, and both are built from
 * one `viewOf` — so the four states cannot read differently at one counter than at the
 * other, and neither can grow a purchase path of its own.
 *
 * See openspec/changes/market/specs/progression-catalog/spec.md and
 * openspec/changes/market/specs/model-upgrades/spec.md.
 */

import { describe, expect, it } from 'vitest'
import { openFarm } from '../src/economy/index.js'
import type { Catalog } from '../src/progression/index.js'
import { benchView, buyItem, marketView } from '../src/progression/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple.js'
import { catalogWith, soundCatalog, testFarm } from './helpers/catalog.js'
import { twoFamilyTask } from './helpers/families.js'

const apple = appleDeclaration()
const other = twoFamilyTask()
const tasks: readonly TaskDeclaration[] = [apple, other]

/** The convolutional family and the tree, in the order the shipped task declares them. */
const [network, tree] = apple.families

/** Shelves for both parts of the farm, one farm-wide shelf, and one at the bench. */
const groups: readonly Record<string, unknown>[] = [
  { id: 'orchard', label: 'Orchard', task: apple.id, soldAt: 'market' },
  { id: 'data', label: 'Data', task: apple.id, soldAt: 'market' },
  { id: 'pens', label: 'Pens', task: other.id, soldAt: 'market' },
  { id: 'bare', label: 'Bare shelf', task: apple.id, soldAt: 'market' },
  { id: 'yard', label: 'Yard', soldAt: 'market' },
  { id: 'capacity', label: 'Capacity', soldAt: 'bench' },
]

/** One item, complete but for whatever the case overrides. */
function item(overrides: Record<string, unknown>): Record<string, unknown> {
  const built: Record<string, unknown> = {
    id: 'a-thing',
    group: 'yard',
    label: 'A thing',
    copy: 'Something to have.',
    price: 10,
    opens: [{ kind: 'farm-land', units: 5 }],
    ...overrides,
  }
  // An explicit `price: undefined` is how a case says "unpriced"; the field has to go
  // rather than sit there holding undefined, or the validator reads it as a price.
  if (built.price === undefined) delete built.price
  return built
}

/** Values of one of the shipped task's knobs, as a bench item opens them. */
function opensKnob(knob: string, values: readonly (string | number)[]): Record<string, unknown> {
  return { kind: 'knob-values', task: apple.id, knob, values }
}

const catalog: Catalog = soundCatalog(
  catalogWith(
    [
      item({ id: 'more-trees', group: 'orchard', label: 'More trees' }),
      item({
        id: 'more-photos',
        group: 'data',
        label: 'More photos',
        opens: [opensKnob('dataset', ['bulk'])],
      }),
      item({ id: 'a-pen', group: 'pens', label: 'A pen' }),
      item({ id: 'a-shed', group: 'yard', label: 'A shed' }),
      item({
        id: 'the-tree',
        group: 'yard',
        label: 'A sorting tree',
        price: 600,
        opens: [{ kind: 'model-family', task: apple.id, family: tree!.id }],
      }),
      item({
        id: 'wider-blocks',
        group: 'capacity',
        label: 'Wider blocks',
        price: undefined,
        notForSaleReason: 'Nothing has been trained at those settings yet.',
        opens: [opensKnob('channels', [8, 32])],
      }),
      item({
        id: 'more-questions',
        group: 'capacity',
        label: 'Two more questions',
        price: 400,
        opens: [opensKnob('nodes', [4])],
      }),
    ],
    groups,
  ),
)

describe('the market is sectioned by the part of the farm a shelf belongs to', () => {
  const view = marketView(catalog, tasks, testFarm, [], 100000)

  it('heads each section with the task’s own declared title, the farm last', () => {
    expect(view.sections.map((section) => section.title)).toEqual([
      apple.title,
      other.title,
      testFarm.name,
    ])
    expect(view.sections.map((section) => section.taskId)).toEqual([apple.id, other.id, undefined])
  })

  it('orders sections by where their first group is declared, and groups within them', () => {
    const [first] = view.sections
    expect(first?.groups.map((group) => group.group.label)).toEqual(['Orchard', 'Data'])
  })

  it('drops a shelf with nothing on it rather than showing an empty heading', () => {
    const labels = view.sections.flatMap((section) =>
      section.groups.map((group) => group.group.id),
    )
    expect(labels).not.toContain('bare')
  })

  it('drops a section all of whose shelves are empty', () => {
    const empty = soundCatalog(catalogWith([item({ id: 'a-shed', group: 'yard' })], groups))
    const sections = marketView(empty, tasks, testFarm, [], 100000).sections

    expect(sections.map((section) => section.title)).toEqual([testFarm.name])
  })

  it('shows nothing that stands at the bench', () => {
    const shown = view.sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items)
      .map((entry) => entry.item.id)

    expect(shown).not.toContain('wider-blocks')
    expect(shown).not.toContain('more-questions')
    expect(shown).toContain('more-photos')
  })
})

describe('the bench lays a task’s families out with what is sold for their knobs', () => {
  const view = benchView(apple, catalog, [], 100000)

  it('lists every family the task declares, in declared order', () => {
    expect(view.families.map((entry) => entry.family.id)).toEqual(
      apple.families.map((family) => family.id),
    )
    expect(view.taskId).toBe(apple.id)
  })

  it('lists a family the farm does not own with the item that opens it', () => {
    const locked = view.families.find((entry) => entry.family.id === tree!.id)

    expect(locked?.available).toBe(false)
    expect(locked?.openedBy?.id).toBe('the-tree')
  })

  it('shows the same families once that item is owned, now unlocked', () => {
    const owned = benchView(apple, catalog, ['the-tree'], 100000)

    expect(owned.families.map((entry) => entry.family.id)).toEqual(
      view.families.map((entry) => entry.family.id),
    )
    expect(owned.families.find((entry) => entry.family.id === tree!.id)?.available).toBe(true)
  })

  it('shows a knob no bench item opens not at all', () => {
    const shown = view.families
      .find((entry) => entry.family.id === network!.id)
      ?.knobs.map((knob) => knob.knob.id)

    expect(shown).toEqual(['channels'])
    expect(shown).not.toContain('blocks')
  })

  it('shows an upgrade under the family whose knob it opens, and under no other', () => {
    const under = (familyId: string): readonly string[] =>
      view.families
        .find((entry) => entry.family.id === familyId)
        ?.knobs.flatMap((knob) => knob.items.map((entry) => entry.item.id)) ?? []

    expect(under(network!.id)).toEqual(['wider-blocks'])
    expect(under(tree!.id)).toEqual(['more-questions'])
  })

  it('marks a family with nothing for sale by offering no knob at all', () => {
    const bare = benchView(other, catalog, [], 100000)

    expect(bare.families.length).toBeGreaterThan(0)
    for (const entry of bare.families) expect(entry.knobs).toEqual([])
  })

  it('reads the four states exactly as the market reads them', () => {
    const poor = benchView(apple, catalog, [], 0)
    const stateOf = (id: string, view: ReturnType<typeof benchView>): string | undefined =>
      view.families
        .flatMap((entry) => entry.knobs)
        .flatMap((knob) => knob.items)
        .find((entry) => entry.item.id === id)?.state

    expect(stateOf('more-questions', view)).toBe('buyable')
    expect(stateOf('more-questions', poor)).toBe('saving')
    expect(stateOf('more-questions', benchView(apple, catalog, ['more-questions'], 100000))).toBe(
      'owned',
    )
    expect(stateOf('wider-blocks', view)).toBe('not-for-sale')
  })
})

describe('the counter is where a thing is bought and nothing more', () => {
  /** The same item, once on a market shelf and once on the bench. */
  function soldAt(counter: 'market' | 'bench'): Catalog {
    return soundCatalog(
      catalogWith(
        [item({ id: 'wider-blocks', group: 'shelf', price: 400, opens: [opensKnob('channels', [8])] })],
        [{ id: 'shelf', label: 'Shelf', soldAt: counter }],
      ),
    )
  }

  it('leaves identical state whichever view the purchase was begun from', () => {
    const atMarket = soldAt('market')
    const atBench = soldAt('bench')
    const farm = openFarm({ ...testFarm, openingBalance: 1000 })

    const fromMarket = marketView(atMarket, tasks, testFarm, [], farm.balance).sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items)
    const fromBench = benchView(apple, atBench, [], farm.balance).families
      .flatMap((entry) => entry.knobs)
      .flatMap((knob) => knob.items)

    expect(fromMarket.map((entry) => entry.item.id)).toEqual(['wider-blocks'])
    expect(fromBench.map((entry) => entry.item.id)).toEqual(['wider-blocks'])
    expect(fromMarket[0]?.state).toBe(fromBench[0]?.state)

    const boughtInMarket = buyItem(atMarket, farm, [], fromMarket[0]!.item.id)
    const boughtAtBench = buyItem(atBench, farm, [], fromBench[0]!.item.id)
    if (!boughtInMarket.ok || !boughtAtBench.ok) throw new Error('both were meant to be bought')

    expect(boughtAtBench.owned).toEqual(boughtInMarket.owned)
    expect(boughtAtBench.farm.balance).toBe(boughtInMarket.farm.balance)
    expect(boughtAtBench.farm.movements).toEqual(boughtInMarket.farm.movements)
    expect(boughtAtBench.farm.movements[0]?.reason).toBe('wider-blocks')
  })
})
