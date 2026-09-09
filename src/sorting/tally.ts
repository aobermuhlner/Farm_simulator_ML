/**
 * What a hand sort came to: the counts, the wage, and the rate.
 *
 * The arithmetic is the same declaration the automated run is scored against — the payoff
 * table over a true category and a chosen action — so a student's own harvest and their
 * robot's are priced by one table and can be compared without a footnote. Nothing is
 * added to it here: no bonus for care, no penalty for slowness, nothing that would make
 * this screen's number mean something the report's number does not.
 *
 * Time is measured and never priced. It drives the rate, which is the argument for
 * automating the job, and a wage that paid for speed would turn a screen about judgement
 * into a reflex game — punishing exactly the student who looks twice at a faint mark.
 *
 * Amounts come back as the declaration writes them, in fractions. The one crossing into
 * the farm's whole units belongs to `src/economy/`, and doing it here would make two.
 */

import type { DeliveryValuation } from '../scoring/delivery.js'
import { valueDelivery } from '../scoring/delivery.js'
import type { ActionId, CategoryId, TaskDeclaration } from '../task/types.js'
import type { Crop } from './crop.js'

/** One decision a student made about one image. */
export interface Decision {
  readonly imageId: string
  /** The action they chose. A declared action id, whatever the task's actions are. */
  readonly action: ActionId
  /** How long that image was on screen, in milliseconds. Capped before it counts. */
  readonly elapsedMs: number
}

/** An image decided against the action its category calls for. */
export interface Mistake {
  readonly imageId: string
  readonly category: CategoryId
  /** The action the student chose. */
  readonly chosen: ActionId
  /** The action the task declares that category calls for. */
  readonly called: ActionId
}

export interface Throughput {
  /** Time spent deciding, in seconds, with every image capped at its declared maximum. */
  readonly seconds: number
  /** Images a minute at that pace. Zero when no time was measured at all. */
  readonly perMinute: number
  /** What the whole crop would take at that pace, including the part left unsorted. */
  readonly wholeCropSeconds: number
}

export interface SortOutcome {
  /** How many pieces the crop held. */
  readonly size: number
  /** How many of them the student decided. */
  readonly decided: number
  /** How many nobody reached. They earn nothing. */
  readonly unsorted: number
  readonly correct: number
  /** Count per declared true category and declared action, every combination present. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
  readonly mistakes: readonly Mistake[]
  /**
   * What the decisions actually made came to: the payoff sum, less whatever the task's
   * declared delivery term took off it.
   *
   * The term applies to a person's crates exactly as it applies to a robot's, because the
   * buyer is buying apples rather than labour. A careless sort that puts too large a share
   * of a measured category into the crates is downgraded on the same terms and by the same
   * function.
   */
  readonly wage: number
  /** What those same images would have paid, each given the action its category calls for. */
  readonly faultless: number
  /** The arithmetic behind the wage: the gross, the tolerance, the share, the downgrade. */
  readonly delivery: DeliveryValuation
  readonly throughput: Throughput
}

function emptyCounts(declaration: TaskDeclaration): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {}
  for (const category of declaration.categories) {
    const row: Record<string, number> = {}
    for (const action of declaration.actions) row[action.id] = 0
    counts[category.id] = row
  }
  return counts
}

/**
 * Measures a sort: what was decided, what it paid, and how fast it went.
 *
 * `truth` is the pool manifest's own record of what each image is, and it is the only
 * thing a decision is scored against. A decision about an image the manifest says nothing
 * about, or one naming an action the task does not declare, is a fault in the calling
 * code rather than something a student can do, so it throws rather than being counted as
 * a mistake or quietly dropped.
 */
export function measureSort(
  declaration: TaskDeclaration,
  // Only the size is read: a drawn crop satisfies this, and so does the view a screen
  // holds, without either having to be turned into the other to be measured.
  crop: Pick<Crop, 'size'>,
  truth: Readonly<Record<string, CategoryId>>,
  decisions: readonly Decision[],
): SortOutcome {
  const counts = emptyCounts(declaration)
  // What the same pieces would have been counted as under a faultless sort, so the
  // comparison figure passes through the delivery term rather than round it.
  const faultlessCounts = emptyCounts(declaration)
  const mistakes: Mistake[] = []
  let correct = 0
  let wage = 0
  let faultless = 0
  let seconds = 0

  const cap = declaration.handSorting.secondsPerImage

  for (const decision of decisions) {
    const category = truth[decision.imageId]
    if (category === undefined) {
      throw new Error(
        `The pool declares no true category for image "${decision.imageId}", so the decision about it cannot be scored.`,
      )
    }

    const row = counts[category]
    const already = row?.[decision.action]
    if (row === undefined || already === undefined) {
      throw new Error(
        `Task "${declaration.id}" declares no action "${decision.action}" for an image of "${category}".`,
      )
    }
    row[decision.action] = already + 1

    const called = declaration.categoryActions[category]
    if (called === undefined) {
      throw new Error(`Task "${declaration.id}" maps category "${category}" to no action.`)
    }
    const faultlessRow = faultlessCounts[category]
    if (faultlessRow !== undefined) faultlessRow[called] = (faultlessRow[called] ?? 0) + 1

    const paid = declaration.payoffs[category]?.[decision.action]
    const best = declaration.payoffs[category]?.[called]
    if (paid === undefined || best === undefined) {
      throw new Error(
        `Payoff table of task "${declaration.id}" has no value for category "${category}" and action "${decision.action}".`,
      )
    }
    wage += paid
    faultless += best

    if (decision.action === called) correct += 1
    else mistakes.push({ imageId: decision.imageId, category, chosen: decision.action, called })

    // A screen left standing counts for the declared maximum and no more, so one
    // interrupted image cannot make the projection for the whole crop absurd.
    seconds += Math.min(Math.max(decision.elapsedMs, 0) / 1000, cap)
  }

  const decided = decisions.length

  // The same valuation the automated harvest goes through, over the pieces the student
  // decided. A faultless sort is valued the same way rather than as a bare payoff sum, so
  // the two figures on the summary are comparable — one of them being priced by a rule the
  // other escaped is exactly the footnote this screen exists without.
  const delivery = valueDelivery(declaration, { earnings: wage, counts })
  const perfect = valueDelivery(declaration, { earnings: faultless, counts: faultlessCounts })

  return {
    size: crop.size,
    decided,
    // Derived rather than copied from the crop, so nothing a decision was not made about
    // can be counted as sorted however a caller assembled the list.
    unsorted: Math.max(crop.size - decided, 0),
    correct,
    counts,
    mistakes,
    wage: delivery.paid,
    faultless: perfect.paid,
    delivery,
    throughput: {
      seconds,
      perMinute: seconds > 0 ? (decided * 60) / seconds : 0,
      wholeCropSeconds: decided > 0 ? (seconds * crop.size) / decided : 0,
    },
  }
}
