/**
 * The catalog checked against what it claims to open, and against what was trained.
 *
 * These are cross-file rules: `catalog.json` names ids that live in task declarations and
 * opens configurations that live in an artifact, so nothing inside any one of those files
 * can see a mistake here. That is the whole reason the check exists at load rather than
 * in review.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TaskDeclaration } from '../src/task/types.js'
import { configurationId } from '../src/task/configId.js'
import {
  checkCatalogAgainstTasks,
  checkCatalogCoverage,
  computeAvailability,
  declaredValues,
  validateCatalog,
} from '../src/progression/index.js'
import { firstFamily } from '../src/task/families.js'
import { appleDeclaration } from './helpers/apple.js'
import {
  catalogWith,
  landItem,
  pricedItem,
  shippedCatalogJson,
  soundCatalog,
  testFarm,
  testGroups,
  unpricedItem,
} from './helpers/catalog.js'

const apple = appleDeclaration()
const family = firstFamily(apple)
const tasks: readonly TaskDeclaration[] = [apple]

/** Every identifier the shipped artifact index covers. */
function shippedCoverage(): readonly string[] {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), 'artifacts/apple-harvest/predictions/index.json'), 'utf8'),
  ) as { configurations: Record<string, unknown> }
  return Object.keys(index.configurations)
}

function messagesFor(items: readonly Record<string, unknown>[]): string {
  return checkCatalogAgainstTasks(soundCatalog(catalogWith(items)), tasks)
    .map((issue) => `${issue.field ?? ''} ${issue.message}`)
    .join(' | ')
}

describe('everything an item opens has to exist', () => {
  it('accepts a catalog whose references all resolve', () => {
    expect(checkCatalogAgainstTasks(soundCatalog(catalogWith([pricedItem()])), tasks)).toEqual([])
  })

  it('refuses an item opening a task no declaration carries, naming both', () => {
    const found = messagesFor([
      pricedItem({ opens: [{ kind: 'knob-values', task: 'plum-harvest', knob: 'channels', values: [8] }] }),
    ])
    expect(found).toContain('wider-blocks')
    expect(found).toContain('plum-harvest')
  })

  it('refuses an item opening a knob the task does not declare, naming both', () => {
    const found = messagesFor([
      pricedItem({ opens: [{ kind: 'knob-values', task: apple.id, knob: 'momentum', values: [8] }] }),
    ])
    expect(found).toContain('wider-blocks')
    expect(found).toContain('momentum')
  })

  it('refuses an item opening a value the knob does not permit, naming knob and value', () => {
    const found = messagesFor([
      pricedItem({ opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [64] }] }),
    ])
    expect(found).toContain('wider-blocks')
    expect(found).toContain('channels')
    expect(found).toContain('64')
  })

  it('refuses an item that opens a knob’s declared default', () => {
    const found = messagesFor([
      pricedItem({ opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [16] }] }),
    ])
    expect(found).toContain('wider-blocks')
    expect(found).toContain('16')
    expect(found).toContain('default')
  })

  it('refuses two items opening the same thing, naming both', () => {
    const found = messagesFor([
      pricedItem(),
      pricedItem({
        id: 'other-blocks',
        opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [8] }],
      }),
    ])
    expect(found).toContain('wider-blocks')
    expect(found).toContain('other-blocks')
    expect(found).toContain('8')
  })

  it('refuses an unlock of a kind this build does not recognise, naming the kind', () => {
    const validated = validateCatalog(
      catalogWith([pricedItem({ opens: [{ kind: 'tree-count', task: apple.id, count: 100 }] })]),
      testFarm,
    )
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('unknown-unlock-kind')
    expect(validated.issues[0]?.message).toContain('tree-count')
  })

  it('refuses an item that opens nothing, so nothing is sold that does nothing', () => {
    const validated = validateCatalog(catalogWith([pricedItem({ opens: [] })]), testFarm)
    expect(validated.ok).toBe(false)
    if (validated.ok) return
    expect(validated.issues[0]?.code).toBe('opens-nothing')
    expect(validated.issues[0]?.field).toBe('wider-blocks')
  })
})

