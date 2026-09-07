/**
 * The best rule a student could write by hand, brute-forced, and the ladder it must not
 * invert.
 *
 * A game in which the rule a student writes by hand out-earns the network they later buy
 * teaches that hand-written rules beat learned ones. Whether that happens is a property of
 * the feature set, so it is checked where the feature set is: search the rules the
 * declared node budget allows, fit their thresholds on the images a student can browse,
 * score them on the harvest, and compare against the weakest configuration the task ships.
 *
 * All of it runs over the manifest's recorded numbers and the shipped artifact index.
 * Nothing rasterizes, which is what makes an exhaustive search affordable in the suite.
 *
 * See openspec/changes/measured-features/specs/measured-features/spec.md.
 */

import type { LoadedPool } from '../pool/index.js'
import type { ActionId, CategoryId, FeatureId, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'

/**
 * How many thresholds per feature the search tries.
 *
 * Candidate cuts are the midpoints between adjacent observed values, subsampled evenly to
 * this many. Exhaustive over a depth-3 rule and five features costs (5 * cap)^3 leaf
 * assignments, so the cap is what keeps the guard a normal test rather than a nightly job.
 * 24 is far more resolution than a student picking a number by hand has, which is the
 * standard the guard needs: it must not miss a rule a person could actually write.
 */
export const THRESHOLD_CAP = 24

/** One question in a rule: is this feature above this number? */
export interface RuleSplit {
  readonly feature: FeatureId
  readonly threshold: number
}

/**
 * A rule as a chain of questions with an action at every exit.
 *
 * A chain rather than a general tree, deliberately. It is the shape a person writes — "if
 * it has spots, throw it away; otherwise if it is red, crate it red; otherwise crate it
 * green" — and it is what the rule builder will offer. A balanced tree of the same node
 * count expresses more, and searching it exhaustively costs more than the guard is worth;
 * `design.md` records the budget as the thing to raise if that ever stops being true.
 */
export interface Rule {
  /** One split per node, asked in order. */
  readonly splits: readonly RuleSplit[]
  /** The action taken when a split is answered yes, one per split. */
  readonly whenAbove: readonly ActionId[]
  /** The action taken when every split is answered no. */
  readonly otherwise: ActionId
}

/** The rule in words, for a refusal that has to name it. */
export function describeRule(rule: Rule): string {
  const clauses = rule.splits.map(
    (split, index) =>
      `if ${split.feature} > ${split.threshold.toFixed(4)} then ${rule.whenAbove[index]}`,
  )
  return [...clauses, `otherwise ${rule.otherwise}`].join('; ')
}

/** The action a rule takes on one image. */
export function applyRule(
  rule: Rule,
  features: Readonly<Record<string, number>>,
): ActionId {
  for (const [index, split] of rule.splits.entries()) {
    const value = features[split.feature]
    if (value !== undefined && value > split.threshold) return rule.whenAbove[index] as ActionId
  }
  return rule.otherwise
}

/** Candidate thresholds for one feature: midpoints between adjacent observed values. */
export function candidateThresholds(
  values: readonly number[],
  cap: number = THRESHOLD_CAP,
): readonly number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  const midpoints: number[] = []
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    midpoints.push(((sorted[i] as number) + (sorted[i + 1] as number)) / 2)
  }
  if (midpoints.length <= cap) return midpoints
  const sampled = new Set<number>()
  for (let i = 0; i < cap; i += 1) {
    sampled.add(midpoints[Math.floor(((i + 0.5) * midpoints.length) / cap)] as number)
  }
  return [...sampled]
}

/** What a rule or a model scored, overall and per declared category. */
export interface Score {
  readonly overall: number
  readonly perCategory: Readonly<Record<CategoryId, number>>
}

/**
 * The share of images given the action their category calls for, overall and per category.
 *
 * The same measure for a rule and for a network — which is the point, since the guard
 * compares the two. It is also the measure the report already breaks a harvest down by,
 * so a figure the guard refuses on is a figure a student could see.
 */
