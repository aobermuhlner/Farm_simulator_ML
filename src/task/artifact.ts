/**
 * Reading a precomputed prediction artifact.
 *
 * The artifact stores a probability distribution per image per configuration —
 * never a chosen action or a final label — so the decision rule stays a live
 * computation over frozen data. Both the browsable training split and the
 * larger evaluation pool are present, which is what lets performance on data
 * the model learned from be shown beside performance on unseen data.
 *
 * The on-disk encoding (quantization, chunking, file layout) belongs to
 * `prediction-artifacts`. This module only describes the shape this change's
 * contract depends on.
 */

import type { ResolvedConfiguration } from './configuration.js'
import { configurationId } from './configId.js'
import type { TaskDeclaration } from './types.js'
import type { ValidationIssue } from './validate.js'
import { checkArtifactVersion } from './version.js'

export type SplitName = 'training' | 'pool'

export interface TrainingEpoch {
  readonly epoch: number
  readonly trainLoss: number
  readonly valLoss: number
}

/** Image id to probability distribution over the task's declared categories. */
export type SplitPredictions = Readonly<Record<string, readonly number[]>>

export interface ConfigurationEntry {
  readonly history: readonly TrainingEpoch[]
  readonly predictions: Readonly<Record<SplitName, SplitPredictions>>
}

export interface PredictionArtifact {
  readonly schemaVersion: string
  readonly taskId: string
  /** Category order the probability vectors are indexed by. */
  readonly categories: readonly string[]
  readonly configurations: Readonly<Record<string, ConfigurationEntry>>
}

export type ArtifactLookup =
  | {
      readonly ok: true
      readonly configurationId: string
      readonly entry: ConfigurationEntry
    }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/**
 * Resolves a configuration against an artifact: refuses on a schema version
 * mismatch, on a task id mismatch, on a category order the task does not
 * declare, and on a configuration the artifact has no entry for. On success the
 * predictions and the training history returned both come from one entry, so
 * they cannot refer to different configurations.
 */
export function lookupConfiguration(
  declaration: TaskDeclaration,
  configuration: ResolvedConfiguration,
  artifact: PredictionArtifact,
): ArtifactLookup {
  const issues: ValidationIssue[] = []

  const version = checkArtifactVersion(declaration.schemaVersion, artifact.schemaVersion)
  if (!version.ok) issues.push(version.issue)

  if (artifact.taskId !== declaration.id) {
    issues.push({
      code: 'artifact-task-mismatch',
      field: 'taskId',
      message: `Artifact belongs to task "${artifact.taskId}", not "${declaration.id}".`,
    })
  }

  const declaredCategories = declaration.categories.map((category) => category.id)
  if (artifact.categories.join(',') !== declaredCategories.join(',')) {
    issues.push({
      code: 'artifact-category-mismatch',
      field: 'categories',
      message:
        `Artifact indexes probabilities by [${artifact.categories.join(', ')}], ` +
        `but the task declares [${declaredCategories.join(', ')}].`,
    })
  }

  // Refuse before reading rows: a version or category mismatch makes every
  // distribution in the artifact untrustworthy, and partial data is not used.
  if (issues.length > 0) return { ok: false, issues }

  const id = configurationId(configuration)
  const entry = artifact.configurations[id]
  if (entry === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: 'unknown-configuration',
          field: id,
          message: `Artifact has no entry for configuration "${id}".`,
        },
      ],
    }
  }

  return { ok: true, configurationId: id, entry }
}

/** The distribution stored for one image, or undefined when the split has none. */
export function distributionFor(
  entry: ConfigurationEntry,
  split: SplitName,
  imageId: string,
): readonly number[] | undefined {
  return entry.predictions[split][imageId]
}
