/**
 * Turning a probability distribution into a chosen action.
 *
 * The policy is declared task data and evaluated here at run time, never baked
 * into the precomputed artifacts. That is the seam that lets the apple lesson
 * (knobs on the model side) and the later screening lesson (knobs on the policy
 * side) run on one engine: replacing a task's policy changes what the robot
 * does without regenerating a single prediction.
 *
 * See openspec/changes/task-abstraction/specs/decision-policy/spec.md.
 */

import type { ActionId, CategoryId, TaskDeclaration } from '../task/types.js'

/** Thrown when a distribution does not match the task it is being read against. */
export class MalformedDistributionError extends Error {}

/**
 * Checks a distribution against a task's declared categories. Returns a reason
 * when it does not fit, so callers can refuse loudly rather than score it.
 */
export function distributionProblem(
  declaration: TaskDeclaration,
  distribution: readonly number[],
): string | undefined {
  const expected = declaration.categories.length
  if (distribution.length !== expected) {
    return `expected one probability per declared category (${expected}), found ${distribution.length}`
  }
  for (const [index, value] of distribution.entries()) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return `probability at index ${index} is ${JSON.stringify(value)}, which is not between 0 and 1`
    }
  }
  const total = distribution.reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 1) > 1e-6) {
    return `probabilities sum to ${total}, not 1`
  }
  return undefined
}

function assertWellFormed(declaration: TaskDeclaration, distribution: readonly number[]): void {
  const problem = distributionProblem(declaration, distribution)
  if (problem !== undefined) {
    throw new MalformedDistributionError(`Distribution for task "${declaration.id}": ${problem}.`)
  }
}

function actionFor(declaration: TaskDeclaration, category: CategoryId): ActionId {
  const action = declaration.categoryActions[category]
  if (action === undefined) {
    throw new MalformedDistributionError(
      `Task "${declaration.id}" maps no action for category "${category}".`,
    )
  }
  return action
}

/** Expected payoff of one action across a distribution. */
export function expectedPayoff(
  declaration: TaskDeclaration,
  distribution: readonly number[],
  action: ActionId,
): number {
  assertWellFormed(declaration, distribution)
  return declaration.categories.reduce((sum, category, index) => {
    const cell = declaration.payoffs[category.id]?.[action]
    if (cell === undefined) {
      throw new MalformedDistributionError(
        `Payoff table of task "${declaration.id}" has no value for category "${category.id}" and action "${action}".`,
      )
    }
    return sum + (distribution[index] ?? 0) * cell
  }, 0)
}

/**
 * The action a task's declared policy chooses for one image.
 *
 * Ties break towards the earliest declared category (or action), so the same
 * distribution always yields the same action.
 */
export function chooseAction(
  declaration: TaskDeclaration,
  distribution: readonly number[],
): ActionId {
  assertWellFormed(declaration, distribution)
  const policy = declaration.policy

  switch (policy.kind) {
    case 'highest-probability': {
      let best = 0
      for (let index = 1; index < distribution.length; index += 1) {
        if ((distribution[index] ?? 0) > (distribution[best] ?? 0)) best = index
      }
      const category = declaration.categories[best]
      if (category === undefined) {
        throw new MalformedDistributionError(`Task "${declaration.id}" declares no categories.`)
      }
      return actionFor(declaration, category.id)
    }

    case 'threshold': {
      // Several categories can clear at once, and with distinct actions behind them that
      // is the choice of action itself, not a formality. The declared priority order
      // decides it — never the declared category order, which the prediction artifact's
      // vector indexing has already spoken for.
      let chosen: CategoryId | undefined
      let rank = Number.POSITIVE_INFINITY
      for (const [index, category] of declaration.categories.entries()) {
        const threshold = policy.thresholds[category.id]
        if (threshold === undefined) continue
        if ((distribution[index] ?? 0) < threshold) continue
        const place = policy.priority.indexOf(category.id)
        // A category the order does not name is a declaration the validator refuses; it
        // ranks last here rather than being dropped, so a clearing category still acts.
        const placed = place === -1 ? policy.priority.length : place
        if (placed < rank) {
          rank = placed
          chosen = category.id
        }
      }
      return chosen === undefined ? policy.fallbackAction : actionFor(declaration, chosen)
    }

    case 'cost-optimal': {
      let bestAction: ActionId | undefined
      let bestValue = Number.NEGATIVE_INFINITY
      for (const action of declaration.actions) {
        const value = expectedPayoff(declaration, distribution, action.id)
        if (value > bestValue) {
          bestValue = value
          bestAction = action.id
        }
      }
      if (bestAction === undefined) {
        throw new MalformedDistributionError(`Task "${declaration.id}" declares no actions.`)
      }
      return bestAction
    }
  }
}
