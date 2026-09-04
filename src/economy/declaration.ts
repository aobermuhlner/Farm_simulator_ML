/**
 * The farm declaration: what the currency is called, how finely money is counted,
 * and the state play opens at.
 *
 * Money is farm-wide — one balance, one year, one ledger across every task — so this
 * sits beside the task declarations rather than inside one of them. A per-task currency
 * would be a field that has to agree between tasks with nothing able to say which is
 * right when they disagree.
 *
 * Refusals take the house shape: a `ValidationIssue` list naming the field, never a
 * throw, so a farm that will not open reaches the student as the field it is missing.
 *
 * See openspec/changes/game-economy/specs/game-economy/spec.md.
 */

import type { ValidationIssue } from '../task/validate.js'

export interface FarmDeclaration {
  /** What the farm is called. Shown, never branched on. */
  readonly name: string
  /** The label every amount is presented with. Cosmetic; the arithmetic does not care. */
  readonly currency: string
  /** Decimal places money is counted to. Two for a currency with cents, zero for one without. */
  readonly precision: number
  /** The balance play opens at, in the currency's own units. */
  readonly openingBalance: number
  /** The year play opens at. */
  readonly openingYear: number
}

export type FarmValidation =
  | { readonly ok: true; readonly declaration: FarmDeclaration }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Every field the farm declaration must carry in order for the farm to open. */
export const REQUIRED_FARM_FIELDS = [
  'name',
  'currency',
  'precision',
  'openingBalance',
  'openingYear',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

/**
 * True when `amount` can be held exactly at `precision` decimal places.
 *
 * An opening balance of 100.005 in a currency counted to two decimals is an authoring
 * mistake with no right answer: rounding it silently would make the declared opening
 * state and the opening state on screen two different figures.
 */
function fitsPrecision(amount: number, precision: number): boolean {
  const scaled = amount * 10 ** precision
  return Math.abs(scaled - Math.round(scaled)) < 1e-9
}

/**
 * Validates a candidate farm declaration. On success the input is returned narrowed to
 * `FarmDeclaration`; on failure every issue found is reported, each naming its field.
 */
export function validateFarmDeclaration(input: unknown): FarmValidation {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        { code: 'malformed-declaration', message: 'A farm declaration must be an object.' },
      ],
    }
  }

  const issues: ValidationIssue[] = []

  for (const field of REQUIRED_FARM_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      issues.push({
        code: 'missing-field',
        field,
        message: `Farm declaration is missing required field "${field}".`,
      })
    }
  }

  for (const field of ['name', 'currency'] as const) {
    if (input[field] !== undefined && input[field] !== null && !isNonEmptyString(input[field])) {
      issues.push({
        code: 'malformed-field',
        field,
        message: `Field "${field}" must be a non-empty string.`,
      })
    }
  }

  const precision = input.precision
  const precisionUsable = isWholeNumber(precision) && precision >= 0
  if (precision !== undefined && precision !== null && !precisionUsable) {
    issues.push({
      code: 'malformed-field',
      field: 'precision',
      message: `Field "precision" must be a whole number of decimal places, zero or more; found ${JSON.stringify(precision)}.`,
    })
  }

  const balance = input.openingBalance
  if (balance !== undefined && balance !== null) {
    if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) {
      issues.push({
        code: 'malformed-field',
        field: 'openingBalance',
        message: `Field "openingBalance" must be a finite amount of zero or more; found ${JSON.stringify(balance)}.`,
      })
    } else if (precisionUsable && !fitsPrecision(balance, precision)) {
      issues.push({
        code: 'unrepresentable-amount',
        field: 'openingBalance',
        message: `Field "openingBalance" is ${balance}, which is finer than the declared precision of ${precision} decimal places.`,
      })
    }
  }

  const year = input.openingYear
  if (year !== undefined && year !== null && !isWholeNumber(year)) {
    issues.push({
      code: 'malformed-field',
      field: 'openingYear',
      message: `Field "openingYear" must be a whole number; found ${JSON.stringify(year)}.`,
    })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, declaration: input as unknown as FarmDeclaration }
}
