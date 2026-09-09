/**
 * Valuing a delivery: the payoff sum, and what the declared term takes off it.
 *
 * Built against the shipped declaration with a term patched on, and against a fixture
 * term whose tolerance is low enough that the punishing branch is reached by ordinary
 * counts rather than by a contrived one. A test that could only breach the tolerance with
 * numbers no crop produces would be exercising arithmetic and not a mechanic.
 */

import { describe, expect, it } from 'vitest'
import { valueDelivery } from '../src/scoring/index.js'
import type { ActionId, CategoryId, TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { loadRawDeclaration } from './helpers/load-raw'
import { appleDeclaration } from './helpers/apple.js'

const raw = loadRawDeclaration('apple-harvest')

/** The shipped declaration with a delivery term of the caller's choosing. */
function withTerm(term: Record<string, unknown> | undefined): TaskDeclaration {
  const copy: Record<string, unknown> = structuredClone(raw)
  if (term === undefined) delete copy.delivery
  else copy.delivery = term
  const result = validateDeclaration(copy)
  if (!result.ok) {
    throw new Error(`the patched declaration must validate: ${result.issues[0]?.message}`)
  }
  return result.declaration
}

const TERM = {
  measures: ['wormy'],
  delivering: ['crate-red', 'crate-green'],
  tolerance: 0.12,
  warnAbove: 0.09,
  downgradedValue: 0.05,
}

const declaration = withTerm(TERM)
const plain = withTerm(undefined)

/** A count table over the declared vocabulary, with everything not named at zero. */
function counts(
  from: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>,
): Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>> {
  const table: Record<string, Record<string, number>> = {}
  for (const category of declaration.categories) {
    const row: Record<string, number> = {}
    for (const action of declaration.actions) row[action.id] = from[category.id]?.[action.id] ?? 0
    table[category.id] = row
  }
  return table
}

/** The payoff sum those counts come to, from the declaration rather than by hand. */
function grossOf(
  table: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>,
  task: TaskDeclaration = declaration,
): number {
  let total = 0
  for (const category of task.categories) {
    for (const action of task.actions) {
      total += (table[category.id]?.[action.id] ?? 0) * (task.payoffs[category.id]?.[action.id] ?? 0)
    }
  }
  return total
}

/** A batch of `size` pieces with `wormy` of them crated as red, the rest sorted rightly. */
function batch(size: number, crated: number) {
  const wormy = Math.max(crated, 1)
  const red = Math.round((size - wormy) * 0.6)
  const green = size - wormy - red
  const table = counts({
    red: { 'crate-red': red },
    green: { 'crate-green': green },
    wormy: { 'crate-red': crated, discard: wormy - crated },
  })
  return { earnings: grossOf(table), counts: table }
}

describe('a delivery is its gross less a declared delivery term', () => {
  it('holds gross less downgrade equals paid, in every branch', () => {
    for (const crated of [0, 1, 20, 60, 120, 300, 600]) {
      const value = valueDelivery(declaration, batch(6000, crated))
      expect(value.gross - value.downgrade, `${crated} crated`).toBeCloseTo(value.paid, 8)
    }
  })

  it('pays the gross and applies no downgrade below the tolerance', () => {
    const scored = batch(1000, 20)
    const value = valueDelivery(declaration, scored)
    expect(value.share).toBeLessThan(0.12)
    expect(value.paid).toBeCloseTo(scored.earnings, 8)
    expect(value.downgrade).toBe(0)
    expect(value.downgraded).toBe(false)
  })

  it('pays every delivered piece the downgraded value at the tolerance', () => {
    // Exactly one in eight of the delivery is a measured piece: 0.125, over 0.12.
    const table = counts({
      red: { 'crate-red': 700 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 100, discard: 200 },
    })
    const scored = { earnings: grossOf(table), counts: table }
    const value = valueDelivery(declaration, scored)

    expect(value.share).toBeCloseTo(100 / 800, 8)
    expect(value.downgraded).toBe(true)
    expect(value.delivered).toBe(800)

    // Everything crated pays 0.05; the 200 discarded worms keep their own entry, which is
    // read from the declaration rather than assumed to be nothing.
    const kept = 200 * (declaration.payoffs.wormy?.discard ?? 0)
    expect(value.paid).toBeCloseTo(800 * 0.05 + kept, 8)
    expect(value.downgrade).toBeCloseTo(scored.earnings - value.paid, 8)
  })

  it('reaches the tolerance rather than having to exceed it', () => {
    const table = counts({
      red: { 'crate-red': 88 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 12, discard: 5 },
    })
    const value = valueDelivery(declaration, { earnings: grossOf(table), counts: table })
    expect(value.share).toBeCloseTo(0.12, 8)
    expect(value.downgraded).toBe(true)
  })

  it('reports no share and no downgrade when nothing was delivered', () => {
    const table = counts({ red: { discard: 550 }, green: { discard: 350 }, wormy: { discard: 100 } })
    const value = valueDelivery(declaration, { earnings: grossOf(table), counts: table })

    expect(value.share).toBeUndefined()
    expect(value.delivered).toBe(0)
    expect(value.downgraded).toBe(false)
    expect(value.downgrade).toBe(0)
    expect(value.warned).toBe(false)
  })

  it('earns less by discarding everything than by delivering inside the tolerance', () => {
    const discarded = counts({
      red: { discard: 550 },
      green: { discard: 350 },
      wormy: { discard: 100 },
    })
    const delivered = counts({
      red: { 'crate-red': 550 },
      green: { 'crate-green': 350 },
      wormy: { discard: 100 },
    })
    const nothing = valueDelivery(declaration, { earnings: grossOf(discarded), counts: discarded })
    const some = valueDelivery(declaration, { earnings: grossOf(delivered), counts: delivered })

    expect(some.downgraded).toBe(false)
    expect(nothing.paid).toBeLessThan(some.paid)
  })

  it('values a task declaring no term as the plain payoff sum, reporting nothing', () => {
    const table = counts({
      red: { 'crate-red': 550 },
      green: { 'crate-green': 350 },
      wormy: { 'crate-red': 100 },
    })
    const scored = { earnings: grossOf(table, plain), counts: table }
    const value = valueDelivery(plain, scored)

    expect(value.paid).toBe(scored.earnings)
    expect(value.gross).toBe(scored.earnings)
    expect(value.downgrade).toBe(0)
    expect(value.share).toBeUndefined()
    expect(value.tolerance).toBeUndefined()
    expect(value.warnAbove).toBeUndefined()
    expect(value.delivered).toBeUndefined()
    expect(value.warned).toBe(false)
  })

  it('is exactly today’s valuation for a task declaring no term', () => {
    // The shipped declaration as it stands, with a term, valued against the same
    // declaration without one: below the tolerance the two must agree to the penny.
    const scored = batch(6000, 300)
    const withoutTerm = valueDelivery(plain, scored)
    const withinTolerance = valueDelivery(declaration, scored)
    expect(withinTolerance.downgraded).toBe(false)
    expect(withinTolerance.paid).toBeCloseTo(withoutTerm.paid, 8)
  })
})

describe('one rare category decides the value of everything delivered', () => {
  it('moves earnings by far more than the two payoff entries of one image differ', () => {
    // 99 sound pieces and 11 measured ones is 0.11, under the tolerance. Crating one more
    // measured piece instead of discarding it takes the share to 12 in 100, which is the
    // tolerance exactly — one image's decision, the whole delivery's value.
    const under = counts({
      red: { 'crate-red': 89 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 11, discard: 1 },
    })
    const over = counts({
      red: { 'crate-red': 88 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 12 },
    })

    const before = valueDelivery(declaration, { earnings: grossOf(under), counts: under })
    const after = valueDelivery(declaration, { earnings: grossOf(over), counts: over })

    expect(before.downgraded).toBe(false)
    expect(after.downgraded).toBe(true)

    // What that one image's two entries differ by, read from the declaration.
    const entries = declaration.payoffs.wormy
    const perImage = Math.abs((entries?.['crate-red'] ?? 0) - (entries?.discard ?? 0))
    const moved = Math.abs(before.paid - after.paid)

    expect(moved).toBeGreaterThan(perImage)
    // And by a lot: this is a batch term, not a second per-image entry in disguise. What
    // the whole delivery is now worth is the flat downgraded value, one hundred times —
    // stated against the declaration rather than as a multiple of the payoff entry, which
    // would move every time the table is retuned.
    expect(after.paid).toBeCloseTo(100 * 0.05, 8)
    expect(moved).toBeGreaterThan(perImage * 5)
  })
})

describe('the warning comes before the punishment', () => {
  it('records a warning at the warning share, and still pays the gross', () => {
    const table = counts({
      red: { 'crate-red': 90 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 10, discard: 5 },
    })
    const scored = { earnings: grossOf(table), counts: table }
    const value = valueDelivery(declaration, scored)

    expect(value.share).toBeCloseTo(0.1, 8)
    expect(value.warned).toBe(true)
    expect(value.tolerance).toBe(0.12)
    expect(value.downgraded).toBe(false)
    expect(value.paid).toBeCloseTo(scored.earnings, 8)
  })

  it('does not warn below the warning share', () => {
    const value = valueDelivery(declaration, batch(1000, 20))
    expect(value.share).toBeLessThan(0.09)
    expect(value.warned).toBe(false)
  })

  it('does not warn when the delivery was downgraded instead', () => {
    const table = counts({
      red: { 'crate-red': 80 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 20 },
    })
    const value = valueDelivery(declaration, { earnings: grossOf(table), counts: table })
    expect(value.downgraded).toBe(true)
    expect(value.warned).toBe(false)
  })

  it('warns at the warning share itself, not only above it', () => {
    const table = counts({
      red: { 'crate-red': 91 },
      green: { 'crate-green': 0 },
      wormy: { 'crate-red': 9, discard: 3 },
    })
    const value = valueDelivery(declaration, { earnings: grossOf(table), counts: table })
    expect(value.share).toBeCloseTo(0.09, 8)
    expect(value.warned).toBe(true)
  })
})

describe('the term reads the task’s vocabulary rather than a fixed one', () => {
  it('measures whatever categories and actions the term names', () => {
    // The same counts, a different term: measure the unripe ones instead, and count only
    // one of the two crating actions as delivering.
    const other = withTerm({
      measures: ['green'],
      delivering: ['crate-red'],
      tolerance: 0.1,
      warnAbove: 0.05,
      downgradedValue: 0.02,
    })
    const table = counts({
      red: { 'crate-red': 80 },
      green: { 'crate-red': 20, 'crate-green': 300 },
      wormy: { discard: 100 },
    })
    const value = valueDelivery(other, { earnings: grossOf(table, other), counts: table })

    expect(value.delivered).toBe(100)
    expect(value.share).toBeCloseTo(0.2, 8)
    expect(value.downgraded).toBe(true)
    expect(value.paid).toBeCloseTo(
      grossOf(table, other) -
        (80 * (other.payoffs.red?.['crate-red'] ?? 0) +
          20 * (other.payoffs.green?.['crate-red'] ?? 0)) +
        100 * 0.02,
      8,
    )
  })

  it('is the same function the shipped declaration is valued by', () => {
    // Not a separate path for the lesson that motivated it: the shipped declaration goes
    // through this and produces a valuation whose arithmetic holds like any other.
    const shipped = appleDeclaration()
    const table = counts({
      red: { 'crate-red': 3300 },
      green: { 'crate-green': 2100 },
      wormy: { discard: 600 },
    })
    const value = valueDelivery(shipped, { earnings: grossOf(table, shipped), counts: table })
    expect(value.gross - value.downgrade).toBeCloseTo(value.paid, 8)
  })
})
