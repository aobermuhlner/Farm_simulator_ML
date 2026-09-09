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

/** The span a category's share of the crop may take in any one year, inclusive. */
export interface ShareRange {
  readonly min: number
  readonly max: number
}

/**
 * How far each category's share of the crop moves from year to year.
 *
 * A wet spring means more worms. Declared as a range rather than left to a noise term
 * because the difference between two years has to be something a student can be *told* —
 * the year's drawn composition is stated on the report, in the task's own labels, so a
 * leaner year is attributable to the year rather than mistaken for the model changing
 * underneath them. A category with no range declared here keeps its declared ratio to the
 * other such categories and absorbs whatever the varying ones leave.
 *
 * Optional, and optional per category: a farm declaring none has the same crop mix every
 * year, which is what every farm had before this existed.
 */
export type YearVariation = Readonly<Record<string, ShareRange>>

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

/**
 * The land the farm holds and what it bears. Every word of it is presented, so a farm
 * measured in something other than trees renders through the same screens unchanged.
 */
export interface OrchardDeclaration {
  /** What the orchard is called, e.g. "Orchard". Shown, never branched on. */
  readonly label: string
  /** What one unit of the land is called, e.g. "trees". Shown, never branched on. */
  readonly unit: string
  /** How many units of land the farm opens with. */
  readonly opening: number
  /** How many pieces of crop one unit of land bears in a year. */
  readonly piecesPerUnit: number
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
   * The orchard: the land the farm opens with, and what a unit of it bears.
   *
   * The farm's, not the task's — it is what the land bears, and it grows as the land
   * does. The size of the crop is the product of the two and is never declared beside
   * them, so no later edit can leave a declared size disagreeing with the land it is
   * supposed to describe. A task declares how much of the crop one person can get
   * through.
   */
  readonly orchard: OrchardDeclaration
  /** What the crop is made of, as a share per category. */
  readonly cropComposition: CropComposition
  /** How far a category's share moves from one year to the next, where it moves at all. */
  readonly yearVariation?: YearVariation
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
  'orchard',
  'cropComposition',
] as const

/** Every field the farm declaration may carry but need not. */
export const OPTIONAL_FARM_FIELDS = ['automation', 'manualLabour', 'yearVariation'] as const

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
 * Validates the ranges the crop's composition varies within from year to year.
 *
 * Three refusals, each naming the category whose range is at fault.
 *
 * A range that does not contain the category's declared share makes the declared share a
 * figure no year can draw, so two declarations that must agree do not.
 *
 * A range reaching zero or one is a year in which a declared category is absent, or in
 * which it is the whole crop — and a crop is required to hold one of every declared
 * category, so such a year could only be refused at the moment it was drawn.
 *
 * An upper bound leaving nothing for the categories that declare no range has the same
 * problem a year later: the shares that absorb the remainder would have to divide zero.
 */
