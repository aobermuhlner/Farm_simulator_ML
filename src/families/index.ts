/**
 * The registry: one declared family, one evaluator, one entry.
 *
 * Which evaluator serves a family is decided by what that family declares it *ships* and
 * by nothing else. There is no table of family ids here and there is not meant to be one:
 * a rung added to the ladder is a declaration, and a registry keyed by id would make it a
 * code change — which is the whole thing this change exists to prevent.
 *
 * Both evaluators are given the same request and each refuses when what it needs is not
 * in it. That is deliberate over two narrower signatures: the caller resolving a
 * configuration does not know, and must not have to know, which form it is about to get.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import type { FeatureVector } from '../features/index.js'
import type { LoadedIndex, PoolBinding } from '../task/artifactIndex.js'
import { readArtifactIndex, readConfigurationFile } from '../task/artifactIndex.js'
import { UNTRAINED_CONFIGURATION } from '../task/artifactIndex.js'
import type { ModelFamilyDeclaration, ShippedForm, TaskDeclaration } from '../task/types.js'
import type { ValidationIssue } from '../task/validate.js'
import type { FamilyEntry } from './entry.js'
import { entryFromPredictions } from './entry.js'
import { entryFromModel, modelSpanIssues, readModelFile } from './model.js'
import { readModelIndex } from './modelIndex.js'

export type { FamilyEntry } from './entry.js'
export { entryFromPredictions } from './entry.js'
export type { ModelDocument, ModelSplit, ShippedModel } from './model.js'
export { entryFromModel, featuresRead, modelSpanIssues, predictWith, readModelFile } from './model.js'
export type { LoadedModelIndex } from './modelIndex.js'
export { readModelIndex } from './modelIndex.js'

/**
 * Everything an evaluator is handed, whatever the family ships.
 *
 * `document` is the one file fetched for this configuration, unvalidated: a prediction
 * table for a family that ships predictions, a model for one that ships its model. Each
 * evaluator reads it with its own reader.
 */
export interface EvaluationRequest {
  readonly declaration: TaskDeclaration
  readonly family: ModelFamilyDeclaration
  readonly configurationId: string
  readonly document: unknown
  /** Image ids per split, as the pool manifest enumerates them. */
  readonly imageIds: Readonly<Record<string, readonly string[]>>
  /**
   * Training image ids per dataset tier, as the pool manifest assigns them.
   *
   * Beside `imageIds` rather than inside it, for the same reason the roles are: a reader
   * enumerating that record must find the task's splits and nothing else.
   */
  readonly tierImages?: Readonly<Record<string, readonly string[]>>
  /** The artifact index, for a family whose predictions ship. */
  readonly index?: LoadedIndex
  /** Per-image measured features, for a family whose model ships. */
  readonly features?: Readonly<Record<string, FeatureVector>>
}

export type FamilyResolution =
  | { readonly ok: true; readonly entry: FamilyEntry }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

export type FamilyEvaluator = (request: EvaluationRequest) => FamilyResolution

function issue(code: string, message: string, field?: string): ValidationIssue {
  return { code, message, field }
}

/**
 * The prediction-shipping evaluator: the stored table, read and wrapped.
 *
 * Nothing is recomputed here. The artifact reader already checks the table against the
 * pool's image ids, the declared categories and the declared encoding, so the evaluator's
 * whole job is to refuse when the index it needs was not loaded and to hand back what the
 * reader produced.
 */
const evaluatePredictions: FamilyEvaluator = (request) => {
  const { declaration, family, configurationId, index, imageIds, tierImages, document } = request
  if (index === undefined) {
    return {
      ok: false,
      issues: [
        issue(
          'artifact-not-loaded',
          `Family "${family.id}" ships predictions, but no artifact index was loaded to resolve "${configurationId}" against.`,
          family.id,
        ),
      ],
    }
  }

  const read = readConfigurationFile(
    document,
    declaration,
    index,
    configurationId,
    imageIds,
    tierImages,
  )
  if (!read.ok) return { ok: false, issues: read.issues }
  return { ok: true, entry: entryFromPredictions(read.entry) }
}

/**
 * The model-shipping evaluator: the model, read once, applied per image on call.
 *
 * Split membership comes from the pool manifest rather than from the model, because the
 * model says nothing about which images exist — that is the pool's to say, and it is the
 * same enumeration the crop is drawn from.
 */
