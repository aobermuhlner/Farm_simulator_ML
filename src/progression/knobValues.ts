/**
 * Every value a knob declares, enumerated.
 *
 * A choice knob already lists its values; a slider states a range and a step, and the
 * values between them have to be walked. Both are needed here because a catalog names
 * values of either kind, and because the coverage check has to enumerate the
 * configurations a purchase would reach.
 *
 * The walk is by index rather than by repeated addition, so a step of 0.1 does not drift
 * a hundredth of a step per value and land outside the range it was given.
 */

import type { KnobDeclaration } from '../task/types.js'

/** The values `knob` permits, in declared order. */
export function declaredValues(knob: KnobDeclaration): readonly (string | number)[] {
  if (knob.kind === 'choice') return knob.values

  const steps = Math.floor((knob.max - knob.min) / knob.step + 1e-9)
  const values: number[] = []
  for (let index = 0; index <= steps; index += 1) {
    values.push(Number((knob.min + index * knob.step).toFixed(10)))
  }
  return values
}

/**
 * A key that tells one declared value from another, types included.
 *
 * `0.2` and `"0.2"` are different values to a knob — `knobPermits` compares with
 * `includes` — so a key that flattened them would let two items open "the same thing"
 * without opening the same thing.
 */
export function valueKey(value: string | number): string {
  return `${typeof value}:${String(value)}`
}
