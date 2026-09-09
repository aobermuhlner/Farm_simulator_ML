/**
 * The best rule a student could write by hand, brute-forced, and where it stands against
 * the models the task ships.
 *
 * That standing is a measurement rather than a property. It moves when the pool moves,
 * when a configuration is added, when the node budget grows, and it is *meant* to move
 * when the change that makes learned features necessary lands — so nothing here refuses a
 * feature set on the direction the comparison happens to point. What it does is produce
 * the figures, in both currencies a reader might ask in, and refuse any figure that has
 * moved since it was recorded. Movement is allowed; silent movement is not.
 *
 * All of it runs over the manifest's recorded numbers and the shipped artifact index.
 * Nothing rasterizes, which is what makes an exhaustive search affordable in the suite.
 *
 * See openspec/changes/measured-features/specs/measured-features/spec.md.
 */

import type { LoadedPool } from '../pool/index.js'
import type { DeliveredBatch } from '../scoring/delivery.js'
import type { CropImage } from '../sorting/crop.js'
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
 * The same measure for a rule and for a network — which is the point, since the recording
 * compares the two. It is also the measure the report already breaks a harvest down by, so
 * a figure recorded here is a figure a student could see.
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

/** What one shipped configuration scored on the evaluation split. */
export interface ModelScore extends Score {
  readonly configurationId: string
}

/**
 * What a rule made of a year's crop, in the only terms a delivery term reads a batch by.
 *
 * The same shape `scoreCrop` hands `valueDelivery` for a trained configuration, built from
 * the rule's decisions instead of from stored probabilities — so the rule's earnings and a
 * network's are the same arithmetic over the same payoff table, and neither side gets its
 * own definition of what a year pays. A picture standing for several pieces of a large crop
 * is decided the same way each time and counted once per piece, which is what a crop means
 * by a piece.
 */
export function ruleBatch(
  declaration: TaskDeclaration,
  pool: LoadedPool,
  pieces: readonly CropImage[],
  rule: Rule,
): DeliveredBatch {
  const counts: Record<CategoryId, Record<ActionId, number>> = {}
  for (const category of declaration.categories) {
    const row: Record<ActionId, number> = {}
    for (const action of declaration.actions) row[action.id] = 0
    counts[category.id] = row
  }

  let earnings = 0
  for (const piece of pieces) {
    const action = applyRule(rule, pool.images[piece.imageId]?.features ?? {})
    const payoff = declaration.payoffs[piece.category]?.[action]
    if (payoff === undefined) {
      throw new Error(
        `Payoff table of task "${declaration.id}" has no value for category ` +
          `"${piece.category}" and action "${action}".`,
      )
    }
    earnings += payoff
    const row = counts[piece.category]
    if (row !== undefined) row[action] = (row[action] ?? 0) + 1
  }

  return { earnings, counts }
}

/** One line of the comparison: what the rule got, what a configuration got, and the gap. */
export interface LadderRow {
  readonly configurationId: string
  /** What was compared — the overall score, or one declared category's. */
  readonly figure: string
  readonly rule: number
  readonly model: number
  /** The rule's figure less the configuration's. Positive means the rule is ahead. */
  readonly margin: number
}

/**
 * Where the best hand rule stands against every configuration the task ships.
 *
 * A report, and nothing more: it names no winner and refuses nothing. Which way the margins
 * point is a fact about this pool and these three networks, and it is expected to reverse
 * when the change that authors harder pixels lands — see `design.md`, where the refusal
 * this replaced is argued out. What this capability owes is the number, recorded so that a
 * change moving it has to say so.
 */
export function ladderComparison(
  declaration: TaskDeclaration,
  ruleScore: Score,
  models: readonly ModelScore[],
): readonly LadderRow[] {
  const rows: LadderRow[] = []
  for (const model of models) {
    rows.push({
      configurationId: model.configurationId,
      figure: 'overall',
      rule: ruleScore.overall,
      model: model.overall,
      margin: ruleScore.overall - model.overall,
    })
    for (const category of declaration.categories) {
      const mine = ruleScore.perCategory[category.id] ?? 0
      const theirs = model.perCategory[category.id] ?? 0
      rows.push({
        configurationId: model.configurationId,
        figure: category.id,
        rule: mine,
        model: theirs,
        margin: mine - theirs,
      })
    }
  }
  return rows
}

/**
 * Refuses every recorded figure that no longer measures what it was recorded at.
 *
 * The pin, and the whole of what replaced the ladder refusal. A figure that moved is named
 * with both values, so the change that moved it can see what it did. A figure measured but
 * never recorded, or recorded and no longer measured, is refused as well — which is what
 * makes adding or dropping a configuration re-record the table rather than quietly resize
 * it.
 *
 * Compared exactly, so a caller rounds to the precision it means to hold before handing the
 * figures in. A tolerance in here would be a second acceptance criterion that nobody
 * declared.
 */
export function pinIssues(
  recorded: Readonly<Record<string, number>>,
  measured: Readonly<Record<string, number>>,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const figure of Object.keys(recorded).sort()) {
    const now = measured[figure]
    if (now === undefined) {
      issues.push({
        code: 'figure-not-measured',
        field: figure,
        message: `Figure "${figure}" is recorded at ${recorded[figure]} and is no longer measured.`,
      })
      continue
    }
    if (now !== recorded[figure]) {
      issues.push({
        code: 'figure-moved',
        field: figure,
        message: `Figure "${figure}" is recorded at ${recorded[figure]} and measures ${now}.`,
      })
    }
  }
  for (const figure of Object.keys(measured).sort()) {
    if (recorded[figure] === undefined) {
      issues.push({
        code: 'figure-not-recorded',
        field: figure,
        message: `Figure "${figure}" measures ${measured[figure]} and has not been recorded.`,
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