const evaluateModel: FamilyEvaluator = (request) => {
  const { declaration, family, configurationId, features, imageIds, document } = request
  if (features === undefined) {
    return {
      ok: false,
      issues: [
        issue(
          'features-not-loaded',
          `Family "${family.id}" ships its model, but no measured features were loaded to evaluate "${configurationId}" over.`,
          family.id,
        ),
      ],
    }
  }

  const read = readModelFile(document, declaration, family, configurationId)
  if (!read.ok) return { ok: false, issues: read.issues }

  // Completeness, in the form a stored model takes it. A family evaluated from the
  // manifest's recorded values reads no delivered image — its chain of custody to the
  // pixels is the measurement the pool tooling already performed — so what has to be
  // checked is that those values are there for every image, not that a distribution is.
  const span = modelSpanIssues(read.document.model, configurationId, imageIds, features)
  if (span.length > 0) return { ok: false, issues: span }

  return { ok: true, entry: entryFromModel(read.document, imageIds, features) }
}

/**
 * What one family's store says it holds, whatever form that store takes.
 *
 * The same shape for both, so that everything past the registry — the coverage check, the
 * catalog check, the fetch of one configuration — is written once. `index` is present
 * only for a family whose predictions ship: it carries the encoding and the provenance a
 * stored prediction table is read against, and a shipped model has neither.
 */
export interface FamilyStore {
  readonly coverage: readonly string[]
  /** Configuration identifier to the file it sits in, beside the family's index. */
  readonly files: Readonly<Record<string, string>>
  readonly index?: LoadedIndex
}

export type StoreValidation =
  | { readonly ok: true; readonly store: FamilyStore }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Reads a family's index, against the task, the family and the pool that name it. */
export type FamilyIndexReader = (
  raw: unknown,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  pool: PoolBinding,
) => StoreValidation

const readPredictionStore: FamilyIndexReader = (raw, declaration, family, pool) => {
  const read = readArtifactIndex(raw, declaration, family, pool)
  if (!read.ok) return { ok: false, issues: read.issues }
  return {
    ok: true,
    store: {
      coverage: read.index.coverage,
      files: Object.fromEntries(
        Object.entries(read.index.configurations).map(([id, record]) => [id, record.file]),
      ),
      index: read.index,
    },
  }
}

const readModelStore: FamilyIndexReader = (raw, declaration, family, pool) => {
  const read = readModelIndex(raw, declaration, family, pool)
  if (!read.ok) return { ok: false, issues: read.issues }
  return { ok: true, store: { coverage: read.index.coverage, files: read.index.files } }
}

/** What a family ships, to the evaluator that serves it. The registry, entire. */
const EVALUATORS: Readonly<Record<ShippedForm, FamilyEvaluator>> = {
  predictions: evaluatePredictions,
  model: evaluateModel,
}

/** What a family ships, to the reader of its index. The registry's other half. */
const INDEX_READERS: Readonly<Record<ShippedForm, FamilyIndexReader>> = {
  predictions: readPredictionStore,
  model: readModelStore,
}

/**
 * Reads one family's index through the reader its shipped form calls for.
 *
 * Here rather than in the loader that fetches it, so that nothing outside this module
 * branches on what a family ships — which is what the shell's invariant requires, and
 * what makes a third shipped form, if one is ever needed, a change to this file alone.
 */
export function readFamilyStore(
  raw: unknown,
  declaration: TaskDeclaration,
  family: ModelFamilyDeclaration,
  pool: PoolBinding,
): StoreValidation {
  return INDEX_READERS[family.ships](raw, declaration, family, pool)
}

/** The evaluator a declared family resolves through, decided by what it ships. */
export function evaluatorFor(family: ModelFamilyDeclaration): FamilyEvaluator {
  return EVALUATORS[family.ships]
}

/** Resolves one configuration against one family, through whichever evaluator serves it. */
export function resolveFamilyEntry(request: EvaluationRequest): FamilyResolution {
  return evaluatorFor(request.family)(request)
}

/**
 * Whether a family has a model for this configuration, and why not when it has not.
 *
 * `untrained-configuration` rather than an invalid-configuration code, for the reason
 * `prediction-artifacts` already gives: every knob value the student chose was one they
 * were offered, so the cause is that no model exists for the combination. The family is
 * named as well as the identifier, because the same identifier may well be covered in
 * another family of the same task and "no model was trained for it" would then read as a
 * flat contradiction of what the student can see.
 */
export function familyCoverageIssue(
  family: ModelFamilyDeclaration,
  coverage: readonly string[],
  configurationId: string,
): ValidationIssue | undefined {
  if (coverage.includes(configurationId)) return undefined
  return {
    code: UNTRAINED_CONFIGURATION,
    field: configurationId,
    message:
      `No model was trained for configuration "${configurationId}" in family "${family.id}", ` +
      'so this run cannot be scored. These knob values are allowed; the configuration has ' +
      'simply not been trained in advance.',
  }
}