describe('nothing for sale opens a configuration no model was trained for', () => {
  const coverage = { [apple.id]: { [family.id]: shippedCoverage() } }

  it('accepts a priced item whose combinations are all covered', () => {
    // `channels` is the one knob whose values are all trained, which is what makes it
    // the only thing that could be priced today.
    const catalog = soundCatalog(
      catalogWith([
        pricedItem({ opens: [{ kind: 'knob-values', task: apple.id, knob: 'channels', values: [8, 32] }] }),
      ]),
    )
    expect(checkCatalogCoverage(catalog, tasks, coverage)).toEqual([])
  })

  it('refuses a priced item opening untrained ground, naming it and an identifier', () => {
    const catalog = soundCatalog(catalogWith([pricedItem({ ...unpricedItem(), price: 500 })]))
    const issues = checkCatalogCoverage(catalog, tasks, coverage)

    expect(issues).toHaveLength(1)
    expect(issues[0]?.field).toBe('deeper-blocks')
    expect(issues[0]?.message).toContain('blocks3')
  })

  it('accepts the same item unpriced, and leaves its values locked', () => {
    const catalog = soundCatalog(catalogWith([unpricedItem()]))
    expect(checkCatalogCoverage(catalog, tasks, coverage)).toEqual([])

    const availability = computeAvailability(catalog, tasks, [])
    const blocks = availability.tasks[0]?.knobs.find((knob) => knob.knobId === 'blocks')
    expect(blocks?.values.filter((value) => value.available).map((value) => value.value)).toEqual([2])
  })

  it('refuses an item owned from the start that opens untrained ground', () => {
    const raw = catalogWith([unpricedItem()])
    raw.ownedAtStart = ['deeper-blocks']
    const issues = checkCatalogCoverage(soundCatalog(raw), tasks, coverage)

    expect(issues.map((issue) => issue.field)).toEqual(['deeper-blocks'])
  })

  it('is driven by the artifact’s coverage rather than by a grid written down here', () => {
    // Widen the coverage and the same catalog is accepted; nothing else changes.
    const catalog = soundCatalog(catalogWith([pricedItem({ ...unpricedItem(), price: 500 })]))
    const wider = [...shippedCoverage()]
    for (const blocks of [3, 4]) {
      for (const channels of [8, 16, 32]) {
        wider.push(`blocks${blocks}-channels${channels}-regularization1-dropout0-datasetstarter`)
      }
    }

    expect(checkCatalogCoverage(catalog, tasks, { [apple.id]: { [family.id]: wider } })).toEqual([])
  })

  it('says nothing about an uncovered configuration no purchase opens', () => {
    // Only `channels` is covered at all, so most of the declared grid is untrained — and
    // that stays the untrained refusal's business, not this rule's.
    expect(checkCatalogCoverage(soundCatalog(catalogWith([])), tasks, coverage)).toEqual([])
  })
})

describe('the shipped catalog, task and artifact together', () => {
  it('leaves no configuration a student of this build can select untrained', () => {
    const catalog = soundCatalog(shippedCatalogJson())
    const covered = shippedCoverage()

    // Every ownership the catalog permits: nothing can be bought and nothing is owned at
    // the start, so the powerset of what is obtainable is the one empty set — asserted by
    // construction rather than assumed, so pricing an item makes this test do more work.
    const obtainable = catalog.items
      .filter((item) => item.priceUnits !== undefined || catalog.ownedAtStart.includes(item.id))
      .map((item) => item.id)
    const ownerships: string[][] = [[]]
    for (const id of obtainable) {
      for (const owned of [...ownerships]) ownerships.push([...owned, id])
    }

    const uncovered: string[] = []
    for (const owned of ownerships) {
      const availability = computeAvailability(catalog, tasks, [...catalog.ownedAtStart, ...owned])
      const task = availability.tasks[0]
      if (task === undefined) throw new Error('the availability must cover the shipped task')

      let rows: (readonly [string, string | number])[][] = [[]]
      for (const knob of family.knobs) {
        const open = declaredValues(knob).filter((value) => {
          const entry = task.knobs
            .find((candidate) => candidate.knobId === knob.id)
            ?.values.find((candidate) => String(candidate.value) === String(value))
          return entry === undefined || entry.available
        })
        rows = open.flatMap((value) => rows.map((row) => [...row, [knob.id, value] as const]))
      }

      for (const values of rows) {
        const id = configurationId({ taskId: apple.id, familyId: family.id, values })
        if (!covered.includes(id)) uncovered.push(`${owned.join('+') || 'nothing owned'}: ${id}`)
      }
    }

    expect(ownerships).toHaveLength(2 ** obtainable.length)
    expect(uncovered).toEqual([])
  })

  it('is checked against the three identifiers the shipped artifact still covers', () => {
    // Pinned, because this change trains nothing and regenerates nothing: if these three
    // ever move, it was another change that moved them and this suite should say so.
    expect(shippedCoverage()).toEqual([
      'blocks2-channels8-regularization1-dropout0-datasetstarter',
      'blocks2-channels16-regularization1-dropout0-datasetstarter',
      'blocks2-channels32-regularization1-dropout0-datasetstarter',
    ])
  })

  it('validates against the shipped task’s own declarations', () => {
    expect(checkCatalogAgainstTasks(soundCatalog(shippedCatalogJson()), tasks)).toEqual([])
  })
})

