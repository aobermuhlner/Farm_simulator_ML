/**
 * What resolving a configuration against a model family yields.
 *
 * One shape for every family, whatever it ships, so that `src/scoring/`, `src/policy/`
 * and the report are written once and serve the whole ladder.
 *
 * Accessors rather than a materialized map of predictions. A family that ships its model
 * has no such map — it has a model and a feature table — and building one eagerly would
 * make selecting a family walk the whole pool before showing anything. The artifact-backed
 * family closes over its stored record and the model-shipping family evaluates on call;
 * neither caller can tell which it has.
 *
 * The history is optional because a family may record none. It is carried on the same
 * entry as the distributions so that a history and a distribution can never refer to
 * different configurations.
 *
 * See openspec/changes/model-families/specs/model-families/spec.md.
 */

import type { ConfigurationEntry, SplitName, TrainingStep } from '../task/artifact.js'
import type { ShippedModel } from './model.js'

export interface FamilyEntry {
  /** The configuration's training history, for a family that records one. */
  readonly history?: readonly TrainingStep[]
  /**
   * The model itself, for a family that ships one.
   *
   * Optional for the same reason the history is: a family whose predictions ship has no
   * structure to show, and offering an empty one would be a shape nothing could draw.
   *
   * It is carried on the entry rather than fetched a second time so that the model
   * drawn on screen and the model that scores the harvest are the same object. `fitted-tree`
   * requires the two to be one — a drawing fetched separately could be a version behind
   * the one at work, and a student would be reading a tree that is not sorting their apples.
   */
  readonly structure?: ShippedModel
  /** The distribution for one image of one split, or nothing where there is none. */
  distributionFor(split: SplitName, imageId: string): readonly number[] | undefined
  /** The images one split holds, in the order the pool enumerates them. */
  imageIdsIn(split: SplitName): readonly string[]
}

/**
 * A family entry over a stored prediction table.
 *
 * The whole of the prediction-shipping evaluator's output: the artifact reader has
 * already checked the table against the pool and the task, so there is nothing left to do
 * but read it.
 */
export function entryFromPredictions(stored: ConfigurationEntry): FamilyEntry {
  return {
    history: stored.history,
    distributionFor: (split, imageId) => stored.predictions[split]?.[imageId],
    imageIdsIn: (split) => Object.keys(stored.predictions[split] ?? {}),
  }
}
