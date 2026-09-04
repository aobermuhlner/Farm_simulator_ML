/**
 * The boundary between amounts as they are written and money as it is counted.
 *
 * The payoff tables are in fractions — 0.40 a red apple — and a harvest sums tens of
 * thousands of them. Accumulating that in a float gives a balance of 4 279.999999999 and
 * comparisons against zero that are true by luck, which is no basis for "the balance
 * comes to rest at zero". So the farm counts whole units of the declared precision as
 * integers, and this module is the only place an amount crosses into them.
 *
 * The conversion is deliberately narrow: one function in, one function out. Applying it
 * twice would halve or square a figure, so the farm refuses a non-integer amount rather
 * than rounding one a second time.
 *
 * See openspec/changes/game-economy/specs/game-economy/spec.md — "Amounts are exact at
 * the declared precision".
 */

import type { FarmDeclaration } from './declaration.js'

/** The separator between groups of three digits. Declared here rather than by a locale. */
const GROUP_SEPARATOR = ' '

/**
 * The whole units of `precision` decimal places that `amount` rounds to.
 *
 * Rounding happens here and nowhere else, so the amount a movement records and the
 * amount presented for it are the same figure. Half rounds away from zero, so a loss and
 * a gain of the same size round to the same magnitude.
 *
 * The intermediate `toFixed` clears the float residue of the scaling itself: 0.404 times
 * 100 is 40.400000000000006, and 1.005 times 100 is 100.49999999999999, which would
 * otherwise round down through no fault of the author.
 */
export function toUnits(amount: number, precision: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`An amount must be a finite number; received ${JSON.stringify(amount)}.`)
  }
  if (!Number.isInteger(precision) || precision < 0) {
    throw new Error(
      `A precision must be a whole number of decimal places, zero or more; received ${JSON.stringify(precision)}.`,
    )
  }
  const scaled = Number((Math.abs(amount) * 10 ** precision).toFixed(precision + 2))
  const magnitude = Math.round(scaled)
  return amount < 0 ? -magnitude : magnitude
}

/** The amount `units` whole units come to, for a caller that needs the fraction back. */
export function toAmount(units: number, precision: number): number {
  if (!Number.isInteger(units)) {
    throw new Error(`Whole units are required; received ${JSON.stringify(units)}.`)
  }
  return Number((units / 10 ** precision).toFixed(precision))
}

/** Digits grouped in threes from the right, without consulting a locale. */
function grouped(digits: string): string {
  let out = ''
  for (let index = 0; index < digits.length; index += 1) {
    const fromRight = digits.length - index
    if (index > 0 && fromRight % 3 === 0) out += GROUP_SEPARATOR
    out += digits[index]
  }
  return out
}

/**
 * `units` presented with the farm's declared currency label.
 *
 * The label is the declared one and no other; the code has no currency of its own to
 * fall back on. Where the label sits and what separates the groups are cosmetic, and one
 * formatter settles both until a second currency exists to disagree.
 */
export function formatUnits(units: number, farm: FarmDeclaration): string {
  if (!Number.isInteger(units)) {
    throw new Error(`Whole units are required; received ${JSON.stringify(units)}.`)
  }
  const scale = 10 ** farm.precision
  const magnitude = Math.abs(units)
  const whole = grouped(String(Math.trunc(magnitude / scale)))
  const figure =
    farm.precision === 0
      ? whole
      : `${whole}.${String(magnitude % scale).padStart(farm.precision, '0')}`
  return `${farm.currency} ${units < 0 ? '-' : ''}${figure}`
}
