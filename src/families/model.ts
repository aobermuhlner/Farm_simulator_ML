/**
 * A family whose model ships, evaluated in the browser over the measured features.
 *
 * The distinction this module exists for is what a family *ships*. A convolutional
 * network cannot travel — 128 channels of weights will not go down the wire and will not
 * run on a laptop in a lesson — so its predictions are precomputed and looked up. A model
 * built on the numbers `measured-features` already put in the pool manifest is a few
 * dozen `(feature, threshold)` pairs, and shipping it is smaller than shipping a table of
 * everything it would ever say.
 *
 * The shipped form is a chain of feature thresholds with a distribution at every exit:
 * the shape a person writes and the shape a fitted tree produces, general over whatever
 * features and categories a task declares. Nothing here knows what a worm is.
 *
 * Everything refuses rather than repairs, and refuses at read time where it can: a leaf
 * that is not a distribution over the task's declared categories is caught once, when the
 * model is read, rather than once per image at harvest.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import type { FeatureVector } from '../features/index.js'
import { distributionProblem } from '../policy/index.js'
import type { SplitName, TrainingStep } from '../task/artifact.js'
import type { ModelFamilyDeclaration, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import { checkArtifactVersion } from '../task/version.js'
import type { FamilyEntry } from './entry.js'

/** One question the model asks, and what it answers when the answer is yes. */
export interface ModelSplit {
  /** A feature the task declares. */
  readonly feature: string
  readonly threshold: number
  /** The distribution for an image whose feature exceeds the threshold. */
  readonly whenAbove: readonly number[]
}

/**
 * A shipped model: questions asked in order, and what it answers when none is yes.
 *
 * A chain rather than a general tree, matching `src/features/rules.ts`. It is the shape a
 * person writes — "if it has spots, discard; otherwise if it is red, crate red; otherwise
 * crate green" — and the leaves carry distributions rather than actions, because a family
 * yields a distribution and the decision policy is what turns one into an action.
 */
export interface ShippedModel {
  readonly splits: readonly ModelSplit[]
  /** The distribution for an image no split claimed. */
  readonly otherwise: readonly number[]
}

/** One configuration's shipped model, as its file carries it. */
export interface ModelDocument {
  readonly model: ShippedModel
  /** Present only for a family that records a training history. */
  readonly history?: readonly TrainingStep[]
}

export type ModelValidation =
  | { readonly ok: true; readonly document: ModelDocument }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, message: string, field?: string): ValidationIssue {
  return field === undefined ? { code, message } : { code, message, field }
}

/** A leaf checked against the task's declared categories, naming where it sits. */
function checkLeaf(
  declaration: TaskDeclaration,
  raw: unknown,
  where: string,
  configurationId: string,
  issues: ValidationIssue[],
): readonly number[] | undefined {
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== 'number')) {
    issues.push(
      issue(
        'malformed-distribution',
        `Configuration "${configurationId}" carries no list of probabilities at ${where}.`,
        where,
      ),
    )
    return undefined
  }
  const distribution = raw as readonly number[]
  const problem = distributionProblem(declaration, distribution)
  if (problem !== undefined) {
    issues.push(
      issue(
        'malformed-distribution',
        `Configuration "${configurationId}" answers ${where} with a value that is not a distribution over the declared categories: ${problem}.`,
        where,
      ),
    )
    return undefined
  }
  return distribution
}

/**
 * Reads one configuration's shipped model against the family and the task that name it.
 *
 * The bindings are checked the way an artifact's are: a model recording a different task,
 * family or configuration than the one being resolved is refused naming both, because two
 * families of one task can compose the same identifier and a wrong file would answer with
 * a real, plausible distribution rather than failing.
 */
