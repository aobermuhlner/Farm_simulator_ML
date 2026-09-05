import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { runHarvest } from '../../../src/scoring/index.js'
import type { RunOutcome } from '../../../src/scoring/index.js'
import type { TaskDeclaration } from '../../../src/task/types.js'
import { validateDeclaration } from '../../../src/task/validate.js'
import {
  appleArtifact,
  appleDeclaration,
  appleTruth,
  unrelatedDeclaration,
} from '../test-support/declarations.js'
import { Report } from './Report.js'

afterEach(cleanup)

const apple = appleDeclaration()

/** Runs one configuration through the engine, so counts are never hand-typed. */
function outcomeFor(
  knobs: Record<string, string | number>,
  declaration: TaskDeclaration = apple,
): {
  id: string
  outcome: RunOutcome
} {
  const result = runHarvest(declaration, knobs, appleArtifact(), 'pool', appleTruth())
  if (!result.ok) {
    throw new Error(`expected ${JSON.stringify(knobs)} to run: ${result.issues[0]?.message}`)
  }
  return { id: result.configurationId, outcome: result.outcome }
}

const BALANCED = { blocks: 3, channels: 16, regularization: 1, dropout: 0 }
/** Crates no worms, but only because it throws away most ripe reds as well. */
const OVER_SELECTIVE = { blocks: 4, channels: 16, regularization: 1, dropout: 0 }
/** Crates its worms, because it barely tells a worm from a ripe red. */
const OVER_REGULARIZED = { blocks: 2, channels: 8, regularization: 3, dropout: 0.5 }

function renderReport(
  knobs: Record<string, string | number>,
  overrides: Partial<{ declaration: TaskDeclaration; stale: boolean }> = {},
) {
  const declaration = overrides.declaration ?? apple
  const { id, outcome } = outcomeFor(knobs, declaration)
  render(
    <Report
      declaration={declaration}
      configurationId={id}
      outcome={outcome}
      stale={overrides.stale ?? false}
    />,
  )
  return outcome
}

/** The count in one category-and-action cell. */
function cell(category: string, action: string): number {
  const found = document.querySelector(`[data-cell="${category}:${action}"]`)
  if (found === null) throw new Error(`no cell for ${category} and ${action}`)
  return Number(found.textContent)
}

/** The action a category is declared to call for. */
function mappedTo(category: string): string {
  const action = apple.categoryActions[category]
  if (action === undefined) throw new Error(`no declared action for "${category}"`)
  return action
}

/** Every action the task declares that is not `category`'s own. */
function othersThan(category: string): string[] {
  return apple.actions.map((action) => action.id).filter((id) => id !== mappedTo(category))
}

describe('the report is the payoff table filled with counts', () => {
  it('shows a cell for every declared category and action combination', () => {
    renderReport(BALANCED)

    expect(apple.categories.length * apple.actions.length).toBe(9)
    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(
          document.querySelector(`[data-cell="${category.id}:${action.id}"]`),
          `missing cell for ${category.id} and ${action.id}`,
        ).not.toBeNull()
      }
    }
  })

  it('gives every declared action a column of its own, in declared order', () => {
    renderReport(BALANCED)

    const columns = [...document.querySelectorAll('thead th[scope="col"]')].map(
      (header) => header.textContent,
    )
    // The first column heads the true-category rows; the rest are the actions, one each.
    expect(columns.slice(1)).toEqual(apple.actions.map((action) => action.label))
  })

  it('includes combinations that happened zero times', () => {
    const outcome = renderReport(BALANCED)
    const zeroes = apple.categories.flatMap((category) =>
      apple.actions
        .filter((action) => (outcome.counts[category.id]?.[action.id] ?? 0) === 0)
        .map((action) => [category.id, action.id] as const),
    )

    expect(zeroes.length, 'this configuration was expected to leave some cells empty')
      .toBeGreaterThan(0)
    for (const [category, action] of zeroes) {
      expect(cell(category, action)).toBe(0)
    }
  })

  it('labels categories and actions as the task declares them', () => {
    renderReport(BALANCED)

    for (const category of apple.categories) {
      expect(screen.getByRole('rowheader', { name: category.label })).toBeDefined()
    }
    for (const action of apple.actions) {
      expect(screen.getByRole('columnheader', { name: action.label })).toBeDefined()
    }
  })

  it('shows the counts the engine returned, alongside the total', () => {
    const outcome = renderReport(BALANCED)

    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(cell(category.id, action.id)).toBe(outcome.counts[category.id]?.[action.id] ?? 0)
      }
    }
    expect(screen.getByText(/Total earnings/).textContent).toContain(
      outcome.earnings.toFixed(2),
    )
  })

  it('carries one column fewer for a task declaring one action fewer', () => {
    // Same component, same file: a narrower task is rendered by the declaration it brings
    // rather than by a screen that was told how many actions to expect.
    const narrower = unrelatedDeclaration()
    expect(narrower.actions.length).toBe(apple.actions.length - 1)

    renderReport(BALANCED)
    const wide = document.querySelectorAll('thead th[scope="col"]').length
    cleanup()

    render(
      <Report
        declaration={narrower}
        configurationId="sensitivitylow"
        outcome={{
          evaluated: 0,
          earnings: 0,
          counts: {},
          images: [],
        }}
        stale={false}
      />,
    )
    const narrow = [...document.querySelectorAll('thead th[scope="col"]')].map(
      (header) => header.textContent,
    )

    expect(narrow.length).toBe(wide - 1)
    expect(narrow.slice(1)).toEqual(narrower.actions.map((action) => action.label))
  })
})