describe('growth accumulates rather than opening a thing twice', () => {
  it('accepts two items that each grow the farm', () => {
    // "No two items open the same thing" is about naming the one item that opens a
    // locked value. Two items that each grow the farm open two different things, and a
    // student who buys both gets both — so the rule has nothing to say about them.
    const both = soundCatalog(
      catalogWith([landItem(), landItem({ id: 'back-field', label: 'The back field' })]),
    )
    expect(checkCatalogAgainstTasks(both, tasks)).toEqual([])
  })

  it('accepts an item that only grows the farm, since growth is a thing opened', () => {
    expect(messagesFor([landItem()])).toBe('')
  })

  it('is not measured against a knob default or against the trained coverage', () => {
    // It names no task, no knob and no value, so there is nothing for either rule to
    // resolve — and buying it cannot lead a student into an untrained configuration.
    const catalog = soundCatalog(catalogWith([landItem(), pricedItem()]))
    expect(checkCatalogAgainstTasks(catalog, tasks)).toEqual([])

    const blamed = checkCatalogCoverage(soundCatalog(catalogWith([landItem()])), tasks, {
      [apple.id]: { [family.id]: shippedCoverage() },
    })
    expect(blamed.map((issue) => issue.field)).not.toContain('starter-plot')
  })

  it('leaves what a farm may choose exactly where it was, however often it is owned', () => {
    // `owned` is a multiset now, and the three consumers that read it all ask
    // membership. A future consumer that starts counting has this to break.
    const catalog = soundCatalog(catalogWith([pricedItem(), landItem()]))
    const once = computeAvailability(catalog, tasks, ['starter-plot'])
    const twice = computeAvailability(catalog, tasks, ['starter-plot', 'starter-plot'])
    const never = computeAvailability(catalog, tasks, [])

    expect(twice).toEqual(once)
    expect(once).toEqual(never)
  })
})

describe('a dataset tier no model was fitted on cannot be priced', () => {
  const shipped = soundCatalog(shippedCatalogJson())
  const coverage = { [apple.id]: { [family.id]: shippedCoverage() } }

  /** The shipped catalog with one item given a price. */
  function priced(itemId: string) {
    const raw = shippedCatalogJson() as { items: Record<string, unknown>[] }
    const items = raw.items.map((item) =>
      item.id === itemId ? { ...item, price: 800, notForSaleReason: undefined } : item,
    )
    return soundCatalog({ ...raw, items })
  }

  it('accepts both of them unpriced, which is how they ship', () => {
    expect(checkCatalogCoverage(shipped, tasks, coverage)).toEqual([])
    for (const id of ['bulk-photos', 'checked-photos']) {
      const item = shipped.items.find((candidate) => candidate.id === id)
      expect(item?.priceUnits, id).toBeUndefined()
      expect(item?.notForSaleReason, id).toContain('fitted')
    }
  })

  it('refuses either of them priced, naming the item and an identifier no artifact covers', () => {
    for (const id of ['bulk-photos', 'checked-photos']) {
      const issues = checkCatalogCoverage(priced(id), tasks, coverage)
      expect(issues.map((issue) => issue.field), id).toContain(id)
      const named = issues.find((issue) => issue.field === id)
      // The identifier it would open, so the author can see exactly what is missing.
      expect(named?.message, id).toContain('dataset')
    }
  })
})

describe('a group belongs to a part of the farm that exists', () => {
  /** The built groups, with `models` claiming to belong to `task`. */
  function belongingTo(task: string): readonly Record<string, unknown>[] {
    return testGroups.map((group) => (group.id === 'models' ? { ...group, task } : group))
  }

  it('accepts a group naming a task this build declares', () => {
    const catalog = soundCatalog(catalogWith([pricedItem()], belongingTo(apple.id)))
    expect(checkCatalogAgainstTasks(catalog, tasks)).toEqual([])
  })

  it('refuses a group naming a task no declaration carries, naming both', () => {
    const catalog = soundCatalog(catalogWith([pricedItem()], belongingTo('plum-harvest')))
    const found = checkCatalogAgainstTasks(catalog, tasks)
      .map((issue) => `${issue.field ?? ''} ${issue.message}`)
      .join(' | ')

    expect(found).toContain('models')
    expect(found).toContain('plum-harvest')
  })
})