function checkYearVariation(
  variation: unknown,
  composition: unknown,
  openingCrop: number | undefined,
  issues: ValidationIssue[],
): void {
  if (!isRecord(variation)) {
    issues.push({
      code: 'malformed-field',
      field: 'yearVariation',
      message: 'Field "yearVariation" must be an object of per-category ranges.',
    })
    return
  }
  if (!isRecord(composition)) return

  let varyingMax = 0
  let holding = 0

  for (const [category, range] of Object.entries(variation)) {
    const declared = composition[category]
    if (typeof declared !== 'number') {
      issues.push({
        code: 'unknown-category',
        field: `yearVariation.${category}`,
        message: `Field "yearVariation" declares a range for "${category}", which the crop's composition says nothing about.`,
      })
      continue
    }

    if (
      !isRecord(range) ||
      typeof range.min !== 'number' ||
      !Number.isFinite(range.min) ||
      typeof range.max !== 'number' ||
      !Number.isFinite(range.max)
    ) {
      issues.push({
        code: 'malformed-field',
        field: `yearVariation.${category}`,
        message: `The range for "${category}" must declare a finite "min" and "max".`,
      })
      continue
    }

    const { min, max } = range
    if (min <= 0 || max >= 1 || min > max) {
      issues.push({
        code: 'year-variation-out-of-range',
        field: `yearVariation.${category}`,
        message: `The range for "${category}" is ${min} to ${max}, which must run upwards and lie strictly between zero and one — a year holding none of a declared category, or nothing else, is not a year the crop can be drawn for.`,
      })
      continue
    }

    if (declared < min || declared > max) {
      issues.push({
        code: 'year-variation-excludes-declared',
        field: `yearVariation.${category}`,
        message: `The range for "${category}" is ${min} to ${max}, which does not contain its declared share of ${declared}, so the declared composition is a crop no year could draw.`,
      })
      continue
    }

    varyingMax += max
    holding += 1
  }

  const others = Object.keys(composition).filter((category) => variation[category] === undefined)
  if (holding === 0 || others.length === 0) return

  // Measured against the crop the farm opens at, which is the smallest it ever bears: a
  // bound that squeezes a category below one whole piece there squeezes it below one
  // whenever the orchard is at its smallest. The allocation would hand it one piece
  // anyway, at another category's expense — so the declared shares and the crop drawn
  // from them would stop being the same statement, in the wettest year of every farm.
  const remainder = 1 - varyingMax
  const holdingWeight = others.reduce(
    (sum, category) => sum + (composition[category] as number),
    0,
  )
  const crop = openingCrop !== undefined && openingCrop > 0 ? openingCrop : 1
  const squeezed = others.filter(
    (category) =>
      remainder <= 0 ||
      (crop * remainder * (composition[category] as number)) / holdingWeight < 1,
  )
  if (squeezed.length === 0) return

  const worst = Object.entries(variation)
    .filter(([category]) => typeof composition[category] === 'number')
    .sort((a, b) => {
      const left = isRecord(a[1]) && typeof a[1].max === 'number' ? a[1].max : 0
      const right = isRecord(b[1]) && typeof b[1].max === 'number' ? b[1].max : 0
      return right - left
    })[0]?.[0]
  issues.push({
    code: 'year-variation-crowds-out',
    field: `yearVariation.${String(worst)}`,
    message: `The declared upper bounds come to ${varyingMax}, which in a crop of ${crop} leaves ${squeezed.join(', ')} without a whole piece to hold. A category the crop must hold one of cannot be left no room for it.`,
  })
}

/**
 * Validates the declared orchard, and returns the crop its opening land bears where the
 * two figures are usable. Every refusal names its own field, so a declaration with a
 * fractional yield and no unit is told about both rather than about the orchard.
 *
 * A farm declaring no orchard at all is refused by the required-field check and reaches
 * here as `undefined`, so nothing is said about it twice and no size is assumed for it.
 */
function checkOrchard(orchard: unknown, issues: ValidationIssue[]): number | undefined {
  if (orchard === undefined || orchard === null) return undefined
  if (!isRecord(orchard)) {
    issues.push({
      code: 'malformed-field',
      field: 'orchard',
      message:
        'Field "orchard" must be an object declaring "label", "unit", "opening" and "piecesPerUnit".',
    })
    return undefined
  }

  for (const field of ['label', 'unit'] as const) {
    if (!isNonEmptyString(orchard[field])) {
      issues.push({
        code: 'malformed-field',
        field: `orchard.${field}`,
        message: `Field "orchard.${field}" must be a non-empty string; found ${JSON.stringify(orchard[field])}.`,
      })
    }
  }

  const measures: Partial<Record<'opening' | 'piecesPerUnit', number>> = {}
  for (const field of ['opening', 'piecesPerUnit'] as const) {
    const value = orchard[field]
    if (!isWholeNumber(value) || value < 1) {
      issues.push({
        code: 'malformed-field',
        field: `orchard.${field}`,
        message: `Field "orchard.${field}" must be a whole number of one or more; found ${JSON.stringify(value)}.`,
      })
      continue
    }
    measures[field] = value
  }

  const { opening, piecesPerUnit } = measures
  return opening !== undefined && piecesPerUnit !== undefined ? opening * piecesPerUnit : undefined
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

  const openingCrop = checkOrchard(input.orchard, issues)

  if (input.cropComposition !== undefined && input.cropComposition !== null) {
    checkCropComposition(input.cropComposition, issues)
  }

  // Optional, and checked against the composition it varies: a range for a category the
  // crop is not made of has nothing to move.
  if (input.yearVariation !== undefined && input.yearVariation !== null) {
    checkYearVariation(input.yearVariation, input.cropComposition, openingCrop, issues)
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
