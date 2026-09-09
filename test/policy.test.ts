import { describe, expect, it } from 'vitest'
import {
  chooseAction,
  expectedPayoff,
  MalformedDistributionError,
} from '../src/policy/index.js'
import type { TaskDeclaration } from '../src/task/types.js'
import { validateDeclaration } from '../src/task/validate.js'
import { appleDeclaration } from './helpers/apple'

const apple = appleDeclaration()

/** The apple task with a different declared policy. */
function withPolicy(policy: TaskDeclaration['policy']): TaskDeclaration {
  return { ...apple, policy }
}

const HIGHEST = withPolicy({ kind: 'highest-probability' })
const COST_OPTIMAL = withPolicy({ kind: 'cost-optimal' })

/** Declared category order, which is the artifact's vector order and never a priority. */
const DECLARED_ORDER = ['red', 'green', 'wormy']

function threshold(
  thresholds: Record<string, number>,
  fallbackAction = 'discard',
  priority: string[] = DECLARED_ORDER,
): TaskDeclaration {
  return withPolicy({ kind: 'threshold', thresholds, fallbackAction, priority })
}

// Distributions are indexed [red, green, wormy] in declared category order.
const CLEARLY_RED = [0.9, 0.05, 0.05]
const CLEARLY_GREEN = [0.1, 0.8, 0.1]
const CLEARLY_WORMY = [0.05, 0.15, 0.8]
const REDDISH_BUT_WORMY = [0.55, 0.1, 0.35]
/** Red or green, no telling which, and almost certainly not wormy. */
const RED_OR_GREEN = [0.45, 0.45, 0.1]
/**
 * Most likely red, and wormy often enough that the fine outweighs the sale.
 *
 * Its own distribution rather than a reuse of REDDISH_BUT_WORMY, because how far the
 * probabilities have to part company before an asymmetric price overrides the most likely
 * category is a function of the declared table, and this file's other tests are about
 * rules that do not read the table at all. Held apart so a retuned table moves one
 * constant rather than every threshold test in the suite.
 */
const RED_BUT_OFTEN_WORMY = [0.5, 0.05, 0.45]

describe('highest-probability policy', () => {
  it('chooses the action mapped from the most probable category', () => {
    expect(chooseAction(HIGHEST, CLEARLY_RED)).toBe('crate-red')
    expect(chooseAction(HIGHEST, CLEARLY_GREEN)).toBe('crate-green')
    expect(chooseAction(HIGHEST, CLEARLY_WORMY)).toBe('discard')
  })

  it('follows the mapping rather than assuming red means the red crate', () => {
    const inverted = {
      ...HIGHEST,
      categoryActions: { red: 'crate-green', green: 'crate-red', wormy: 'discard' },
    }
    expect(chooseAction(inverted, CLEARLY_RED)).toBe('crate-green')
    expect(chooseAction(inverted, CLEARLY_GREEN)).toBe('crate-red')
  })

  it('crates a reddish wormy apple, which is the over-regularized mistake', () => {
    expect(chooseAction(HIGHEST, REDDISH_BUT_WORMY)).toBe('crate-red')
  })

  it('breaks a tie towards the earliest declared category', () => {
    // A tie is an accident of the numbers rather than a declared intent, so the rule only
    // has to be deterministic — which is why this one keeps the declared category order.
    expect(chooseAction(HIGHEST, RED_OR_GREEN)).toBe('crate-red')
    expect(chooseAction(HIGHEST, [0, 0.5, 0.5])).toBe('crate-green')
  })
})

