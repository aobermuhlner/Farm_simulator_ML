/**
 * A year part way in: what each of the farm's crops has brought in, before any of it is
 * money.
 *
 * `recordHarvest` settles one total, appends one record and advances the year as a single
 * indivisible step, because two crops of one farm cannot stand at different years. With
 * more than one card that step can no longer happen per card, so what a card brings in is
 * held here — outside the balance, outside the ledger and outside the year — until every
 * card the farm can play has been brought in.
 *
 * Nothing here credits, debits or advances anything. That is the whole point: a year
 * abandoned half brought in leaves the farm exactly as it was, because nothing this
 * module does can change it. Closing is the one function that reaches `recordHarvest`,
 * and it does it once.
 *
 * Amounts are whole units, the way `Farm` holds them. The one crossing from the decimal
 * amounts the declarations write belongs to `toUnits`, and doing it again here would make
 * two places that could disagree.
 *
 * See openspec/changes/workshop-harvest-split/design.md — decision 6.
 */

import type { ActionId, CategoryId } from '../task/types.js'
import type { Farm } from './farm.js'
import { recordHarvest } from './farm.js'

/**
 * What one card's crop came to, and who brought it in.
 *
 * `configurationId` is absent for a crop the farm's own hands brought in — there is no
 * configuration to name, and inventing one would put a model's name on a student's work.
 * The counts are the aggregate a report renders and no finer: a hand-sorted card's
 * per-image decisions are the student's, and `manual-sorting` forbids persisting them.
 */
export interface CropBroughtIn {
  readonly taskId: string
  /** The configuration that brought it in; absent when the farm's hands did. */
  readonly configurationId?: string
  /** What this card paid, in whole units. Signed: a crop may cost more than it returns. */
  readonly paidUnits: number
  /** How many pieces were decided about. */
  readonly evaluated: number
  /** Count per declared true category and declared action. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
}

/** A year that has been run and not yet closed. */
export interface YearInProgress {
  readonly year: number
  readonly brought: readonly CropBroughtIn[]
}

/** A year that closed, and what each of its cards did. Kept for the report on each card. */
export interface ClosedYear {
  readonly year: number
  readonly brought: readonly CropBroughtIn[]
}

/** The farm's current year, opened as in progress with nothing brought in yet. */
export function openYear(farm: Farm): YearInProgress {
  return { year: farm.year, brought: [] }
}

/**
 * One card's crop recorded against the year in progress.
 *
 * Replaces an earlier entry for the same card rather than appending a second, so a card
 * cannot be counted twice however a caller arrived at it.
 */
export function bringIn(year: YearInProgress, crop: CropBroughtIn): YearInProgress {
  return {
    year: year.year,
    brought: [...year.brought.filter((entry) => entry.taskId !== crop.taskId), crop],
  }
}

/** What one card brought in this year, or undefined when it has not been brought in. */
export function broughtIn(
  year: YearInProgress | undefined,
  taskId: string,
): CropBroughtIn | undefined {
  return year?.brought.find((entry) => entry.taskId === taskId)
}

/** The playable cards still to be brought in, in the order they were given. */
export function outstanding(
  year: YearInProgress | undefined,
  playable: readonly string[],
): readonly string[] {
  if (year === undefined) return [...playable]
  return playable.filter((taskId) => broughtIn(year, taskId) === undefined)
}

/** True when every playable card has been brought in, so the year can close. */
export function isComplete(
  year: YearInProgress | undefined,
  playable: readonly string[],
): boolean {
  return year !== undefined && outstanding(year, playable).length === 0
}

/** What the year has brought in so far, in whole units. Not money until the year closes. */
export function totalPaid(year: YearInProgress | undefined): number {
  return (year?.brought ?? []).reduce((total, entry) => total + entry.paidUnits, 0)
}

/**
 * Closes the year: one settlement, one record, one advance.
 *
 * The total across every card goes through `recordHarvest` unchanged, so the requirement
 * that only a harvest closes a year rests on the one function that already implements it
 * rather than on this one remembering to do the same three things in the same order.
 */
export function closeYear(
  farm: Farm,
  year: YearInProgress,
): { readonly farm: Farm; readonly closed: ClosedYear } {
  return {
    farm: recordHarvest(farm, totalPaid(year)),
    closed: { year: year.year, brought: [...year.brought] },
  }
}