describe('an over-selective configuration is diagnosable on screen', () => {
  it('separates the missed reds from the correctly rejected worms', () => {
    const outcome = renderReport(OVER_SELECTIVE)

    // The trap: this configuration looks flawless on wormy apples while barely filling the
    // red crate at all. Both facts have to be visible, and in cells of their own — equal
    // counts would still be two separate readings.
    for (const action of othersThan('wormy')) {
      expect(cell('wormy', action)).toBe(0)
    }
    expect(cell('red', mappedTo('wormy'))).toBeGreaterThan(0)
    expect(cell('wormy', mappedTo('wormy'))).toBeGreaterThan(0)
    expect(document.querySelector(`[data-cell="red:${mappedTo('wormy')}"]`)).not.toBe(
      document.querySelector(`[data-cell="wormy:${mappedTo('wormy')}"]`),
    )
    expect(outcome.earnings).toBeLessThan(outcomeFor(BALANCED).outcome.earnings)
  })

  it('does not collapse the two into one score', () => {
    renderReport(OVER_SELECTIVE)

    const rejected = apple.categories.map((category) => cell(category.id, mappedTo('wormy')))

    expect(new Set(rejected).size).toBeGreaterThan(1)
  })

  it('tells a red in the wrong crate apart from a red on the reject heap', () => {
    // The resolution the third action bought. Under two actions both of these were the
    // same cell, and "downgraded half the crop" read as "refused half the crop".
    renderReport(OVER_SELECTIVE)

    const wrongCrate = othersThan('red').filter((action) => action !== mappedTo('wormy'))
    expect(wrongCrate).toHaveLength(1)
    expect(cell('red', wrongCrate[0] as string)).not.toBe(cell('red', mappedTo('wormy')))
    expect(
      document.querySelector(`[data-cell="red:${wrongCrate[0] as string}"]`),
    ).not.toBe(document.querySelector(`[data-cell="red:${mappedTo('wormy')}"]`))
  })
})

describe('a configuration that crates its worms', () => {
  it('says which crate the worms went into', () => {
    renderReport(OVER_REGULARIZED)

    const crates = othersThan('wormy')
    expect(crates).toHaveLength(2)
    expect(crates.map((action) => cell('wormy', action))).toEqual([2, 0])
    expect(cell('wormy', mappedTo('wormy'))).toBe(0)
  })

  it('counts the two crates separately when the worms go to both', () => {
    // A declared threshold policy, so the same six images are sorted into both crates:
    // p-004 misses the green threshold and is crated as red, p-005 clears it and is crated
    // as green. Two worms, two crates, two counts — and no cell that stands for "crated".
    const split = validateDeclaration({
      ...apple,
      policy: {
        kind: 'threshold',
        thresholds: { red: 0.5, green: 0.12, wormy: 0.9 },
        fallbackAction: mappedTo('wormy'),
        priority: ['green', 'red', 'wormy'],
      },
    })
    if (!split.ok) throw new Error(`the threshold variant must validate: ${split.issues[0]?.message}`)

    renderReport(OVER_REGULARIZED, { declaration: split.declaration })

    const crates = othersThan('wormy')
    expect(crates.map((action) => cell('wormy', action))).toEqual([1, 1])
    expect(cell('wormy', mappedTo('wormy'))).toBe(0)
    expect(document.querySelector(`[data-cell="wormy:${crates[0] as string}"]`)).not.toBe(
      document.querySelector(`[data-cell="wormy:${crates[1] as string}"]`),
    )
  })
})

describe('a stale report', () => {
  it('says which configuration it belongs to instead of posing as current', () => {
    renderReport(BALANCED, { stale: true })

    expect(screen.getByRole('status').textContent).toContain('changed the knobs since')
    expect(screen.queryByText(/images evaluated/)).toBeNull()
  })
})