export function readModelFile(
  raw: unknown,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  configurationId: string,
): ModelValidation {
  if (!isRecord(raw)) {
    return {
      ok: false,
      issues: [
        issue('data-malformed', `The model for "${configurationId}" is not an object.`, configurationId),
      ],
    }
  }

  const issues: ValidationIssue[] = []

  const version = checkArtifactVersion(declaration.schemaVersion, String(raw.schemaVersion))
  if (!version.ok) issues.push(version.issue)

  if (raw.taskId !== declaration.id) {
    issues.push(
      issue(
        'artifact-task-mismatch',
        `The model for "${configurationId}" belongs to task "${String(raw.taskId)}", not "${declaration.id}".`,
        configurationId,
      ),
    )
  }
  if (raw.familyId !== family.id) {
    issues.push(
      issue(
        'artifact-family-mismatch',
        `The model for "${configurationId}" was made in family "${String(raw.familyId)}", not "${family.id}".`,
        configurationId,
      ),
    )
  }
  if (raw.configurationId !== configurationId) {
    issues.push(
      issue(
        'artifact-configuration-mismatch',
        `A file listed for "${configurationId}" identifies itself as "${String(raw.configurationId)}".`,
        configurationId,
      ),
    )
  }
  if (issues.length > 0) return { ok: false, issues }

  const model = raw.model
  if (!isRecord(model) || !Array.isArray(model.splits)) {
    return {
      ok: false,
      issues: [
        issue(
          'malformed-model',
          `Configuration "${configurationId}" carries no model with a list of splits.`,
          configurationId,
        ),
      ],
    }
  }

  const splits: ModelSplit[] = []
  model.splits.forEach((raw_: unknown, index: number) => {
    const where = `splits[${index}]`
    if (!isRecord(raw_) || typeof raw_.threshold !== 'number' || !Number.isFinite(raw_.threshold)) {
      issues.push(
        issue(
          'malformed-model',
          `Configuration "${configurationId}" has no usable threshold at ${where}.`,
          where,
        ),
      )
      return
    }
    const declared = declaration.features.find((feature) => feature.id === raw_.feature)
    if (typeof raw_.feature !== 'string' || declared === undefined) {
      issues.push(
        issue(
          'unknown-feature',
          `Configuration "${configurationId}" splits at ${where} on ${JSON.stringify(raw_.feature)}, which task "${declaration.id}" does not measure.`,
          where,
        ),
      )
      return
    }
    // A cut outside the span the feature's values actually cover is not a question. It
    // is either the whole pool or none of it, which makes the branch below it dead and
    // makes the tree drawn on screen a lie about what it separates. Refused rather than
    // clamped: a threshold at the wrong scale is an authoring mistake, not a rounding one.
    if (raw_.threshold < declared.range.min || raw_.threshold > declared.range.max) {
      issues.push(
        issue(
          'threshold-out-of-range',
          `Configuration "${configurationId}" cuts "${declared.id}" at ${raw_.threshold} at ${where}, outside the ${declared.range.min} to ${declared.range.max} the pool's values cover.`,
          where,
        ),
      )
      return
    }
    const whenAbove = checkLeaf(declaration, raw_.whenAbove, `${where}.whenAbove`, configurationId, issues)
    if (whenAbove === undefined) return
    splits.push({ feature: raw_.feature, threshold: raw_.threshold, whenAbove })
  })

  // Every path has to terminate in a leaf. In the chain shape that is one leaf per
  // question plus the fallback, and it is the fallback that is easy to leave off — a
  // chain without one leaves every apple no question claimed with no answer at all.
  const otherwise =
    model.otherwise === undefined
      ? (issues.push(
          issue(
            'non-terminating-model',
            `Configuration "${configurationId}" ends in no leaf, so an apple no question claims reaches no answer.`,
            'otherwise',
          ),
        ),
        undefined)
      : checkLeaf(declaration, model.otherwise, 'otherwise', configurationId, issues)

  // A history is optional, and a family that declares one must carry it: a curve the
  // workshop is told to draw and cannot is worse than one it was never promised.
  let history: readonly TrainingStep[] | undefined
  if (family.history !== undefined) {
    if (!Array.isArray(raw.history) || raw.history.length === 0) {
      issues.push(
        issue(
          'missing-history',
          `Family "${family.id}" records a training history, but configuration "${configurationId}" carries none.`,
          configurationId,
        ),
      )
    } else {
      history = raw.history as readonly TrainingStep[]
    }
  }

  if (issues.length > 0 || otherwise === undefined) return { ok: false, issues }

  return {
    ok: true,
    document: { model: { splits, otherwise }, ...(history === undefined ? {} : { history }) },
  }
}

