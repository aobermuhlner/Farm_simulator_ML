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
import { appleDeclaration } from './helpers/apple.js'
import { catalogWith, pricedItem, shippedCatalogJson, soundCatalog, testFarm, unpricedItem } from './helpers/catalog.js'

const apple = appleDeclaration()
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
  const coverage = { [apple.id]: shippedCoverage() }

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
        wider.push(`blocks${blocks}-channels${channels}-regularization1-dropout0`)
      }
    }

    expect(checkCatalogCoverage(catalog, tasks, { [apple.id]: wider })).toEqual([])
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
      for (const knob of apple.knobs) {
        const open = declaredValues(knob).filter((value) => {
          const entry = task.knobs
            .find((candidate) => candidate.knobId === knob.id)
            ?.values.find((candidate) => String(candidate.value) === String(value))
          return entry === undefined || entry.available
        })
        rows = open.flatMap((value) => rows.map((row) => [...row, [knob.id, value] as const]))
      }

      for (const values of rows) {
        const id = configurationId({ taskId: apple.id, values })
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
      'blocks2-channels8-regularization1-dropout0',
      'blocks2-channels16-regularization1-dropout0',
      'blocks2-channels32-regularization1-dropout0',
    ])
  })

  it('validates against the shipped task’s own declarations', () => {
    expect(checkCatalogAgainstTasks(soundCatalog(shippedCatalogJson()), tasks)).toEqual([])
  })
})
