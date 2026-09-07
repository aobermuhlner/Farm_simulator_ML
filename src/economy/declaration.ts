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

/**
 * The share of a crop each category makes up, keyed by category id.
 *
 * Declared by the farm rather than measured from the image pool. The pool's own
 * composition is a training-data decision — a rare category is over-represented there on
 * purpose so a model can learn it — and an orchard shaped like a training set would make
 * nonsense of every rule written about what a real harvest contains.
 *
 * The shares are required to come to one, so a crop is fully described rather than
 * silently renormalised from figures whose author meant them to add up.
 */
export type CropComposition = Readonly<Record<string, number>>

/**
 * The purchase that takes a job off the student's hands.
 *
 * Named here rather than known by a screen, and it is only a reference: the item's own
 * label, price and copy stay in the catalog, so the two cannot disagree about what it
 * costs. A farm that names an item the catalog does not carry has nothing to show, and
 * shows nothing — the honest reading of "when the farm declares such a purchase".
 *
 * Optional, because a farm may have nothing on sale that would do the work yet. Its
 * absence is what makes hand sorting the only way a crop comes in.
 */
export interface FarmAutomation {
  /** The id of the catalog item that does the job. */
  readonly item: string
}

/**
 * How the farm's own labour is presented in a task's labour slot.
 *
 * Declared by the farm rather than by a model, because manual labour is the *absence* of
 * a model rather than a model: no family declaration could supply it, and a screen that
 * wrote it out would be a screen naming one particular farm's vocabulary.
 *
 * Both fields are optional and so is the whole record. A farm that declares nothing here
 * still has hands doing the work, and its slot says so with whatever it has — never as an
 * empty slot, which is the one thing a slot must never look like.
 */
export interface ManualLabourDeclaration {
  /** A short glyph shown in the slot. Presented, never branched on. */
  readonly icon?: string
  /** What to call the labour, read out on hover and to assistive technology. */
  readonly label?: string
}

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
  /**
   * How many pieces the farm's crop holds in its opening year.
   *
   * The farm's, not the task's: it is what the land bears, and it grows as the land does.
   * A task declares how much of it one person can get through.
   */
  readonly openingCrop: number
  /** What the crop is made of, as a share per category. */
  readonly cropComposition: CropComposition
  /** The purchase that would bring the crop in without hands, where the farm has one. */
  readonly automation?: FarmAutomation
  /** How the farm's own hands are presented in a labour slot. */
  readonly manualLabour?: ManualLabourDeclaration
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
  'openingCrop',
  'cropComposition',
] as const

/** Every field the farm declaration may carry but need not. */
export const OPTIONAL_FARM_FIELDS = ['automation', 'manualLabour'] as const

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
 * Validates the crop's composition: a share per category, all positive, coming to one.
 *
 * A composition that does not come to one has no right reading. Scaling it up would
 * quietly change every share the author wrote; taking it at face value would leave part
 * of the crop belonging to no category at all. Both are worse than saying so.
 */
function checkCropComposition(composition: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(composition)) {
    issues.push({
      code: 'malformed-field',
      field: 'cropComposition',
      message: 'Field "cropComposition" must be an object of category shares.',
    })
    return
  }

  const entries = Object.entries(composition)
  if (entries.length === 0) {
    issues.push({
      code: 'malformed-field',
      field: 'cropComposition',
      message: 'Field "cropComposition" declares no categories, so the crop is made of nothing.',
    })
    return
  }

  let total = 0
  let usable = true
  for (const [category, share] of entries) {
    if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0) {
      usable = false
      issues.push({
        code: 'malformed-field',
        field: `cropComposition.${category}`,
        message: `The share of "${category}" must be a finite number greater than zero; found ${JSON.stringify(share)}.`,
      })
      continue
    }
    total += share
  }

  if (usable && Math.abs(total - 1) > 1e-9) {
    issues.push({
      code: 'crop-composition-unbalanced',
      field: 'cropComposition',
      message: `The declared crop shares come to ${total} rather than 1, so part of the crop belongs to no category or the shares mean something other than shares.`,
    })
  }
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

  const crop = input.openingCrop
  if (crop !== undefined && crop !== null && (!isWholeNumber(crop) || crop < 1)) {
    issues.push({
      code: 'malformed-field',
      field: 'openingCrop',
      message: `Field "openingCrop" must be a whole number of one or more; found ${JSON.stringify(crop)}.`,
    })
  }

  if (input.cropComposition !== undefined && input.cropComposition !== null) {
    checkCropComposition(input.cropComposition, issues)
  }

  const automation = input.automation
  if (automation !== undefined && automation !== null) {
    if (!isRecord(automation) || !isNonEmptyString(automation.item)) {
      issues.push({
        code: 'malformed-field',
        field: 'automation',
        message: 'Field "automation" must name the catalog item that does the job, as "item".',
      })
    }
  }

  const manual = input.manualLabour
  if (manual !== undefined && manual !== null) {
    if (!isRecord(manual)) {
      issues.push({
        code: 'malformed-field',
        field: 'manualLabour',
        message:
          'Field "manualLabour" must be an object naming how the farm’s own labour is shown, as "icon" and "label".',
      })
    } else {
      for (const field of ['icon', 'label'] as const) {
        if (manual[field] !== undefined && !isNonEmptyString(manual[field])) {
          issues.push({
            code: 'malformed-field',
            field: `manualLabour.${field}`,
            message: `Field "manualLabour.${field}" must be a non-empty string; found ${JSON.stringify(manual[field])}.`,
          })
        }
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, declaration: input as unknown as FarmDeclaration }
}
