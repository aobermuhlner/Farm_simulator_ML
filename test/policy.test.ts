import { describe, expect, it } from 'vitest'
import {
  chooseAction,
  expectedPayoff,
  MalformedDistributionError,
} from '../src/policy/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { appleDeclaration } from './helpers/apple'

const apple = appleDeclaration()

/** The apple task with a different declared policy. */
function withPolicy(policy: TaskDeclaration['policy']): TaskDeclaration {
  return { ...apple, policy }
}

const HIGHEST = withPolicy({ kind: 'highest-probability' })
const COST_OPTIMAL = withPolicy({ kind: 'cost-optimal' })

function threshold(
  thresholds: Record<string, number>,
  fallbackAction = 'decline',
): TaskDeclaration {
  return withPolicy({ kind: 'threshold', thresholds, fallbackAction })
}

// Distributions are indexed [red, green, wormy] in declared category order.
const CLEARLY_RED = [0.9, 0.05, 0.05]
const CLEARLY_GREEN = [0.1, 0.8, 0.1]
const CLEARLY_WORMY = [0.05, 0.15, 0.8]
const REDDISH_BUT_WORMY = [0.55, 0.1, 0.35]

describe('highest-probability policy', () => {
  it('chooses the action mapped from the most probable category', () => {
    expect(chooseAction(HIGHEST, CLEARLY_RED)).toBe('pick')
    expect(chooseAction(HIGHEST, CLEARLY_GREEN)).toBe('decline')
    expect(chooseAction(HIGHEST, CLEARLY_WORMY)).toBe('decline')
  })

  it('follows the mapping rather than assuming red means pick', () => {
    const inverted = { ...HIGHEST, categoryActions: { red: 'decline', green: 'pick', wormy: 'decline' } }
    expect(chooseAction(inverted, CLEARLY_RED)).toBe('decline')
    expect(chooseAction(inverted, CLEARLY_GREEN)).toBe('pick')
  })

  it('picks a reddish wormy apple, which is the over-regularized mistake', () => {
    expect(chooseAction(HIGHEST, REDDISH_BUT_WORMY)).toBe('pick')
  })

  it('breaks a tie towards the earliest declared category', () => {
    expect(chooseAction(HIGHEST, [0.5, 0.5, 0])).toBe('pick')
    expect(chooseAction(HIGHEST, [0, 0.5, 0.5])).toBe('decline')
  })
})

describe('threshold policy', () => {
  it('chooses a category action once that category clears its threshold', () => {
    const task = threshold({ red: 0.6, green: 0.9, wormy: 0.9 })
    expect(chooseAction(task, CLEARLY_RED)).toBe('pick')
  })

  it('treats a probability exactly at the threshold as clearing it', () => {
    const task = threshold({ red: 0.9, green: 0.99, wormy: 0.99 })
    expect(chooseAction(task, CLEARLY_RED)).toBe('pick')
  })

  it('falls back when no category clears its threshold', () => {
    const task = threshold({ red: 0.95, green: 0.95, wormy: 0.95 }, 'decline')
    expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('decline')
  })

  it('uses the declared fallback action, whatever it is', () => {
    const task = threshold({ red: 0.95, green: 0.95, wormy: 0.95 }, 'pick')
    expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('pick')
  })

  it('breaks a multi-category clear towards the earliest declared category', () => {
    // red 0.55 and wormy 0.35 both clear; red is declared first, so pick wins.
    const task = threshold({ red: 0.5, green: 0.5, wormy: 0.3 })
    expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('pick')

    // Same distribution, but now only wormy clears.
    const stricter = threshold({ red: 0.6, green: 0.5, wormy: 0.3 })
    expect(chooseAction(stricter, REDDISH_BUT_WORMY)).toBe('decline')
  })

  it('never increases an action count when that category threshold is raised', () => {
    const images = [CLEARLY_RED, CLEARLY_GREEN, CLEARLY_WORMY, REDDISH_BUT_WORMY, [0.7, 0.2, 0.1]]
    const picksAt = (redThreshold: number): number => {
      const task = threshold({ red: redThreshold, green: 0.99, wormy: 0.99 })
      return images.filter((image) => chooseAction(task, image) === 'pick').length
    }
    let previous = picksAt(0)
    for (const level of [0.1, 0.3, 0.5, 0.6, 0.75, 0.85, 0.95, 1]) {
      const current = picksAt(level)
      expect(current, `raising the red threshold to ${level} must not increase picks`).toBeLessThanOrEqual(previous)
      previous = current
    }
  })
})

describe('cost-optimal policy', () => {
  it('computes expected payoff from the distribution and the payoff table', () => {
    // red 0.9 * 1.00 + green 0.05 * -0.20 + wormy 0.05 * -2.00 = 0.79
    expect(expectedPayoff(COST_OPTIMAL, CLEARLY_RED, 'pick')).toBeCloseTo(0.79, 10)
    expect(expectedPayoff(COST_OPTIMAL, CLEARLY_RED, 'decline')).toBeCloseTo(0, 10)
  })

  it('picks when the expected payoff of picking is positive', () => {
    expect(chooseAction(COST_OPTIMAL, CLEARLY_RED)).toBe('pick')
  })

  it('lets an asymmetric penalty override the most likely category', () => {
    // red is the most likely category at 0.55, so highest-probability picks.
    expect(chooseAction(HIGHEST, REDDISH_BUT_WORMY)).toBe('pick')
    // But 0.55 * 1.00 + 0.10 * -0.20 + 0.35 * -2.00 = -0.17, so declining wins.
    expect(expectedPayoff(COST_OPTIMAL, REDDISH_BUT_WORMY, 'pick')).toBeLessThan(0)
    expect(chooseAction(COST_OPTIMAL, REDDISH_BUT_WORMY)).toBe('decline')
  })

  it('declines a clearly wormy apple', () => {
    expect(chooseAction(COST_OPTIMAL, CLEARLY_WORMY)).toBe('decline')
  })

  it('breaks a tie towards the earliest declared action', () => {
    const flat = { ...COST_OPTIMAL, payoffs: { red: { pick: 0, decline: 0 }, green: { pick: 0, decline: 0 }, wormy: { pick: 0, decline: 0 } } }
    expect(chooseAction(flat, CLEARLY_RED)).toBe('pick')
  })
})

describe('policy is live over frozen data', () => {
  it('changes the chosen action without any prediction changing', () => {
    const chosen = [HIGHEST, COST_OPTIMAL].map((task) => chooseAction(task, REDDISH_BUT_WORMY))
    expect(chosen).toEqual(['pick', 'decline'])
  })

  it('refuses a distribution that does not cover every declared category', () => {
    expect(() => chooseAction(HIGHEST, [0.5, 0.5])).toThrow(MalformedDistributionError)
    expect(() => chooseAction(HIGHEST, [0.25, 0.25, 0.25, 0.25])).toThrow(MalformedDistributionError)
  })

  it('refuses a distribution that is not a distribution', () => {
    expect(() => chooseAction(HIGHEST, [0.5, 0.2, 0.1])).toThrow(/sum to/)
    expect(() => chooseAction(HIGHEST, [1.5, -0.5, 0])).toThrow(/between 0 and 1/)
  })
})
