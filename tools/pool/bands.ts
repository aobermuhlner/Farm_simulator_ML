/**
 * Band containment, in one place.
 *
 * The generator uses it to draw inside a band; the checks in `test/` use it to assert
 * the committed manifest still sits where `design.md` says it does. Sharing the
 * predicate is deliberate — two implementations of "inside the fitted band" would
 * eventually disagree, and the disagreement would look like a passing test.
 */

import { BAND_ATTRIBUTES, FITTED_RED, type Band } from './params.js'

/** The four appearance attributes a band constrains, plus the worm. */
export interface ImageAttributes {
  readonly hue: number
  readonly roundness: number
  readonly gloss: number
  readonly lighting: number
  readonly wormVisibility: number
}

/** True when every band attribute of `attributes` lies inside `band`. */
export function insideBand(attributes: ImageAttributes, band: Band): boolean {
  return BAND_ATTRIBUTES.every((attribute) => {
    const value = attributes[attribute]
    return value >= band[attribute].min && value <= band[attribute].max
  })
}

/** True for an apple that could have come from the fitted red band. */
export function insideFittedRedBand(attributes: ImageAttributes): boolean {
  return insideBand(attributes, FITTED_RED)
}