describe('threshold policy', () => {
  it('chooses a category action once that category clears its threshold', () => {
    const task = threshold({ red: 0.6, green: 0.9, wormy: 0.9 })
    expect(chooseAction(task, CLEARLY_RED)).toBe('crate-red')
  })

  it('treats a probability exactly at the threshold as clearing it', () => {
    const task = threshold({ red: 0.9, green: 0.99, wormy: 0.99 })
    expect(chooseAction(task, CLEARLY_RED)).toBe('crate-red')
  })

  it('falls back when no category clears its threshold', () => {
    const task = threshold({ red: 0.95, green: 0.95, wormy: 0.95 }, 'discard')
    expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('discard')
  })

  it('uses the declared fallback action, whatever it is', () => {
    const task = threshold({ red: 0.95, green: 0.95, wormy: 0.95 }, 'crate-green')
    expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('crate-green')
  })

  it('lets the declared priority decide between two categories that both clear', () => {
    // red 0.55 and wormy 0.35 both clear, and with three actions they no longer point at
    // the same one: the tie-break is now the choice of action itself.
    const thresholds = { red: 0.5, green: 0.5, wormy: 0.3 }

    expect(
      chooseAction(threshold(thresholds, 'discard', ['red', 'green', 'wormy']), REDDISH_BUT_WORMY),
    ).toBe('crate-red')
    expect(
      chooseAction(threshold(thresholds, 'discard', ['wormy', 'green', 'red']), REDDISH_BUT_WORMY),
    ).toBe('discard')
  })

  it('reverses the chosen action when only the priority order is reversed', () => {
    const thresholds = { red: 0.5, green: 0.5, wormy: 0.3 }
    const forwards = threshold(thresholds, 'discard', [...DECLARED_ORDER])
    const backwards = threshold(thresholds, 'discard', [...DECLARED_ORDER].reverse())

    expect(backwards.policy).toEqual({ ...forwards.policy, priority: ['wormy', 'green', 'red'] })
    expect(chooseAction(backwards, REDDISH_BUT_WORMY)).not.toBe(
      chooseAction(forwards, REDDISH_BUT_WORMY),
    )
  })

  it('lets a cautious threshold on a rare category outrank a more probable one', () => {
    // The student set the worm threshold to 0.03 to catch exactly this image. A rule that
    // handed the decision to the most probable category clearing would ignore them, and
    // the screening lesson the brief promises would be unbuildable.
    const reddishWithATraceOfWorm = [0.55, 0.4, 0.05]
    const thresholds = { red: 0.5, green: 0.99, wormy: 0.03 }

    expect(
      chooseAction(
        threshold(thresholds, 'crate-green', ['wormy', 'red', 'green']),
        reddishWithATraceOfWorm,
      ),
    ).toBe('discard')
    expect(
      chooseAction(
        threshold(thresholds, 'crate-green', ['red', 'green', 'wormy']),
        reddishWithATraceOfWorm,
      ),
    ).toBe('crate-red')
  })

  it('still falls back when nothing clears, whatever the priority order says', () => {
    for (const priority of [DECLARED_ORDER, ['wormy', 'green', 'red'], ['green', 'wormy', 'red']]) {
      const task = threshold({ red: 0.99, green: 0.99, wormy: 0.99 }, 'discard', priority)
      expect(chooseAction(task, REDDISH_BUT_WORMY)).toBe('discard')
    }
  })

  it('never increases an action count when that category threshold is raised', () => {
    const images = [CLEARLY_RED, CLEARLY_GREEN, CLEARLY_WORMY, REDDISH_BUT_WORMY, RED_OR_GREEN]
    // Three actions are in play throughout: green clears at 0.4 and wormy at 0.05, so the
    // images red stops claiming go to different places rather than all to the fallback.
    const cratedRedAt = (redThreshold: number): number => {
      const task = threshold({ red: redThreshold, green: 0.4, wormy: 0.05 }, 'discard')
      return images.filter((image) => chooseAction(task, image) === 'crate-red').length
    }

    const chosen = new Set(
      images.map((image) =>
        chooseAction(threshold({ red: 0.5, green: 0.4, wormy: 0.05 }, 'discard'), image),
      ),
    )
    expect(chosen.size, 'the property is worth little if only two actions ever occur').toBe(3)

    let previous = cratedRedAt(0)
    for (const level of [0.1, 0.3, 0.5, 0.6, 0.75, 0.85, 0.95, 1]) {
      const current = cratedRedAt(level)
      expect(
        current,
        `raising the red threshold to ${level} must not increase the red crate`,
      ).toBeLessThanOrEqual(previous)
      previous = current
    }
  })

  it('is declared with a priority order the validator insists on', () => {
    const result = validateDeclaration({
      ...apple,
      policy: {
        kind: 'threshold',
        thresholds: { red: 0.6, green: 0.5, wormy: 0.2 },
        fallbackAction: 'discard',
        priority: DECLARED_ORDER,
      },
    })
    expect(result.ok ? [] : result.issues).toEqual([])
  })
})

