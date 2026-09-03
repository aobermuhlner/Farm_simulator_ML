import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { runHarvest } from '../../../src/scoring/index.js'
import type { RunOutcome } from '../../../src/scoring/index.js'
import type { TaskDeclaration } from '../../../src/task/types.js'
import { appleArtifact, appleDeclaration, appleTruth } from '../test-support/declarations.js'
import { Report } from './Report.js'

afterEach(cleanup)

const apple = appleDeclaration()

/** Runs one configuration through the engine, so counts are never hand-typed. */
function outcomeFor(knobs: Record<string, string | number>): {
  id: string
  outcome: RunOutcome
} {
  const result = runHarvest(apple, knobs, appleArtifact(), 'pool', appleTruth())
  if (!result.ok) {
    throw new Error(`expected ${JSON.stringify(knobs)} to run: ${result.issues[0]?.message}`)
  }
  return { id: result.configurationId, outcome: result.outcome }
}

const BALANCED = { blocks: 3, channels: 16, regularization: 1, dropout: 0 }
/** Sells no worms, but only because it declines most ripe reds as well. */
const OVER_SELECTIVE = { blocks: 4, channels: 16, regularization: 1, dropout: 0 }

function renderReport(
  knobs: Record<string, string | number>,
  overrides: Partial<{ declaration: TaskDeclaration; stale: boolean }> = {},
) {
  const { id, outcome } = outcomeFor(knobs)
  render(
    <Report
      declaration={overrides.declaration ?? apple}
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

describe('the report is the payoff table filled with counts', () => {
  it('shows a cell for every declared category and action combination', () => {
    renderReport(BALANCED)

    for (const category of apple.categories) {
      for (const action of apple.actions) {
        expect(
          document.querySelector(`[data-cell="${category.id}:${action.id}"]`),
          `missing cell for ${category.id} and ${action.id}`,
        ).not.toBeNull()
      }
    }
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
})

describe('an over-selective configuration is diagnosable on screen', () => {
  it('separates the missed reds from the correctly declined worms', () => {
    const outcome = renderReport(OVER_SELECTIVE)

    // The trap: this configuration looks flawless on wormy apples while barely
    // picking anything at all. Both facts have to be visible, and in cells of
    // their own — equal counts would still be two separate readings.
    expect(cell('wormy', 'pick')).toBe(0)
    expect(cell('red', 'decline')).toBeGreaterThan(0)
    expect(cell('wormy', 'decline')).toBeGreaterThan(0)
    expect(document.querySelector('[data-cell="red:decline"]')).not.toBe(
      document.querySelector('[data-cell="wormy:decline"]'),
    )
    expect(outcome.earnings).toBeLessThan(outcomeFor(BALANCED).outcome.earnings)
  })

  it('does not collapse the two into one score', () => {
    renderReport(OVER_SELECTIVE)

    const declineCells = apple.categories.map((category) => cell(category.id, 'decline'))

    expect(new Set(declineCells).size).toBeGreaterThan(1)
  })
})

describe('a stale report', () => {
  it('says which configuration it belongs to instead of posing as current', () => {
    renderReport(BALANCED, { stale: true })

    expect(screen.getByRole('status').textContent).toContain('changed the knobs since')
    expect(screen.queryByText(/images evaluated/)).toBeNull()
  })
})