/**
 * Every feature a shipped model asks about, in the order it first asks.
 *
 * Read off the model rather than off the task, because what a model *may* read and what
 * it *does* read are different sets: holding an evaluation to the whole declared feature
 * list would refuse a perfectly good two-question tree over a manifest that records a
 * fifth number for only some of its images.
 */
export function featuresRead(model: ShippedModel): readonly string[] {
  const seen: string[] = []
  for (const split of model.splits) if (!seen.includes(split.feature)) seen.push(split.feature)
  return seen
}

/**
 * Whether a shipped model can be evaluated over every image of every split, and why not.
 *
 * This is `prediction-artifacts`' completeness requirement in the form a stored model
 * takes it: not an enumeration of distributions, which a model does not have, but the
 * structural claim that evaluating it reaches exactly one outcome for every image the
 * manifest declares. Half of that is free — a chain answers with the first split whose
 * question an image says yes to and otherwise with `otherwise`, so there is always
 * exactly one answer and never two. The half that is not free is whether the numbers the
 * questions ask about are there, for every image, which is what this checks.
 *
 * Checked once when the model is read, over the manifest's own enumeration, rather than
 * per image at harvest: a model that cannot span the pool must refuse rather than score
 * the images it happens to resolve.
 */
export function modelSpanIssues(
  model: ShippedModel,
  configurationId: string,
  imageIds: Readonly<Record<string, readonly string[]>>,
  features: Readonly<Record<string, FeatureVector>>,
): readonly ValidationIssue[] {
  const read = featuresRead(model)
  for (const [split, ids] of Object.entries(imageIds)) {
    for (const imageId of ids) {
      const vector = features[imageId]
      if (vector === undefined) {
        return [
          issue(
            'incomplete-configuration',
            `Configuration "${configurationId}" cannot be evaluated over image "${imageId}" of "${split}", which the pool manifest declares but records no measured features for.`,
            configurationId,
          ),
        ]
      }
      for (const feature of read) {
        const value = vector[feature]
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return [
            issue(
              'incomplete-configuration',
              `Configuration "${configurationId}" asks about "${feature}", which the pool manifest does not declare for image "${imageId}" of "${split}", so the model cannot span the pool.`,
              feature,
            ),
          ]
        }
      }
    }
  }
  return []
}

/** The distribution a shipped model gives an image, from the numbers measured of it. */
export function predictWith(model: ShippedModel, features: FeatureVector): readonly number[] {
  for (const split of model.splits) {
    const value = features[split.feature]
    if (value !== undefined && value > split.threshold) return split.whenAbove
  }
  return model.otherwise
}

/**
 * A family entry over a shipped model, the pool's split membership and its features.
 *
 * Evaluated on call rather than materialized: selecting a family must not walk a thousand
 * images before showing anything, and nothing downstream can tell the difference.
 */
export function entryFromModel(
  document: ModelDocument,
  imageIds: Readonly<Record<string, readonly string[]>>,
  features: Readonly<Record<string, FeatureVector>>,
): FamilyEntry {
  return {
    ...(document.history === undefined ? {} : { history: document.history }),
    // The same object the predictions below are computed from, handed on so the drawing
    // and the scoring cannot come from two different trees.
    structure: document.model,
    distributionFor: (split: SplitName, imageId: string) => {
      if (!(imageIds[split] ?? []).includes(imageId)) return undefined
      const vector = features[imageId]
      return vector === undefined ? undefined : predictWith(document.model, vector)
    },
    imageIdsIn: (split: SplitName) => imageIds[split] ?? [],
  }
}