describe('cost-optimal policy', () => {
  it('computes expected payoff from the distribution and the payoff table', () => {
    // red 0.9 * 0.40 + green 0.05 * -0.30 + wormy 0.05 * -0.50 = 0.32
    expect(expectedPayoff(COST_OPTIMAL, CLEARLY_RED, 'crate-red')).toBeCloseTo(0.32, 10)
    // red 0.9 * 0.20 + green 0.05 * 0.20 + wormy 0.05 * -0.50 = 0.165
    expect(expectedPayoff(COST_OPTIMAL, CLEARLY_RED, 'crate-green')).toBeCloseTo(0.165, 10)
    expect(expectedPayoff(COST_OPTIMAL, CLEARLY_RED, 'discard')).toBeCloseTo(0, 10)
  })

  it('crates a clearly red apple as red', () => {
    expect(chooseAction(COST_OPTIMAL, CLEARLY_RED)).toBe('crate-red')
  })

  it('lets an asymmetric penalty override the most likely category', () => {
    // red is the most likely category at 0.50, so highest-probability crates it as red.
    expect(chooseAction(HIGHEST, RED_BUT_OFTEN_WORMY)).toBe('crate-red')
    // But 0.50 * 0.40 + 0.05 * -0.30 + 0.45 * -0.50 = -0.04, and the green crate is worse
    // still at -0.115, so throwing it away wins.
    expect(expectedPayoff(COST_OPTIMAL, RED_BUT_OFTEN_WORMY, 'crate-red')).toBeCloseTo(-0.04, 10)
    expect(expectedPayoff(COST_OPTIMAL, RED_BUT_OFTEN_WORMY, 'crate-green')).toBeCloseTo(-0.115, 10)
    expect(chooseAction(COST_OPTIMAL, RED_BUT_OFTEN_WORMY)).toBe('discard')
  })

  it('hedges into the cheaper crate rather than risking the fine', () => {
    // At (0.45, 0.45, 0.10) the model cannot tell red from green. Crating as red is worth
    // -0.005 because a green sold as red is fined; crating as green is worth +0.13,
    // because a red sold as green merely earns less. Throwing it away is worth nothing.
    expect(expectedPayoff(COST_OPTIMAL, RED_OR_GREEN, 'crate-red')).toBeCloseTo(-0.005, 10)
    expect(expectedPayoff(COST_OPTIMAL, RED_OR_GREEN, 'crate-green')).toBeCloseTo(0.13, 10)
    expect(expectedPayoff(COST_OPTIMAL, RED_OR_GREEN, 'discard')).toBeCloseTo(0, 10)
    expect(chooseAction(COST_OPTIMAL, RED_OR_GREEN)).toBe('crate-green')
  })

  it('throws away a clearly wormy apple', () => {
    expect(chooseAction(COST_OPTIMAL, CLEARLY_WORMY)).toBe('discard')
  })

  it('breaks a tie towards the earliest declared action', () => {
    // A hand-built value for a determinism test, not a declaration anyone claims would
    // load: a flat table pays every action the same, which the agreement rule refuses.
    const flat = {
      ...COST_OPTIMAL,
      payoffs: Object.fromEntries(
        COST_OPTIMAL.categories.map((category) => [
          category.id,
          Object.fromEntries(COST_OPTIMAL.actions.map((action) => [action.id, 0])),
        ]),
      ),
    }
    expect(validateDeclaration(flat).ok, 'a flat table is not a declaration that loads').toBe(false)
    expect(chooseAction(flat, CLEARLY_RED)).toBe(COST_OPTIMAL.actions[0]?.id)
  })
})

describe('policy is live over frozen data', () => {
  it('changes the chosen action without any prediction changing', () => {
    const chosen = [HIGHEST, COST_OPTIMAL].map((task) => chooseAction(task, RED_BUT_OFTEN_WORMY))
    expect(chosen).toEqual(['crate-red', 'discard'])
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