export function scoreActions(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  imageIds: readonly string[],
  actionFor: (imageId: string) => ActionId,
): Score {
  const hits: Record<CategoryId, number> = {}
  const totals: Record<CategoryId, number> = {}
  for (const category of declaration.categories) {
    hits[category.id] = 0
    totals[category.id] = 0
  }

  let correct = 0
  for (const id of imageIds) {
    const category = pool.images[id]?.category
    if (category === undefined) continue
    totals[category] = (totals[category] ?? 0) + 1
    if (actionFor(id) === declaration.categoryActions[category]) {
      hits[category] = (hits[category] ?? 0) + 1
      correct += 1
    }
  }

  const perCategory: Record<CategoryId, number> = {}
  for (const category of declaration.categories) {
    const total = totals[category.id] ?? 0
    perCategory[category.id] = total === 0 ? 0 : (hits[category.id] ?? 0) / total
  }
  return { overall: imageIds.length === 0 ? 0 : correct / imageIds.length, perCategory }
}

/** What one shipped configuration scored on the harvest. */
export interface ModelScore extends Score {
  readonly configurationId: string
}

/**
 * The weakest shipped configuration: the one scoring lowest overall on the harvest.
 *
 * Lowest *overall*, and then compared per category as well, rather than taking the
 * per-category minimum across configurations. A floor assembled from three different
 * models' worst categories is a model nobody trained, and the ladder is about the
 * configuration a student actually buys first.
 */
export function weakestModel(scores: readonly ModelScore[]): ModelScore {
  const weakest = [...scores].sort(
    (a, b) => a.overall - b.overall || a.configurationId.localeCompare(b.configurationId),
  )[0]
  if (weakest === undefined) throw new Error('the task ships no trained configuration to compare against')
  return weakest
}

/**
 * Refuses a feature set over which a hand-written rule beats the weakest shipped model.
 *
 * "Beats" means scoring strictly higher, which is the requirement's own wording — it
 * forbids the rule scoring *higher*, not matching. That distinction is load-bearing here
 * rather than pedantic: every shipped network already scores 100% on green apples, so a
 * clause reading "strictly below on every category" could only be satisfied by a feature
 * set that cannot tell a green apple from a red one.
 */
export function ladderIssues(
  declaration: TaskDeclaration,
  rule: Rule,
  harvest: Score,
  model: ModelScore,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (harvest.overall > model.overall) {
    issues.push({
      code: 'ladder-inverted',
      field: 'features',
      message: `The best hand rule within the declared budget (${describeRule(rule)}) scores ${harvest.overall.toFixed(3)} on the harvest, above the weakest shipped model "${model.configurationId}" at ${model.overall.toFixed(3)}.`,
    })
  }
  for (const category of declaration.categories) {
    const mine = harvest.perCategory[category.id] ?? 0
    const theirs = model.perCategory[category.id] ?? 0
    if (mine > theirs) {
      issues.push({
        code: 'ladder-inverted',
        field: `features.${category.id}`,
        message: `The best hand rule within the declared budget (${describeRule(rule)}) scores ${mine.toFixed(3)} on category "${category.id}", above the weakest shipped model "${model.configurationId}" at ${theirs.toFixed(3)}.`,
      })
    }
  }
  return issues
}

/** The rule that scored best on the images its thresholds were fitted against. */
export interface FittedRule {
  readonly rule: Rule
  readonly fitted: Score
}

/**
 * The best rule within the declared node budget, fitted on the images a student browses.
 *
 * Exhaustive, and cheap enough to be exhaustive because of two things.
 *
 * The leaves are not searched. A rule's leaves partition the images, so whichever action
 * is right most often among the images reaching a leaf is that leaf's best action
 * independently of every other leaf — enumerating the 3^4 assignments would recompute
 * that answer eighty times over.
 *
 * The splits are searched by partitioning rather than by re-scoring. Every rule beginning
 * with the same first question sends the same images down the same side of it, so the
 * search walks the chain once and carries the shrinking remainder with it, instead of
 * running each of the millions of rules over all 160 images.
 *
 * Rules of every size up to the budget are considered, because a smaller rule often
 * scores the same and is the one a student would write. Ties break towards the rule found
 * first, which is the shortest and then the earliest in declaration order — so the answer
 * does not depend on iteration order in any way a reader cannot follow.
 */
