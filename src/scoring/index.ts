/**
 * Scoring a run.
 *
 * The payoff table is the single structure behind both earnings and the report:
 * scoring sums its entries, and the report is the same table filled with counts.
 * Deriving both from one declaration removes the class of bug where the report
 * explains a number the scoring did not compute — and makes the report
 * structurally a confusion matrix with money attached.
 *
 * A total on its own would let a student hill-climb instead of diagnose, so
 * per-combination counts are part of the outcome rather than an optional extra.
 */

import { chooseAction, distributionProblem } from '../policy/index.js'
export type { DeliveredBatch, DeliveryValuation } from './delivery.js'
export { valueDelivery } from './delivery.js'
export { recordHarvestFigures } from './harvest.js'

import type { PredictionArtifact, SplitName } from '../task/artifact.js'
import { lookupConfiguration } from '../task/artifact.js'
import type { FamilyEntry } from '../families/entry.js'
import { entryFromPredictions } from '../families/entry.js'
import { resolveConfiguration } from '../task/configuration.js'
import type { CropImage } from '../sorting/crop.js'
import type { ActionId, CategoryId, ModelFamilyDeclaration, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'

export interface EvaluatedImage {
  readonly imageId: string
  readonly trueCategory: CategoryId
  readonly distribution: readonly number[]
}

export interface ImageOutcome extends EvaluatedImage {
  readonly action: ActionId
  readonly payoff: number
}

export interface RunOutcome {
  readonly evaluated: number
  readonly earnings: number
  /** Count of evaluated images per true category and chosen action. */
  readonly counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>
  readonly images: readonly ImageOutcome[]
}

export type RunResult =
  | { readonly ok: true; readonly configurationId: string; readonly outcome: RunOutcome }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

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
 * Scores a set of evaluated images. Earnings are the sum, over every image, of
 * the payoff table entry for that image's true category and the action chosen
 * for it — so the same images under the same configuration and policy always
 * produce the same total.
 */
export function scoreRun(
  declaration: TaskDeclaration,
  images: readonly EvaluatedImage[],
): RunOutcome {
  const counts = emptyCounts(declaration)
  const outcomes: ImageOutcome[] = []
  let earnings = 0

  for (const image of images) {
    const action = chooseAction(declaration, image.distribution)
    const payoff = declaration.payoffs[image.trueCategory]?.[action]
    if (payoff === undefined) {
      throw new Error(
        `Payoff table of task "${declaration.id}" has no value for category ` +
          `"${image.trueCategory}" and action "${action}".`,
      )
    }
    earnings += payoff
    const row = counts[image.trueCategory]
    if (row !== undefined) row[action] = (row[action] ?? 0) + 1
    outcomes.push({ ...image, action, payoff })
  }

  return { evaluated: images.length, earnings, counts, images: outcomes }
}

/**
 * What each declared category's pieces came to, before any delivery term.
 *
 * The rows of the report, and the rows sum to the gross — which is why they are the gross
 * rather than a share of what was paid. A batch term is not a per-image quantity and
 * cannot be spread back over the categories that caused it without inventing an
 * apportionment the declaration does not contain; the report shows the deduction whole,
 * beside the sum it came off.
 *
 * Derived here rather than in a screen for the reason nothing else is derived there: a
 * report explaining a number the scoring did not compute is the class of bug this module
 * exists to make impossible.
 */
export function earningsByCategory(
  declaration: TaskDeclaration,
  counts: Readonly<Record<CategoryId, Readonly<Record<ActionId, number>>>>,
): Readonly<Record<CategoryId, number>> {
  const rows: Record<CategoryId, number> = {}
  for (const category of declaration.categories) {
    let total = 0
    for (const action of declaration.actions) {
      const count = counts[category.id]?.[action.id] ?? 0
      if (count === 0) continue
      const payoff = declaration.payoffs[category.id]?.[action.id]
      if (payoff === undefined) {
        throw new Error(
          `Payoff table of task "${declaration.id}" has no value for category ` +
            `"${category.id}" and action "${action.id}".`,
        )
      }
      total += payoff * count
    }
    rows[category.id] = total
  }
  return rows
}

/**
 * Runs one split end to end: resolves the requested knob values, looks the
 * configuration up in the artifact, then scores it. Every gate refuses rather
 * than scoring partial data, so an out-of-range knob value or a stale artifact
 * yields issues and no outcome.
 */
export function runHarvest(
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  requestedKnobs: Readonly<Record<string, unknown>>,
  artifact: PredictionArtifact,
  split: SplitName,
  truth: Readonly<Record<string, CategoryId>>,
): RunResult {
  const resolved = resolveConfiguration(declaration, family, requestedKnobs)
  if (!resolved.ok) return { ok: false, issues: resolved.issues }

  const found = lookupConfiguration(declaration, family, resolved.configuration, artifact)
  if (!found.ok) return { ok: false, issues: found.issues }

  return scoreEntry(
    declaration,
    found.configurationId,
    entryFromPredictions(found.entry),
    split,
    truth,
  )
}

/**
 * The split a year's crop is drawn from, and the split its predictions are read out of.
 *
 * Named here rather than passed in by a caller. A crop is *defined* as pictures of the
 * evaluation split — the images no model was fitted on — so a caller able to name a
 * different one could score a harvest against the training set, which is the single most
 * flattering wrong number this codebase can produce.
 */
export const CROP_SPLIT: SplitName = 'pool'

/**
 * Scores a year's crop: one distribution per piece, in the order the crop holds them.
 *
 * A picture may stand for more than one piece of a large crop, and each appearance is
 * scored on its own. That is not double counting — the crop holds six thousand apples and
 * the pool holds a thousand pictures of them, so the sixth appearance is the six
 * thousandth apple rather than the same apple counted again. The report says as much,
 * which is what keeps it a mechanism rather than a claim.
 *
 * The true category is the crop's, not the pool manifest's second opinion: the crop was
 * drawn by category, so what a piece is was decided before a picture was chosen for it.
 */
export function scoreCrop(
  declaration: TaskDeclaration,
  identifier: string,
  entry: FamilyEntry,
  pieces: readonly CropImage[],
): RunResult {
  const issues: ValidationIssue[] = []
  const images: EvaluatedImage[] = []
  const checked = new Set<string>()

  for (const piece of pieces) {
    const distribution = entry.distributionFor(CROP_SPLIT, piece.imageId)
    if (distribution === undefined) {
      if (!checked.has(piece.imageId)) {
        checked.add(piece.imageId)
        issues.push({
          code: 'missing-prediction',
          field: piece.imageId,
          message: `This configuration has no stored prediction for image "${piece.imageId}", which this year's crop holds.`,
        })
      }
      continue
    }
    if (!checked.has(piece.imageId)) {
      checked.add(piece.imageId)
      const problem = distributionProblem(declaration, distribution)
      if (problem !== undefined) {
        issues.push({
          code: 'malformed-distribution',
          field: piece.imageId,
          message: `Stored distribution for image "${piece.imageId}" is unusable: ${problem}.`,
        })
      }
    }
    images.push({ imageId: piece.imageId, trueCategory: piece.category, distribution })
  }

  if (issues.length > 0) return { ok: false, issues }

  return { ok: true, configurationId: identifier, outcome: scoreRun(declaration, images) }
}

/**
 * Scores one split of one configuration's predictions, given the entry already in hand.
 *
 * Split out of `runHarvest` because a crop can be brought in by a configuration that was
 * put to work rather than by the knob values currently on screen, and there is no honest
 * way back from an identifier to the values that composed it. Everything after the lookup
 * is the same code, so the two paths cannot drift into scoring differently.
 */
export function scoreEntry(
  declaration: TaskDeclaration,
  identifier: string,
  entry: FamilyEntry,
  split: SplitName,
  truth: Readonly<Record<string, CategoryId>>,
): RunResult {
  const issues: ValidationIssue[] = []
  const images: EvaluatedImage[] = []

  // The images the split holds, asked of the entry rather than read off a materialized
  // map: a family that ships its model has no map to enumerate, and this is the accessor
  // that replaces `Object.keys(rows)` for both forms.
  for (const imageId of entry.imageIdsIn(split)) {
    const distribution = entry.distributionFor(split, imageId)
    if (distribution === undefined) continue

    const trueCategory = truth[imageId]
    if (trueCategory === undefined) {
      issues.push({
        code: 'missing-ground-truth',
        field: imageId,
        message: `The pool declares no true category for image "${imageId}".`,
      })
      continue
    }
    const problem = distributionProblem(declaration, distribution)
    if (problem !== undefined) {
      issues.push({
        code: 'malformed-distribution',
        field: imageId,
        message: `Stored distribution for image "${imageId}" is unusable: ${problem}.`,
      })
      continue
    }
    images.push({ imageId, trueCategory, distribution })
  }

  if (issues.length > 0) return { ok: false, issues }

  return { ok: true, configurationId: identifier, outcome: scoreRun(declaration, images) }
}
