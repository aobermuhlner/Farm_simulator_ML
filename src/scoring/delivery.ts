/**
 * What a delivery is worth once the buyer has opened the crates.
 *
 * A second step over a scored batch rather than something inside the scoring, and that
 * separation is the design. Scoring stays the payoff sum — one price per image, the same
 * table the report is built from — and the term is a function of the counts that sum
 * produced. So a task that declares no term is valued by code that never runs, and the
 * arithmetic the report shows is arithmetic a reader can follow: a gross, a deduction,
 * and what was paid.
 *
 * The term is what makes a rare category worth more than the sum of its images. A price
 * list that can be reasoned about one image at a time can be hill-climbed one image at a
 * time, and the mistake a student most needs to make and see corrected is exactly the
 * greedy one — *this one is probably fine, crate it*. Once a share of the delivery is
 * measured against a threshold, the last image over the line costs the value of every
 * image beside it.
 *
 * Nothing here knows what any category or action means. `measures`, `delivering` and the
 * three numbers are declared data, checked against the task's own vocabulary at load, so
 * a lesson measuring something else is priced by this same function.
 */

import type { ActionId, CategoryId, TaskDeclaration } from '../task/types.js'

/** A scored batch, in the only terms a delivery term reads it by. */
export interface DeliveredBatch {
  /** The payoff sum over every image of the batch. */
  readonly earnings: number
  /** Count of images per true category and chosen action. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
}

/**
 * What a batch grossed, what the term took off it, and what it finally paid.
 *
 * The fields a term produces are absent rather than zeroed for a task that declares none.
 * A share of zero and no share at all are different claims, and a report that could not
 * tell them apart would state the first while meaning the second.
 */
export interface DeliveryValuation {
  /** The payoff sum, before any term. */
  readonly gross: number
  /** What the harvest pays. Equal to the gross when nothing was downgraded. */
  readonly paid: number
  /** What the downgrade took off the gross. Zero when none applied. */
  readonly downgrade: number
  /** True when the measured share reached the tolerance. */
  readonly downgraded: boolean
  /** True when the share reached the warning share but not the tolerance. */
  readonly warned: boolean
  /** Images given a delivering action. Absent when the task declares no term. */
  readonly delivered?: number
  /** How many of those were of a measured category. */
  readonly measured?: number
  /** The measured share. Absent when nothing was delivered, or no term is declared. */
  readonly share?: number
  readonly tolerance?: number
  readonly warnAbove?: number
}

/**
 * Values a scored batch under whatever delivery term its task declares.
 *
 * When the share reaches the tolerance every delivered image is paid the declared
 * downgraded value in place of its payoff entry, and every image given some other action
 * keeps its entry: the buyer is buying crates, and what was never delivered was never
 * part of the deal. With the shipped payoffs the discarded images are worth nothing
 * either way, but the rule has to be stated for a task whose non-delivering action is
 * priced.
 *
 * The tolerance is *reached*, not exceeded. A buyer who accepts one in eight rejects the
 * eighth.
 */
export function valueDelivery(
  declaration: TaskDeclaration,
  batch: DeliveredBatch,
): DeliveryValuation {
  const gross = batch.earnings
  const term = declaration.delivery
  if (term === undefined) {
    return { gross, paid: gross, downgrade: 0, downgraded: false, warned: false }
  }

  let delivered = 0
  let measured = 0
  let deliveredGross = 0

  for (const category of declaration.categories) {
    const row = batch.counts[category.id]
    if (row === undefined) continue
    for (const action of term.delivering) {
      const count = row[action] ?? 0
      if (count === 0) continue
      delivered += count
      if (term.measures.includes(category.id)) measured += count
      const payoff = declaration.payoffs[category.id]?.[action]
      if (payoff === undefined) {
        throw new Error(
          `Payoff table of task "${declaration.id}" has no value for category ` +
            `"${category.id}" and action "${action}".`,
        )
      }
      deliveredGross += payoff * count
    }
  }

  const common = {
    gross,
    delivered,
    measured,
    tolerance: term.tolerance,
    warnAbove: term.warnAbove,
  }

  // Nothing delivered is not a breach, and it is not a faultless delivery either: there
  // is no share to report, because the share has nothing to be a share of.
  if (delivered === 0) {
    return { ...common, paid: gross, downgrade: 0, downgraded: false, warned: false }
  }

  const share = measured / delivered
  if (share >= term.tolerance) {
    const paid = gross - deliveredGross + delivered * term.downgradedValue
    return {
      ...common,
      share,
      paid,
      downgrade: gross - paid,
      downgraded: true,
      // A downgraded delivery has been punished rather than warned. Recording both would
      // put two sentences about the same share on a screen that shows them in one place.
      warned: false,
    }
  }

  return {
    ...common,
    share,
    paid: gross,
    downgrade: 0,
    downgraded: false,
    warned: share >= term.warnAbove,
  }
}