export function bestRule(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  fittedIds: readonly string[] = pool.roles.fitted,
  cap: number = THRESHOLD_CAP,
): FittedRule {
  const categories = declaration.categories.map((category) => category.id)
  const actions = declaration.actions.map((action) => action.id)
  const categoryOf = fittedIds.map((id) => categories.indexOf(pool.images[id]?.category ?? ''))

  // For each action, which categories it is the declared answer for. A leaf's score is
  // the count of images in it whose category maps to the action chosen there.
  const answers = actions.map((action) =>
    categories.map((category) => declaration.categoryActions[category] === action),
  )

  const splits: RuleSplit[] = []
  const above: Uint8Array[] = []
  for (const feature of declaration.features) {
    const column = fittedIds.map((id) => pool.images[id]?.features[feature.id] ?? Number.NaN)
    for (const threshold of candidateThresholds(column, cap)) {
      const flags = new Uint8Array(fittedIds.length)
      for (let i = 0; i < column.length; i += 1) flags[i] = (column[i] as number) > threshold ? 1 : 0
      splits.push({ feature: feature.id, threshold })
      above.push(flags)
    }
  }

  /** The best action for a set of images, and how many of them it gets right. */
  function bestLeaf(members: readonly number[]): { action: number; hits: number } {
    const counts = new Array<number>(categories.length).fill(0)
    for (const i of members) {
      const category = categoryOf[i] as number
      if (category >= 0) counts[category] = (counts[category] as number) + 1
    }
    let action = 0
    let hits = -1
    for (let a = 0; a < actions.length; a += 1) {
      let total = 0
      for (let c = 0; c < categories.length; c += 1) {
        if ((answers[a] as boolean[])[c] === true) total += counts[c] as number
      }
      if (total > hits) {
        hits = total
        action = a
      }
    }
    return { action, hits }
  }

  const budget = declaration.ruleBudget.maxNodes
  let bestHits = -1
  let bestChain: RuleSplit[] = []
  let bestActions: number[] = []

  const all = fittedIds.map((_, index) => index)

  /** Walks one more question onto the chain, carrying the images that reached it. */
  function extend(remaining: readonly number[], chain: number[], leafActions: number[], hits: number): void {
    const tail = bestLeaf(remaining)
    if (hits + tail.hits > bestHits) {
      bestHits = hits + tail.hits
      bestChain = chain.map((index) => splits[index] as RuleSplit)
      bestActions = [...leafActions, tail.action]
    }
    if (chain.length >= budget) return

    for (let s = 0; s < splits.length; s += 1) {
      const flags = above[s] as Uint8Array
      const taken: number[] = []
      const rest: number[] = []
      for (const i of remaining) (flags[i] === 1 ? taken : rest).push(i)
      // A question nothing answers yes to, or that everything answers yes to, is the same
      // rule with one fewer node — already covered, and worth not recursing into.
      if (taken.length === 0 || rest.length === 0) continue
      const leaf = bestLeaf(taken)
      chain.push(s)
      leafActions.push(leaf.action)
      extend(rest, chain, leafActions, hits + leaf.hits)
      leafActions.pop()
      chain.pop()
    }
  }

  extend(all, [], [], 0)

  const rule: Rule = {
    splits: bestChain,
    whenAbove: bestActions.slice(0, bestChain.length).map((index) => actions[index] as ActionId),
    otherwise: actions[bestActions[bestChain.length] as number] as ActionId,
  }
  return {
    rule,
    fitted: scoreActions(declaration, pool, fittedIds, (id) =>
      applyRule(rule, pool.images[id]?.features ?? {}),
    ),
  }
}
