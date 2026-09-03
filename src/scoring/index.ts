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
import type { PredictionArtifact, SplitName } from '../task/artifact.js'
import { lookupConfiguration } from '../task/artifact.js'
import { resolveConfiguration } from '../task/configuration.js'
import type { ActionId, CategoryId, TaskDeclaration } from '../task/types.js'
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
 * Runs one split end to end: resolves the requested knob values, looks the
 * configuration up in the artifact, then scores it. Every gate refuses rather
 * than scoring partial data, so an out-of-range knob value or a stale artifact
 * yields issues and no outcome.
 */
export function runHarvest(
  declaration: TaskDeclaration,
  requestedKnobs: Readonly<Record<string, unknown>>,
  artifact: PredictionArtifact,
  split: SplitName,
  truth: Readonly<Record<string, CategoryId>>,
): RunResult {
  const resolved = resolveConfiguration(declaration, requestedKnobs)
  if (!resolved.ok) return { ok: false, issues: resolved.issues }

  const found = lookupConfiguration(declaration, resolved.configuration, artifact)
  if (!found.ok) return { ok: false, issues: found.issues }

  const rows = found.entry.predictions[split]
  const issues: ValidationIssue[] = []
  const images: EvaluatedImage[] = []

  for (const imageId of Object.keys(rows)) {
    const distribution = rows[imageId]
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

  return {
    ok: true,
    configurationId: found.configurationId,
    outcome: scoreRun(declaration, images),
  }
}