describe('a bench item that reaches across two families is refused', () => {
  /**
   * A task whose two families declare a knob of one id, permitting different values.
   *
   * The catalog names a task and a knob and no family, so the only thing that can say
   * which family an unlock belongs to is which of them permits the values it opens.
   * Both keep the same default, because a knob's default may never be locked.
   */
  function twoFamilies(): TaskDeclaration {
    const [first, second] = apple.families
    if (first === undefined || second === undefined) throw new Error('two families are needed')
    const shared = {
      kind: 'choice',
      id: 'depth',
      label: 'Depth',
      values: [1, 2, 3],
      default: 1,
      help: 'How deep it goes.',
    }
    return {
      ...apple,
      families: [
        { ...first, knobs: [...first.knobs, shared] },
        { ...second, knobs: [...second.knobs, { ...shared, values: [1, 3] }] },
      ],
    } as TaskDeclaration
  }

  /** One bench item opening the shared knob at `values`. */
  function benched(values: readonly number[]): Record<string, unknown> {
    return pricedItem({
      id: 'benched',
      group: 'capacity',
      opens: [{ kind: 'knob-values', task: apple.id, knob: 'depth', values }],
    })
  }

  /** Every reference issue this catalog reports against the two-family task. */
  function found(values: readonly number[]): string {
    return checkCatalogAgainstTasks(soundCatalog(catalogWith([benched(values)])), [twoFamilies()])
      .map((issue) => issue.message)
      .join(' | ')
  }

  it('accepts one whose value only one of the two families permits', () => {
    expect(found([2])).toBe('')
  })

  it('refuses one whose value both families permit, naming the item and both', () => {
    const [first, second] = apple.families
    const message = found([3])

    expect(message).toContain('benched')
    expect(message).toContain(first!.id)
    expect(message).toContain(second!.id)
  })
})

describe('an unpriced item may name a rung that has not been built', () => {
  /** One item opening a family that no task declares, priced or not. */
  function opensFamily(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const item = pricedItem({
      id: 'straight-line',
      opens: [{ kind: 'model-family', task: apple.id, family: 'linear-regression' }],
      ...overrides,
    })
    if (item.price === undefined) delete item.price
    return item
  }

  /** Every reference issue the catalog holding just this item reports. */
  function found(item: Record<string, unknown>): string {
    return checkCatalogAgainstTasks(soundCatalog(catalogWith([item])), tasks)
      .map((issue) => `${issue.field ?? ''} ${issue.message}`)
      .join(' | ')
  }

  it('accepts an unpriced item naming a family its task does not declare', () => {
    expect(
      found(opensFamily({ price: undefined, notForSaleReason: 'It has not been built.' })),
    ).toBe('')
  })

  it('refuses the same item once it carries a price, naming the item and the family', () => {
    const message = found(opensFamily())
    expect(message).toContain('straight-line')
    expect(message).toContain('linear-regression')
    expect(message).toContain(apple.id)
  })

  it('still refuses an unpriced item naming a task no declaration carries', () => {
    // The latitude is about a rung that has not been built, not about a field the farm
    // does not have: a shelf entry for another farm's task is not a rung at all.
    const message = found(
      opensFamily({
        price: undefined,
        notForSaleReason: 'It has not been built.',
        opens: [{ kind: 'model-family', task: 'plum-harvest', family: 'linear-regression' }],
      }),
    )

    expect(message).toContain('straight-line')
    expect(message).toContain('plum-harvest')
  })

  it('still accepts a priced item opening a family the task does declare', () => {
    const [, second] = apple.families
    if (second === undefined) throw new Error('a second family is needed')
    expect(
      found(opensFamily({ opens: [{ kind: 'model-family', task: apple.id, family: second.id }] })),
    ).toBe('')
  })
})

describe('buying a model buys at least one configuration that can be run', () => {
  const [, second] = apple.families

  /** One priced item opening the task's second family. */
  function buysTheFamily(): Record<string, unknown> {
    return pricedItem({
      id: 'a-second-model',
      opens: [{ kind: 'model-family', task: apple.id, family: second!.id }],
    })
  }

  /** The identifier the second family's declared defaults compose. */
  function defaultsId(): string {
    return configurationId({
      taskId: apple.id,
      familyId: second!.id,
      values: second!.knobs.map((knob) => [knob.id, knob.default] as const),
    })
  }

  it('accepts a priced family whose declared defaults are covered', () => {
    const coverage = { [apple.id]: { [second!.id]: [defaultsId()] } }
    expect(
      checkCatalogCoverage(soundCatalog(catalogWith([buysTheFamily()])), tasks, coverage),
    ).toEqual([])
  })

  it('refuses a priced family whose defaults are not, naming it and the identifier', () => {
    const coverage = { [apple.id]: { [second!.id]: ['nothing-of-the-sort'] } }
    const issues = checkCatalogCoverage(
      soundCatalog(catalogWith([buysTheFamily()])),
      tasks,
      coverage,
    )

    expect(issues.map((issue) => issue.field)).toContain('a-second-model')
    expect(issues.map((issue) => issue.message).join(' | ')).toContain(defaultsId())
  })

  it('says nothing about an unpriced item that opens the same family', () => {
    const item = buysTheFamily()
    delete item.price
    item.notForSaleReason = 'No model of this kind has been made yet.'
    const coverage = { [apple.id]: { [second!.id]: ['nothing-of-the-sort'] } }

    expect(checkCatalogCoverage(soundCatalog(catalogWith([item])), tasks, coverage)).toEqual([])
  })
})
